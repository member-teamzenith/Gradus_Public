"""
Orion API - Video Player Router
Provides endpoints for IR generation, summarization, recommendations, and quiz generation.
"""

# Standard library imports
import asyncio
import json
import logging
import threading
import traceback
from typing import Any, Dict, List, Optional, Union, Literal

logger = logging.getLogger(__name__)

# Third-party imports
from fastapi import APIRouter, HTTPException, Body, Request, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Local imports (Relative to this module)
from .ir_agent import IRAgent
from .writer_agent import WriterAgent
from .recommendation_agent import RecommendationAgent
from .quiz_generator import quiz_agent
from .Chunking_Embedding_Processor.unified_storage import UnifiedChunkStorage
from .Chunking_Embedding_Processor.user_profile_storage import UserProfileStorage

# ============================================================================
# Pydantic Models
# ============================================================================

class AnalyzeRequest(BaseModel):
    video_id: str
    input_type: Literal["transcript", "description"]
    content: Optional[str] = None
    entries: Optional[List[Any]] = None  # Accepts list of dicts or tuples
    include_debug: bool = False

class VideoIdRequest(BaseModel):
    video_id: str

class RetrieveRequest(BaseModel):
    video_id: str
    chunk_index: Optional[int] = None

class MetadataRequest(BaseModel):
    video_id: str
    metadata: Dict[str, Any]

class IRRequest(BaseModel):
    ir: Union[Dict[str, Any], str]
    language: Optional[str] = "English"

class RecommendationRequest(BaseModel):
    ir: Union[Dict[str, Any], str]
    video_id: Optional[str] = None
    title: Optional[str] = None

class SearchContentRequest(BaseModel):
    query: str
    limit: int = 10
    threshold: float = 0.0
    user_id: Optional[str] = None
    max_duration: Optional[float] = None

class SearchVideoRequest(BaseModel):
    query: str
    limit: int = 10
    threshold: float = 0.0

class InteractionRequest(BaseModel):
    user_id: str
    video_id: str
    quiz_score: Optional[Union[float, int]] = None

class QuizScoreRequest(BaseModel):
    user_id: str
    video_id: str
    quiz_score: Union[float, int]

router = APIRouter()

# ============================================================================
# Utility Functions
# ============================================================================

def normalize_transcript_entries(entries: List[Any]) -> str:
    """
    Normalize transcript entries into formatted string.
    Supports:
    - Dict: {"text": "...", "start": 1.2, ...}
    - List/Tuple: [start, end, text]
    """
    normalized_lines: List[str] = []
    if not entries:
        return ""

    for entry in entries:
        start = None
        text = None

        # Format 1: [start, end, text]
        if isinstance(entry, (list, tuple)) and len(entry) >= 3:
            try:
                start = float(entry[0])
                text = str(entry[2])
            except (ValueError, IndexError):
                continue
        
        # Format 2: Dict {"start": ..., "text": ...}
        elif isinstance(entry, dict):
            try:
                # Handle start being string or float
                s_val = entry.get("start")
                if s_val is not None:
                    start = float(s_val)
                text = entry.get("text")
                if text is not None:
                    text = str(text)
            except ValueError:
                continue
                
        if start is None or not text:
            continue

        try:
            minutes = int(start) // 60
            seconds = int(start) % 60
            normalized_lines.append(f"[{minutes:02d}:{seconds:02d}] {text.strip()}")
        except Exception:
            continue

    return "\n".join(normalized_lines).strip()


def extract_input_content(data_dict: Dict[str, Any]) -> str:
    """Extract and normalize content based on input type."""
    input_type = data_dict.get("input_type")
    content = data_dict.get("content")
    entries = data_dict.get("entries")

    if input_type == "transcript":
        # Try plain text first
        if content and isinstance(content, str) and content.strip():
            return content.strip()
        # Fall back to structured entries
        elif entries:
            return normalize_transcript_entries(entries)
        else:
            raise ValueError("No transcript content provided")
    
    elif input_type == "description":
        if not content:
            raise ValueError("Content is required for description input")
        return content.strip()
    
    else:
        raise ValueError(f"Invalid input_type: {input_type}")

# ============================================================================
# Dependencies
# ============================================================================

def get_storage(request: Request) -> UnifiedChunkStorage:
    storage = getattr(request.app.state, "storage", None)
    if not storage:
        storage = UnifiedChunkStorage()
    return storage

def get_user_storage(request: Request) -> UserProfileStorage:
    storage = getattr(request.app.state, "user_storage", None)
    if not storage:
        storage = UserProfileStorage()
    return storage

def get_pool(request: Request):
    return getattr(request.app.state, "pool", None)

def get_executor(request: Request):
    return getattr(request.app.state, "executor", None)

# ============================================================================
# API Endpoints
# ============================================================================

# --- Core Ingestion & Processing ---

@router.post("/analyze")
async def analyze_content(
    payload: AnalyzeRequest,
    pool=Depends(get_pool)
) -> Dict[str, Any]:
    """
    Process transcript using the parallel summarization pipeline.
    """
    try:
        logger.info("Analyze: video_id=%s, input_type=%s", payload.video_id, payload.input_type)
        
        # Convert model to dict for data abstraction helper
        data_dict = payload.model_dump()
        content_text = extract_input_content(data_dict)
        
        if not content_text:
            raise HTTPException(status_code=400, detail="No content provided")

        input_type = payload.input_type
        video_id = payload.video_id
        
        # input_type check is technically handled by Pydantic Literal, but logic is fine
        
        # Pydantic model ensures video_id is present, so no need for explicit check here.

        agent_ir = IRAgent(pool=pool)
        
        transcript_entries = payload.entries

        if not transcript_entries and content_text:
            try:
                # If content_text came from 'content' string but was JSON
                if input_type == "transcript" and payload.content:
                     # Only attempt to parse if we don't have entries
                     try:
                        transcript_entries = json.loads(content_text)
                     except json.JSONDecodeError:
                        pass # It's just plain text or not JSON
            except Exception:
                pass
        
        pipeline_result = await agent_ir.generate_ir(
            transcript_text=content_text, 
            input_type=input_type, 
            video_id=video_id,
            transcript_entries=transcript_entries
        )
        
        chunks = pipeline_result["chunks"]
        logger.info("Analyze: video_id=%s completed, chunks=%d", video_id, len(chunks))
        
        response = {
            "content": pipeline_result["full_summary"],
            "chunk_count": len(chunks)
        }

        if payload.include_debug:
            response["chunks"] = chunks
            response["logs"] = pipeline_result.get("logs", [])
            response["cached"] = pipeline_result.get("cached", False)
            
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analyze endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# --- Storage & Data Management ---

@router.post("/storage_status")
async def storage_status(
    payload: VideoIdRequest,
    storage: UnifiedChunkStorage = Depends(get_storage)
) -> Dict[str, Any]:
    """Check if storage is complete for a video."""
    try:
        video_id = payload.video_id
        logger.debug("StorageStatus: video_id=%s", video_id)
        count = storage.get_chunk_count(video_id)
        return {"status": "success", "count": count, "video_id": video_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("StorageStatus endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


# Only for internal testing
@router.post("/retrieve")
async def retrieve_chunks(
    payload: RetrieveRequest,
    storage: UnifiedChunkStorage = Depends(get_storage)
) -> Dict[str, Any]:
    """Retrieve chunks for a video."""
    try:
        video_id = payload.video_id
        chunk_index = payload.chunk_index
        logger.debug("Retrieve: Request for video_id=%s, chunk_index=%s", video_id, chunk_index)

        if chunk_index is not None:
            chunk = storage.get_specific_chunk(video_id, chunk_index)
            if chunk:
                logger.debug("Retrieve: Successfully retrieved chunk %s for video_id=%s", chunk_index, video_id)
                return {"status": "success", "chunk": chunk}
            else:
                logger.debug("Retrieve: Chunk %s not found for video_id=%s", chunk_index, video_id)
                return {"status": "not_found", "detail": f"Chunk {chunk_index} not found for video {video_id}"}
        else:
            chunks = storage.get_chunks(video_id)
            logger.debug("Retrieve: Retrieved %d chunks for video_id=%s", len(chunks), video_id)
            return {"status": "success", "chunks": chunks, "count": len(chunks)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Retrieve endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(e)}")

# Only for internal testing
@router.post("/delete_embeddings")
async def delete_embeddings(
    payload: RetrieveRequest,
    storage: UnifiedChunkStorage = Depends(get_storage)
) -> Dict[str, Any]:
    """Delete embeddings for a video."""
    try:
        video_id = payload.video_id
        chunk_index = payload.chunk_index
        logger.debug("DeleteEmbeddings: video_id=%s, chunk_index=%s", video_id, chunk_index)

        if chunk_index is not None:
             result = storage.delete_chunks(video_id, chunk_index)
             return result
        else:
             result = storage.delete_chunks(video_id)
             return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("DeleteEmbeddings endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")

# Only for internal testing
@router.post("/store_metadata")
async def store_metadata(
    payload: MetadataRequest,
    storage: UnifiedChunkStorage = Depends(get_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Store rich video metadata (Pure Concept Vector)."""
    try:
        video_id = payload.video_id
        metadata = payload.metadata
        logger.debug("StoreMetadata: video_id=%s", video_id)
        
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(executor, storage.store_video_metadata, video_id, metadata)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("StoreMetadata endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Storage failed: {str(e)}")

# Only for internal testing
@router.post("/delete_metadata")
async def delete_metadata(
    payload: VideoIdRequest,
    storage: UnifiedChunkStorage = Depends(get_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Delete video metadata by ID."""
    try:
        video_id = payload.video_id
        logger.debug("DeleteMetadata: video_id=%s", video_id)
        
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(executor, storage.delete_video_metadata, video_id)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("DeleteMetadata endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")

# Only for internal testing
@router.get("/metadata/{video_id}")
async def get_metadata(
    video_id: str,
    storage: UnifiedChunkStorage = Depends(get_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Retrieve video metadata by ID."""
    try:
        logger.debug("GetMetadata: video_id=%s", video_id)
        loop = asyncio.get_running_loop()
        metadata = await loop.run_in_executor(executor, storage.get_video_metadata, video_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Metadata not found")
        
        return {"status": "success", "metadata": metadata}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("GetMetadata endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(e)}")


# --- Generation & Analysis ---
@router.post("/summarize")
async def summarize_from_ir(payload: IRRequest):
    async def generate():
        stop_event = threading.Event()
        try:
            ir_obj = payload.ir
            language = payload.language
            logger.debug("Summarize: language=%s", language)
            
            # Initialize agent
            writer = WriterAgent()

            # Start summary generation via WriterAgent (streaming)
            yield json.dumps({"type": "start_summary"}) + "\n"

            summary_accumulated = ""
            try:
                # Bridge blocking stream to async via a queue
                loop = asyncio.get_event_loop()
                chunk_queue: asyncio.Queue = asyncio.Queue(maxsize=100)

                def producer():
                    try:
                        ir_dict = ir_obj 
                        for chunk in writer.stream_module(ir_dict, language=language):
                            if stop_event.is_set():
                                break
                            
                            try:
                                # Use run_coroutine_threadsafe to wait for queue space (backpressure)
                                # If queue is full for 10s (client gone), we abort.
                                fut = asyncio.run_coroutine_threadsafe(chunk_queue.put(chunk), loop)
                                fut.result(timeout=10)
                            except (TimeoutError, Exception):
                                # Loop closed or timeout -> Abort
                                break
                    except Exception as e:
                        try:
                            # Try to send error if loop is still open
                            asyncio.run_coroutine_threadsafe(chunk_queue.put(f"__ERR__:{str(e)}"), loop).result(timeout=1)
                        except Exception:
                            pass
                    finally:
                        try:
                            asyncio.run_coroutine_threadsafe(chunk_queue.put(None), loop).result(timeout=1)
                        except Exception:
                            pass

                thread = threading.Thread(target=producer, daemon=True)
                thread.start()

                while True:
                    try:
                        chunk = await asyncio.wait_for(chunk_queue.get(), timeout=120)
                    except asyncio.TimeoutError:
                        yield json.dumps({"error": "Summary stream timed out"}) + "\n"
                        break
                    
                    if chunk is None:
                        break
                    if isinstance(chunk, str) and chunk.startswith("__ERR__:"):
                        yield json.dumps({"error": chunk.replace("__ERR__:", "", 1)}) + "\n"
                        break
                        
                    # Handle content vs usage events from the agent
                    if isinstance(chunk, dict):
                        if chunk.get("type") == "content":
                            summary_accumulated += chunk["payload"]
                            yield json.dumps({"type": "summary", "content": chunk["payload"]}) + "\n"
                        elif chunk.get("type") == "usage":
                            yield json.dumps({"type": "token_usage", "count": chunk["payload"]}) + "\n"
                        else:
                            # Fallback for unexpected dicts
                            summary_accumulated += str(chunk)
                            yield json.dumps({"type": "summary", "content": str(chunk)}) + "\n"
                    elif isinstance(chunk, str):
                        # Legacy DeepInfra wrapper (not used by agent but kept for safety)
                        if "choices" in chunk: # This check might need to be more robust if chunk is a string
                            yield json.dumps({"type": "summary", "content": chunk}) + "\n"
                        else:
                            # Fallback string
                            summary_accumulated += chunk
                            yield json.dumps({"type": "summary", "content": chunk}) + "\n"
                    else:
                        # Fallback for other types
                        summary_accumulated += str(chunk)
                        yield json.dumps({"type": "summary", "content": str(chunk)}) + "\n"
                
                if not summary_accumulated.strip():
                    logger.warning("Summarize: empty output")
                    yield json.dumps({"error": "Failed to generate summary"}) + "\n"
                    return

                logger.debug("Summarize: completed")
                yield json.dumps({
                    "type": "summary_complete",
                    "content": summary_accumulated
                }) + "\n"
            except Exception as e:
                yield json.dumps({"error": f"Error generating summary: {str(e)}"}) + "\n"
                return
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"
        finally:
            stop_event.set()
            # Drain queue to unblock any pending producer put
            # Not strictly necessary if producer checks stop_event, but good hygiene
            pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/recommendations")
async def recommendations_from_ir(
    background_tasks: BackgroundTasks,
    payload: RecommendationRequest,
    storage: UnifiedChunkStorage = Depends(get_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Generate recommendations from IR and optionally queue storage in background."""
    try:
        ir_obj = payload.ir
        video_id = payload.video_id
        logger.debug("Recommendations: video_id=%s", video_id)
        
        # 1. Check Cache first
        if video_id:
            try:
                loop = asyncio.get_running_loop()
                # Assuming get_executor is available here via Depends logic but here we are in main flow.
                # Since we didn't inject executor in signature yet, let's just use asyncio.to_thread 
                # OR better, stick to consistent pattern.
                # Actually, reading cache is fast. Let's keep asyncio.to_thread or inject executor.
                # Let's inject executor for consistency.
                pass 
            except Exception as e:
                pass
            except Exception as e:
                logger.debug("Cache check failed: %s", type(e).__name__)
                # Continue to generation if cache check fails

        title = payload.title
        agent_rec = RecommendationAgent()
        loop = asyncio.get_event_loop()
        recs = await loop.run_in_executor(None, agent_rec.generate_recommendations, ir_obj, None, 0.2, 1500, title)
        
        if not recs:
            logger.warning("Recommendations: generation failed for video_id=%s", video_id)
            raise HTTPException(status_code=500, detail="Failed to generate recommendations")
        
        logger.debug("Recommendations: generated for video_id=%s", video_id)
        
        # Auto-store if video_id is provided
        if video_id:
            try:
                logger.debug("Recommendations: queueing metadata storage")
                # Queue storage in background - use a copy to avoid persisting frontend-only flags
                # BackgroundTasks runs in a separate thread/pool managed by Starlette.
                # We don't strictly need our custom executor here as BackgroundTasks is already "background".
                # But to limit concurrency, we could wrap it. 
                # However, Starlette BackgroundTasks are simple add_task.
                # Let's leave background_tasks as is, it's efficient enough for now without blocking the request loop.
                background_tasks.add_task(storage.store_video_metadata, video_id, recs.copy())
                
                recs["_storage_status"] = {
                    "status": "queued",
                    "message": "Storage processing in background"
                }
            except Exception as e:
                logger.warning("Auto-storage queue failed: %s", type(e).__name__)
                recs["_storage_status"] = {"status": "error", "detail": str(e)}

        return recs
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz")
async def quiz_from_ir(payload: IRRequest) -> Dict[str, Any]:
    """Generate quiz from IR."""
    try:
        logger.debug("Quiz: starting generation")
        ir_obj = payload.ir
        agent3 = quiz_agent()
        loop = asyncio.get_event_loop()
        quiz = await loop.run_in_executor(None, agent3.generate_quiz, ir_obj)
        if not quiz:
             logger.warning("Quiz: generation failed")
             raise HTTPException(status_code=500, detail="Failed to generate quiz")
        
        logger.debug("Quiz: completed")
        
        # quiz_generator already returns a dict with 'content' and 'output_tokens'
        # Return it directly without wrapping
        return quiz

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Search & Discovery ---

# Search for video with matching covered content (In-Video Search)
@router.post("/search_content")
async def search_content(
    payload: SearchContentRequest,
    storage: UnifiedChunkStorage = Depends(get_storage),
    user_storage: UserProfileStorage = Depends(get_user_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Search for video content using natural language query."""
    try:
        query = payload.query
        limit = payload.limit
        threshold = payload.threshold
        user_id = payload.user_id # Optional: for scoped search
        logger.debug("SearchContent: user_id=%s, limit=%d", user_id, limit)

        # Pydantic model ensures query is present, so no need for explicit check here.

        # Handle Scoped Search
        allowed_ids = None
        if user_id:
             # Fetch history
             allowed_ids = await asyncio.to_thread(user_storage.get_watched_video_ids, user_id)
             
             # Edge case: If user provided but has no history, return empty immediately
             if not allowed_ids:
                 logger.debug("SearchContent: User %s has no watch history", user_id)
                 return {"status": "success", "results": [], "detail": "User has no watch history"}

             if not allowed_ids:
                 return {"status": "success", "results": [], "detail": "User has no watch history"}

        # Use executor for search (it involves embedding + vector search)
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            executor,
            lambda: storage.search_similar_chunks(
                query, 
                limit=limit, 
                score_threshold=threshold,
                allowed_video_ids=allowed_ids
            )
        )
        logger.debug("SearchContent: found %d results", len(results))
        return {"status": "success", "results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("SearchContent endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# Search for videos based on metadata match (Similar Video Search)
@router.post("/search_videos")
async def search_videos(
    payload: SearchVideoRequest,
    storage: UnifiedChunkStorage = Depends(get_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """
    Search for videos based on semantic metadata match (Concept Search).
    Returns top matching Video IDs.
    """

    try:
        query = payload.query
        limit = payload.limit
        threshold = payload.threshold
        logger.debug("SearchVideos: limit=%d", limit)

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            executor,
            storage.search_video_metadata,
            query, 
            limit,
            threshold
        )
        logger.debug("SearchVideos: found %d results", len(results))
        return {"status": "success", "results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("SearchVideos endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# --- User History & Profiles ---

@router.post("/track_interaction")
async def track_interaction(
    payload: InteractionRequest,
    storage: UnifiedChunkStorage = Depends(get_storage),
    user_storage: UserProfileStorage = Depends(get_user_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Log a user interaction."""
    try:
        logger.debug("TrackInteraction: user_id=%s", payload.user_id)
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            executor,
            user_storage.add_interaction,
            payload.user_id,
            payload.video_id,
            payload.quiz_score,
            storage
        )
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail="Interaction tracking failed")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("TrackInteraction failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/update_quiz_score")
async def update_quiz_score(
    payload: QuizScoreRequest,
    user_storage: UserProfileStorage = Depends(get_user_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Update a quiz score."""
    try:
        logger.debug("UpdateQuizScore: user_id=%s", payload.user_id)
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            executor,
            user_storage.update_quiz_score,
            payload.user_id,
            payload.video_id,
            payload.quiz_score
        )
        if result.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="Interaction not found for this user and video")
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail="Quiz score update failed")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("UpdateQuizScore failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user_history/{user_id}")
async def get_user_history(
    user_id: str,
    user_storage: UserProfileStorage = Depends(get_user_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Get full learning history for a user."""
    try:
        logger.debug("UserHistory: user_id=%s", user_id)
        loop = asyncio.get_running_loop()
        history = await loop.run_in_executor(
            executor,
            user_storage.get_user_history,
            user_id
        )
        return {"user_id": user_id, "history": history}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("UserHistory failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user_profile/{user_id}")
async def get_user_profile(
    user_id: str,
    user_storage: UserProfileStorage = Depends(get_user_storage),
    executor = Depends(get_executor)
) -> Dict[str, Any]:
    """Compute full MDPC user profile (ability, preferences, comfort, semantic vector)."""
    try:
        logger.debug("UserProfile: user_id=%s", user_id)
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            executor,
            user_storage.get_user_profile,
            user_id
        )
        if result.get("status") == "not_found":
            raise HTTPException(status_code=404, detail="No interactions found for this user")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("UserProfile failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

