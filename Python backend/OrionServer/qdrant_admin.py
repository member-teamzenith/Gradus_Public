import sys
import json
from typing import Any, Dict, Optional
import os

from qdrant_client import QdrantClient

from core.config import settings

def get_qdrant_client() -> QdrantClient:
    url = settings.QDRANT_URL
    api_key = settings.QDRANT_API_KEY
    return QdrantClient(url=url, api_key=api_key)


def _to_json(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, indent=2)
    except Exception:
        return json.dumps(str(obj), ensure_ascii=False)


def list_collections(json_output: bool = False) -> int:
    client = get_qdrant_client()
    try:
        res = client.get_collections()
        collections = getattr(res, "collections", [])
    except Exception as e:
        print(f"Error listing collections: {e}", file=sys.stderr)
        return 1

    if json_output:
        payload = {
            "count": len(collections),
            "collections": [getattr(c, "name", getattr(c, "collection_name", None)) for c in collections],
        }
        print(_to_json(payload))
    else:
        print("Collections:")
        for c in collections:
            name = getattr(c, "name", getattr(c, "collection_name", None))
            print(f"- {name}")
        print(f"Total: {len(collections)}")
    return 0


def _safe_point_count(client: Any, collection_name: str) -> int:
    try:
        info = client.get_collection(collection_name=collection_name)
        # Newer SDKs expose points_count directly; otherwise fall back to status or config
        if hasattr(info, "points_count"):
            return int(info.points_count)
        if hasattr(info, "result") and isinstance(info.result, dict) and "points_count" in info.result:
            return int(info.result.get("points_count") or 0)
    except Exception:
        pass
    # Fallback: count with no filter (may be slower but robust)
    try:
        cnt = client.count(collection_name=collection_name, count_filter=None, exact=True)
        return int(getattr(cnt, "count", cnt.get("count", 0)))
    except Exception:
        return 0


def describe_collection(name: str, json_output: bool = False) -> int:
    client = get_qdrant_client()
    try:
        info = client.get_collection(collection_name=name)
        vectors = None
        hnsw = None
        optimizers = None
        params = getattr(info, "vectors_config", None) or getattr(info, "config", None)
        if params is not None:
            vectors = params
        hnsw = getattr(info, "hnsw_config", None)
        optimizers = getattr(info, "optimizers_config", None)
        points_count = _safe_point_count(client, name)
        out: Dict[str, Any] = {
            "collection": name,
            "points_count": points_count,
            "vectors_config": _to_json(vectors) if not json_output else vectors,
            "hnsw_config": _to_json(hnsw) if not json_output else hnsw,
            "optimizers_config": _to_json(optimizers) if not json_output else optimizers,
        }
        if json_output:
            print(_to_json(out))
        else:
            print(f"Collection: {name}")
            print(f"Points: {points_count}")
            print("Vectors Config:")
            print(out["vectors_config"])
            print("HNSW Config:")
            print(out["hnsw_config"])
            print("Optimizers Config:")
            print(out["optimizers_config"])
        return 0
    except Exception as e:
        print(f"Error describing collection '{name}': {e}", file=sys.stderr)
        return 1


def delete_collection(name: str, assume_yes: bool = False, json_output: bool = False) -> int:
    if not assume_yes:
        print("Refusing to delete without confirmation.", file=sys.stderr)
        return 2
    client = get_qdrant_client()
    try:
        client.delete_collection(collection_name=name)
        if json_output:
            print(_to_json({"deleted": True, "collection": name}))
        else:
            print(f"Deleted collection: {name}")
        return 0
    except Exception as e:
        print(f"Error deleting collection '{name}': {e}", file=sys.stderr)
        return 1


def prompt_bool(message: str) -> bool:
    try:
        ans = input(f"{message} [y/N]: ").strip().lower()
        return ans in {"y", "yes"}
    except (EOFError, KeyboardInterrupt):
        return False


def sample_points(collection: str, limit: int = 5, json_output: bool = False, video_id: Optional[str] = None) -> int:
    """Fetch a small sample of points with payload and vector length.

    If video_id is provided, uses a filter on payload.video_id.
    """
    try:
        limit = max(1, min(int(limit), 10))
    except Exception:
        limit = 5
    client = get_qdrant_client()
    try:
        flt = None
        if video_id:
            flt = {"must": [{"key": "video_id", "match": {"value": video_id.strip()}}]}
        try:
            points, next_off = client.scroll(
                collection_name=collection,
                scroll_filter=flt,
                limit=limit,
                with_payload=True,
                with_vectors=True,
                offset=None,
            )
            points = points or []
        except Exception:
            # Fallback: scan and filter client-side (handles missing index cases)
            points = []
            fetched = 0
            next_off2 = None
            while len(points) < limit and fetched < 5000:
                bp, next_off2 = client.scroll(
                    collection_name=collection,
                    scroll_filter={"must": [{"key": "source_type", "match": {"value": "video_ir"}}]} if video_id else None,
                    limit=min(500, limit - len(points) if video_id else 500),
                    with_payload=True,
                    with_vectors=True,
                    offset=next_off2,
                )
                bp = bp or []
                fetched += len(bp)
                if video_id:
                    v = video_id.strip()
                    for p in bp:
                        payload = getattr(p, "payload", {}) or {}
                        if str(payload.get("video_id", "")).strip() == v:
                            points.append(p)
                            if len(points) >= limit:
                                break
                else:
                    points.extend(bp[: max(0, limit - len(points))])
                if not next_off2:
                    break

        items = []
        for p in points:
            payload = getattr(p, "payload", None)
            vector = getattr(p, "vector", None)
            vid = None
            try:
                vid = payload.get("video_id") if isinstance(payload, dict) else None
            except Exception:
                vid = None
            vec_len = len(vector) if isinstance(vector, (list, tuple)) else None
            items.append({
                "id": str(getattr(p, "id", "")),
                "video_id": vid,
                "vector_len": vec_len,
                "payload": payload,
            })
        out = {"collection": collection, "count": len(items), "items": items}
        if json_output:
            print(_to_json(out))
        else:
            print(f"Collection: {collection}")
            print(f"Sample count: {len(items)}")
            for it in items:
                print(f"- id={it['id']} video_id={it['video_id']} vector_len={it['vector_len']}")
                try:
                    payload_pretty = json.dumps(it.get("payload"), ensure_ascii=False, indent=2)
                except Exception:
                    payload_pretty = str(it.get("payload"))
                print(payload_pretty)
        return 0
    except Exception as e:
        print(f"Error sampling points from '{collection}': {e}", file=sys.stderr)
        return 1


def _load_creds(path: str = "creds.txt") -> Dict[str, str]:
    data: Dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    data[k.strip()] = v.strip()
    except Exception:
        pass
    return data


def flush_redis(json_output: bool = False) -> int:
    try:
        creds = _load_creds()
        url = creds.get("REDIS_URL") or os.getenv("REDIS_URL")
        if not url:
            msg = "REDIS_URL not found in creds.txt or environment"
            if json_output:
                print(_to_json({"flushed": False, "error": msg}))
            else:
                print(msg)
            return 1
        try:
            import redis  # type: ignore
        except Exception as e:
            if json_output:
                print(_to_json({"flushed": False, "error": f"redis package not available: {e}"}))
            else:
                print(f"redis package not available: {e}")
            return 1
        r = redis.from_url(url)
        r.flushall()
        if json_output:
            print(_to_json({"flushed": True}))
        else:
            print("Redis cache cleared")
        return 0
    except Exception as e:
        if json_output:
            print(_to_json({"flushed": False, "error": str(e)}))
        else:
            print(f"Failed to flush Redis: {e}")
        return 1


def main() -> int:
    print("Qdrant Admin Console")
    json_mode: bool = False
    while True:
        print("\nSelect an option:")
        print("  1) List collections")
        print("  2) Describe a collection")
        print("  3) Delete a collection")
        print("  4) Sample points (5-10) from a collection")
        print("  5) Flush Redis cache (from creds.txt)")
        print("  6) Toggle JSON output (currently: {} )".format("ON" if json_mode else "OFF"))
        print("  7) Exit")
        try:
            choice = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            return 0

        if choice == "1":
            list_collections(json_output=json_mode)
        elif choice == "2":
            name = input("Enter collection name: ").strip()
            if not name:
                print("Collection name cannot be empty.")
                continue
            describe_collection(name, json_output=json_mode)
        elif choice == "3":
            name = input("Enter collection name to delete: ").strip()
            if not name:
                print("Collection name cannot be empty.")
                continue
            # strong confirmation: require typing the name
            confirm = input(f"Type the collection name to confirm deletion '{name}': ").strip()
            if confirm != name:
                print("Confirmation did not match. Aborting delete.")
                continue
            if not prompt_bool(f"Are you sure you want to delete '{name}'?"):
                print("Delete cancelled.")
                continue
            delete_collection(name, assume_yes=True, json_output=json_mode)
        elif choice == "4":
            name = input("Enter collection name: ").strip()
            if not name:
                print("Collection name cannot be empty.")
                continue
            try:
                lim_str = input("Enter sample limit (5-10, default 5): ").strip() or "5"
                lim = int(lim_str)
            except Exception:
                lim = 5
            vid = input("Optional filter video_id (press Enter to skip): ").strip() or None
            sample_points(name, limit=lim, json_output=json_mode, video_id=vid)
        elif choice == "5":
            if not prompt_bool("This will FLUSH ALL Redis data. Continue?"):
                print("Flush cancelled.")
                continue
            flush_redis(json_output=json_mode)
        elif choice == "6":
            json_mode = not json_mode
            print(f"JSON output is now {'ON' if json_mode else 'OFF'}.")
        elif choice == "7":
            print("Goodbye.")
            return 0
        else:
            print("Invalid choice. Please select 1-7.")


if __name__ == "__main__":
    sys.exit(main())


