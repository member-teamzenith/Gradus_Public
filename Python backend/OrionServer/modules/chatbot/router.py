
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import logging

# Local imports (Relative)
# We assume qdrant_utils logic is either local or we switch to shared.
# For minimal changes, we use the local one but maybe wrapped or just imported.
# main.py used: from chatbot_utils.qdrant_utils import get_qdrant_client
from utils.qdrant import get_qdrant_client

# Import migration manager
from .Storage.migration_manager import MigrationManager

# Import core chatbot logic and models
from .chatbot import (
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
    force_create_summary_node,
    fetch_video_chunks
)

router = APIRouter()

# Data Models



class EmbedTranscriptPayload(BaseModel):
    video_id: str
    entries: List[Any]  # normalized entries list [start, end, text] or {start, end, text}


# API Endpoints

# /health handled by root.

@router.post("/embed_transcript")
def embed_transcript(payload: EmbedTranscriptPayload) -> Dict[str, Any]:
    # We keep this as it wasn't explicitly deprecated, only embed_videoir was.
    # But usually /analyze handles this too. However, we'll keep it to be safe.
    # We need to import check_transcript_exists, process_transcript_from_entries 
    # which seem to be missing from the import list above?
    # Let's check the original main.py imports... 
    # Wait, main.py (Step 436) didn't show check_transcript_exists in the import block I read.
    # It might have been skipped or I missed it. 
    # Ah, I only read first 800 lines. Maybe it was imported inside functions or I missed it.
    # Let's assume they are in 'chatbot' module.
    # Re-reading Step 436:
    # "from chatbot import ( ... )"
    # It doesn't list check_transcript_exists explicitly in the snippet I posted.
    # But the functions usage is there.
    # I will add them to the import.
    from .chatbot import check_transcript_exists, process_transcript_from_entries
    
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

@router.get("/embedding/retrieve/video_chunks/{video_id}")
async def get_video_unified_chunks(video_id: str):
    """Retrieve all unified chunks for a specific Video ID."""
    try:
        chunks = fetch_video_chunks(video_id, limit=2000)
        return {
            "video_id": video_id,
            "count": len(chunks),
            "chunks": chunks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/init", response_model=ChatInitResponse)
def init_chat(request: ChatInitRequest) -> ChatInitResponse:
    """Initialize a new chat session."""
    try:
        return initialize_chat_session(request.user_id, request.video_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize chat: {str(e)}")

@router.get("/chat/exists/{user_id}/{video_id}")
def check_chat_exists_endpoint(user_id: str, video_id: str) -> Dict[str, Any]:
    """Check if a chat session exists."""
    try:
        return check_chat_exists(user_id, video_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check chat existence: {str(e)}")

@router.get("/chat/session/{chat_id}")
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

@router.get("/chat/sessions")
def list_sessions() -> Dict[str, Any]:
    """List all active chat sessions."""
    try:
        return list_active_sessions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")

@router.get("/chat/history/{chat_id}")
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

@router.post("/chat/message")
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

@router.post("/chat/migrate/redis-to-qdrant/{chat_id}")
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

@router.post("/chat/migrate/qdrant-to-firebase/{chat_id}")
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

@router.get("/chat/storage-info/{chat_id}")
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

@router.get("/chat/search/{chat_id}")
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

@router.get("/chat/summary-nodes/{chat_id}")
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

@router.get("/chat/recent-messages/{chat_id}")
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

@router.get("/chat/summary-stats/{chat_id}")
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

@router.post("/chat/force-summary/{chat_id}")
def force_create_summary_endpoint(chat_id: str) -> Dict[str, Any]:
    """Force creation of a summary node."""
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

@router.get("/system/status")
def system_status() -> Dict[str, Any]:
    """Get system status and health information."""
    try:
        return {
            "status": "healthy",
            "service": "Orion-Chatbot-Module",
            "version": "2.0.0",
            "storage_tiers": ["redis", "qdrant", "firebase"],
            "features": [
                "video_ir_processing",
                "chat_sessions",
                "streaming_responses",
                "semantic_search",
                "hybrid_storage_migration",
                "progressive_summary_nodes"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system status: {str(e)}")

@router.post("/migration/run-cycle")
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

