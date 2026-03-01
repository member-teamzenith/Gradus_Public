
import os
from typing import List, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from core.config import settings

# ============================================================================
# Shared Qdrant Client Singleton
# ============================================================================
_shared_qdrant_client: Optional[QdrantClient] = None

def get_qdrant_client() -> QdrantClient:
    """Get or create a shared Qdrant client using unified settings.
    Singleton pattern - reuses connection across all storage classes.
    """
    global _shared_qdrant_client
    if _shared_qdrant_client is None:
        qdrant_url = settings.QDRANT_URL
        qdrant_api_key = settings.QDRANT_API_KEY
        
        if not qdrant_url:
            logger.error("QDRANT_URL not set in environment or settings")
            raise RuntimeError("QDRANT_URL is required")
        
        _shared_qdrant_client = QdrantClient(
            url=qdrant_url, 
            api_key=qdrant_api_key,
            timeout=60 # Increase timeout for cloud upserts
        )
    return _shared_qdrant_client

def close_qdrant_client() -> None:
    """Close the shared Qdrant client. Call during shutdown."""
    global _shared_qdrant_client
    if _shared_qdrant_client is not None:
        try:
            _shared_qdrant_client.close()
        except Exception:
            pass
        _shared_qdrant_client = None

def ensure_collection(client: QdrantClient, name: str, vector_size: int) -> None:
    """Ensure a collection exists with given vector size and cosine distance."""
    try:
        client.get_collection(name)
    except Exception:
        print(f"Creating collection {name}...")
        client.recreate_collection(
            collection_name=name,
            vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
        )
    
    # Ensure payload indexes efficiently
    _create_payload_index(client, name, "video_id", qmodels.PayloadSchemaType.KEYWORD)
    _create_payload_index(client, name, "section_type", qmodels.PayloadSchemaType.KEYWORD)
    _create_payload_index(client, name, "source_type", qmodels.PayloadSchemaType.KEYWORD)
    _create_payload_index(client, name, "user_id", qmodels.PayloadSchemaType.KEYWORD)
    _create_payload_index(client, name, "video_duration", qmodels.PayloadSchemaType.FLOAT)

def _create_payload_index(client: QdrantClient, collection_name: str, field_name: str, schema_type):
    try:
        client.create_payload_index(
            collection_name=collection_name,
            field_name=field_name,
            field_schema=schema_type,
        )
    except Exception:
        pass

def upsert_points(client: QdrantClient, collection_name: str, points: List[qmodels.PointStruct]) -> None:
    if not points:
        return
    client.upsert(collection_name=collection_name, points=points)


__all__ = [
    "get_qdrant_client",
    "close_qdrant_client",
    "ensure_collection",
    "upsert_points",
    "qmodels",
]

