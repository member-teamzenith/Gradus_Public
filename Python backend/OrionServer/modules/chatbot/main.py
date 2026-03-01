from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import uvicorn

from utils.qdrant import get_qdrant_client

# Import migration manager
from Storage.migration_manager import MigrationManager

# Import core chatbot logic and models
from chatbot import (
    # Data Models
    ChatInitRequest,
    ChatInitResponse,
    ChatMessageStream,
    
    # Core Functions
    initialize_chat_session,
    check_chat_exists,
    get_session_info,
    get_chat_history_for_session,
    add_message_stream,
    list_active_sessions,
    
    # Storage Functions
    migrate_to_qdrant,
    migrate_to_firebase,
    get_chat_metadata,
    search_chat_history,
    
    # Progressive Summary Functions
    get_summary_nodes,
    get_recent_non_summary_messages,
    count_messages_since_last_summary,
    fetch_video_chunks
)

# Import shared HTTP client lifecycle for LLM/Vision
try:
    from chatbot_utils.answering_client import get_shared_llm_http_client, close_shared_llm_http_client
    from chatbot_utils.vision_client import get_shared_vision_http_client, close_shared_vision_http_client
except Exception:
    get_shared_llm_http_client = None
    get_shared_vision_http_client = None
    close_shared_llm_http_client = None
    close_shared_vision_http_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize shared HTTP clients early to catch errors and enable pooling
    try:
        if get_shared_llm_http_client:
            get_shared_llm_http_client()
    except Exception:
        pass
    try:
        if get_shared_vision_http_client:
            get_shared_vision_http_client()
    except Exception:
        pass
    # Yield control to the application
    try:
        yield
    finally:
        # Close shared HTTP clients to avoid resource leaks on process stop
        try:
            if close_shared_llm_http_client:
                close_shared_llm_http_client()
        except Exception:
            pass
        try:
            if close_shared_vision_http_client:
                close_shared_vision_http_client()
        except Exception:
            pass

# Initialize FastAPI app with lifespan handler
app = FastAPI(
    title="Video Chatbot API",
    version="1.0.0",
    description="Unified API for video processing and chatbot functionality",
    lifespan=lifespan,
)

# Reduce noisy third-party HTTP logs (e.g., httpx)
try:
    httpx_logger = logging.getLogger("httpx")
    httpx_logger.setLevel(logging.WARNING)
    httpx_logger.disabled = True
    # Also quiet qdrant client if present
    logging.getLogger("qdrant_client").setLevel(logging.ERROR)
except Exception:
    pass

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


    pass



class EmbedTranscriptPayload(BaseModel):
    video_id: str
    entries: List[Any]  # normalized entries list [start, end, text] or {start, end, text}


# API Endpoints

@app.get("/health")
def health() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "video_chatbot"}


@app.get("/healthz")
def healthz() -> Dict[str, str]:
    return {"status": "ok"}


 





@app.post("/embed_transcript")
def embed_transcript(payload: EmbedTranscriptPayload) -> Dict[str, Any]:
    try:
        # Early existence check before any processing
        if check_transcript_exists(payload.video_id):
            return {
                "video_id": payload.video_id,
                "total_chunks": 0,
                "chunking_s": 0.0,
                "embedding_s": 0.0,
                "skipped": True,
                "message": "Transcript already exists in Qdrant"
            }
        
        if not payload.entries:
            raise HTTPException(status_code=400, detail="entries list is required")

        # Normalize flexible inputs into [start, end, text] style
        def _normalize_entries(entries_any: Any) -> List[Any]:
            # If entries is a list of strings, convert to timed triplets
            if isinstance(entries_any, list):
                if all(isinstance(x, str) for x in entries_any):
                    t = 0.0
                    out: List[List[Any]] = []
                    for line in entries_any:
                        line_text = (line or "").strip()
                        if not line_text:
                            continue
                        start = t
                        end = t + 5.0
                        t = end
                        out.append([start, end, line_text])
                    return out
                # Otherwise assume it's already in acceptable dict/array format
                return entries_any
            # If entries is a single string, split by lines
            if isinstance(entries_any, str):
                lines = [s.strip() for s in entries_any.split("\n") if s.strip()]
                t = 0.0
                out2: List[List[Any]] = []
                for line in lines:
                    start = t
                    end = t + 5.0
                    t = end
                    out2.append([start, end, line])
                return out2
            # Unsupported type
            raise HTTPException(status_code=400, detail="Unsupported entries format. Provide JSON array or plain text.")

        normalized_entries = _normalize_entries(payload.entries)
        result = process_transcript_from_entries(payload.video_id, normalized_entries)
        return {"video_id": payload.video_id, **result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# Split endpoints (transcript retrieval temporarily disabled)


# **Below Endpoint is very important dont remove it**
# @app.get("/embedding/retrieve/transcript/{video_id}")
# def retrieve_transcript_embeddings(
#     video_id: str,
#     limit: Optional[int] = None,
#     offset: Optional[str] = None,
#     with_vectors: bool = False,
# ) -> Dict[str, Any]:
#     try:
#         client = get_qdrant_client()

#         flt = {"must": [{"key": "video_id", "match": {"value": video_id}}]}

#         def do_count() -> int:
#             try:
#                 res = client.count(collection_name="transcript_chunks", count_filter=flt, exact=True)
#                 return int(getattr(res, "count", res.get("count", 0)))
#             except Exception:
#                 return 0

#         def do_scroll(lim: int, off: Optional[str]):
#             try:
#                 points, next_off = client.scroll(
#                     collection_name="transcript_chunks",
#                     scroll_filter=flt,
#                     limit=lim,
#                     with_payload=True,
#                     with_vectors=with_vectors,
#                     offset=off,
#                 )
#                 return (points or []), next_off
#             except Exception:
#                 return [], None

#         def do_scroll_all():
#             page_size = 1000
#             acc: List[Any] = []
#             next_off: Optional[str] = offset
#             while True:
#                 pts, next_off = do_scroll(page_size, next_off)
#                 if not pts:
#                     break
#                 acc.extend(pts)
#                 if not next_off:
#                     break
#             return acc

#         def extract_payload(p: Any) -> Dict[str, Any]:
#             return p.payload if hasattr(p, "payload") else (p.get("payload", {}) if isinstance(p, dict) else {})

#         def format_items(points: List[Any]) -> List[Dict[str, Any]]:
#             items: List[Dict[str, Any]] = []
#             for p in points:
#                 payload = extract_payload(p)
#                 items.append({
#                     "id": str(getattr(p, "id", payload.get("chunk_id", ""))),
#                     "payload": payload,
#                 })
#             return items

#         def safe_next_offset(val: Any) -> Optional[Any]:
#             try:
#                 import json as _json
#                 _json.dumps(val)
#                 return val
#             except Exception:
#                 return None

#         total = do_count()
#         full_dump = (limit is None) or (isinstance(limit, int) and limit <= 0)
#         if full_dump:
#             points = do_scroll_all()
#             next_off = None
#         else:
#             page_lim = int(limit)
#             points, next_off = do_scroll(page_lim, offset)

#         coll_result: Dict[str, Any] = {
#             "total_count": total,
#             "items": format_items(points),
#             "next_offset": safe_next_offset(next_off),
#         }

#         # Diagnostics by chunk_type
#         try:
#             type_counts: Dict[str, int] = {}
#             for item in coll_result.get("items", []):
#                 payload = item.get("payload", {})
#                 ctype = str(payload.get("chunk_type") or "transcript")
#                 type_counts[ctype] = type_counts.get(ctype, 0) + 1
#             coll_result["by_chunk_type"] = type_counts
#         except Exception:
#             coll_result["by_chunk_type"] = {}

#         return {"video_id": video_id, "transcript_chunks": coll_result}
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to retrieve transcript: {str(e)}")


# Chat Session Management Endpoints

@app.get("/embedding/retrieve/video_chunks/{video_id}")
async def get_video_unified_chunks(video_id: str):
    """
    Retrieve all unified chunks for a specific Video ID.
    Useful for debugging and inspecting the chunk structure.
    """
    try:
        chunks = fetch_video_chunks(video_id, limit=2000)
        return {
            "video_id": video_id,
            "count": len(chunks),
            "chunks": chunks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/init", response_model=ChatInitResponse)
def init_chat(request: ChatInitRequest) -> ChatInitResponse:
    """
    Initialize a new chat session for a user and session, or return existing one.
    
    This endpoint:
    1. Checks if a chat session already exists for this user+session combination
    2. Returns existing session if found, or creates a new one with hybrid storage
    3. Returns session details with status indicating if it was created or already existed
    
    Note: Video IR/transcript validation is disabled for normal chatbot operation
    """
    try:
        return initialize_chat_session(request.user_id, request.video_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize chat: {str(e)}")

@app.get("/chat/exists/{user_id}/{video_id}")
def check_chat_exists_endpoint(user_id: str, video_id: str) -> Dict[str, Any]:
    """Check if a chat session exists for the given user and video."""
    try:
        return check_chat_exists(user_id, video_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check chat existence: {str(e)}")

@app.get("/chat/session/{chat_id}")
def get_session_info_endpoint(chat_id: str) -> Dict[str, Any]:
    """Get information about a chat session."""
    try:
        return get_session_info(chat_id)
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        elif "Chat session not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session info: {str(e)}")

@app.get("/chat/sessions")
def list_sessions() -> Dict[str, Any]:
    """List all active chat sessions (Redis-based)."""
    try:
        return list_active_sessions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")

@app.get("/chat/history/{chat_id}")
def get_chat_history_endpoint(chat_id: str, limit: int = 50) -> Dict[str, Any]:
    """Get chat history for a session."""
    try:
        return get_chat_history_for_session(chat_id, limit)
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat history: {str(e)}")

@app.post("/chat/message")
def stream_message(message: ChatMessageStream) -> StreamingResponse:
    """Add a message to the chat and stream the response."""
    try:
        def generate_stream():
            for chunk in add_message_stream(message.chat_id, message.message, message.attachment):
                yield f"data: {chunk.model_dump_json()}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream message: {str(e)}")

# Storage Migration Endpoints

@app.post("/chat/migrate/redis-to-qdrant/{chat_id}")
def migrate_redis_to_qdrant(chat_id: str) -> Dict[str, Any]:
    """Migrate chat history from Redis to Qdrant."""
    try:
        result = migrate_to_qdrant(chat_id)
        return {
            "chat_id": chat_id,
            "status": "success",
            "message": "Chat history migrated from Redis to Qdrant",
            "details": result
        }
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        elif "Chat session not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to migrate to Qdrant: {str(e)}")

@app.post("/chat/migrate/qdrant-to-firebase/{chat_id}")
def migrate_qdrant_to_firebase(chat_id: str) -> Dict[str, Any]:
    """Migrate chat history from Qdrant to Firebase."""
    try:
        result = migrate_to_firebase(chat_id)
        return {
            "chat_id": chat_id,
            "status": "success",
            "message": "Chat history migrated from Qdrant to Firebase",
            "details": result
        }
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        elif "Chat session not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to migrate to Firebase: {str(e)}")

# Additional Utility Endpoints
@app.get("/chat/storage-info/{chat_id}")
def get_storage_info(chat_id: str) -> Dict[str, Any]:
    """Get information about where the chat history is stored."""
    try:
        metadata = get_chat_metadata(chat_id)
        if not metadata:
            raise ValueError("Chat session not found")
        
        return {
            "chat_id": chat_id,
            "current_tier": metadata.get("tier", "unknown"),
            "message_count": int(metadata.get("message_count", 0)),
            "created_at": metadata.get("created_at"),
            "last_activity": metadata.get("last_activity"),
            "available_tiers": ["redis", "qdrant", "firebase"]
        }
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        elif "Chat session not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get storage info: {str(e)}")



@app.get("/chat/search/{chat_id}")
def search_chat_history_endpoint(chat_id: str, query: str, limit: int = 10) -> Dict[str, Any]:
    """Search chat history using semantic similarity."""
    try:
        results = search_chat_history(chat_id, query, limit)
        return {
            "chat_id": chat_id,
            "query": query,
            "results": results,
            "count": len(results)
        }
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search chat history: {str(e)}")

# Progressive Summary Management Endpoints

@app.get("/chat/summary-nodes/{chat_id}")
def get_chat_summary_nodes(chat_id: str, limit: int = 10) -> Dict[str, Any]:
    """Get summary nodes for a chat."""
    try:
        summary_nodes = get_summary_nodes(chat_id, limit)
        return {
            "chat_id": chat_id,
            "summary_nodes": summary_nodes,
            "count": len(summary_nodes),
            "status": "success"
        }
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summary nodes: {str(e)}")

@app.get("/chat/recent-messages/{chat_id}")
def get_recent_non_summary_messages_endpoint(chat_id: str, limit: int = 6) -> Dict[str, Any]:
    """Get recent non-summary messages for a chat."""
    try:
        recent_messages = get_recent_non_summary_messages(chat_id, limit)
        return {
            "chat_id": chat_id,
            "recent_messages": recent_messages,
            "count": len(recent_messages),
            "status": "success"
        }
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recent messages: {str(e)}")

@app.get("/chat/summary-stats/{chat_id}")
def get_chat_summary_stats(chat_id: str) -> Dict[str, Any]:
    """Get summary statistics for a chat."""
    try:
        messages_since_summary = count_messages_since_last_summary(chat_id)
        summary_nodes = get_summary_nodes(chat_id, limit=100)
        recent_messages = get_recent_non_summary_messages(chat_id, limit=100)
        
        return {
            "chat_id": chat_id,
            "messages_since_last_summary": messages_since_summary,
            "total_summary_nodes": len(summary_nodes),
            "total_recent_messages": len(recent_messages),
            "next_summary_in": max(0, 8 - messages_since_summary) if messages_since_summary < 8 else 0,
            "summary_coverage": "complete" if summary_nodes else "none",
            "status": "success"
        }
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summary stats: {str(e)}")

@app.post("/chat/force-summary/{chat_id}")
def force_create_summary_endpoint(chat_id: str) -> Dict[str, Any]:
    """Force creation of a summary node (for testing/debugging)."""
    try:
        result = force_create_summary_node(chat_id)
        if result["status"] == "success":
            return {
                "chat_id": chat_id,
                "message": result["message"],
                "status": "success"
            }
        else:
            raise HTTPException(status_code=500, detail=result["message"])
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to force create summary: {str(e)}")

@app.get("/system/status")
def system_status() -> Dict[str, Any]:
    """Get system status and health information."""
    try:
        return {
            "status": "healthy",
            "service": "video_chatbot",
            "version": "2.0.0",
            "storage_tiers": ["redis", "qdrant", "firebase"],
            "features": [
                "video_ir_processing",
                "transcript_processing", 
                "chat_sessions",
                "streaming_responses",
                "semantic_search",
                "hybrid_storage_migration",
                "progressive_summary_nodes"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system status: {str(e)}")

# Automated Migration Management Endpoints

@app.post("/migration/run-cycle")
def run_migration_cycle(dry_run: bool = False) -> Dict[str, Any]:
    """Run the automated migration cycle."""
    try:
        migration_manager = MigrationManager()
        results = migration_manager.run_migration_cycle(dry_run=dry_run)
        return {
            "status": "success",
            "message": "Migration cycle completed",
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run migration cycle: {str(e)}")

@app.get("/migration/stats")
def get_migration_stats() -> Dict[str, Any]:
    """Get current migration statistics."""
    try:
        migration_manager = MigrationManager()
        stats = migration_manager.get_migration_stats()
        return {
            "status": "success",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get migration stats: {str(e)}")

@app.post("/migration/update-access/{chat_id}")
def update_chat_access_time(chat_id: str, tier: str = "redis") -> Dict[str, Any]:
    """Update the last access time for a chat."""
    try:
        migration_manager = MigrationManager()
        success = migration_manager.update_access_time(chat_id, tier)
        if success:
            return {
                "status": "success",
                "message": f"Updated access time for {chat_id} in {tier}",
                "chat_id": chat_id,
                "tier": tier
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update access time")
    except ValueError as e:
        if "Invalid chat_id format" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update access time: {str(e)}")

# Server startup
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8701)


