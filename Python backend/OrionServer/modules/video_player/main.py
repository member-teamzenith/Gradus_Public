"""
Orion API - FastAPI application for video transcript analysis
Provides endpoints for IR generation, summarization, recommendations, and quiz generation.
"""

# Standard library imports
import asyncio
import json
import logging
import os
import threading
import traceback
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Third-party imports
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

# Local imports
from ir_agent import IRAgent
from writer_agent import WriterAgent
from recommendation_agent import RecommendationAgent
from quiz_generator import quiz_agent
from Chunking_Embedding_Processor.summarization_worker import SummarizationPool
from Chunking_Embedding_Processor.unified_storage import UnifiedChunkStorage
from Chunking_Embedding_Processor.user_profile_storage import UserProfileStorage

# ============================================================================
# FastAPI Application Setup
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Video Player server starting...")
    
    # Initialize Global Worker Pool
    app.state.pool = SummarizationPool(num_workers=5)
    await app.state.pool.start()
    logger.info("Summarization Pool started")

    # Initialize Unified Storage
    app.state.storage = UnifiedChunkStorage()
    logger.info("Unified Storage initialized")
    
    # Initialize User Profile Storage
    app.state.user_storage = UserProfileStorage()
    logger.info("User Profile Storage initialized")
    
    yield
    
    logger.info("Video Player server shutting down...")
    await app.state.pool.stop()
    logger.info("Summarization Pool stopped")

app = FastAPI(
    title="Orion API",
    description="Video transcript analysis and learning module generation",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Utility Functions
# ============================================================================

def normalize_transcript_entries(entries: List[Any]) -> str:
    """
    Normalize transcript entries into formatted string.
    Supports:
    - Dict: {"text": "...", "start": 1.2, ...}
    - List/Tuple: [start, end, text] (e.g. [0.16, 5.08, "text"])
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


def extract_input_content(data: Dict[str, Any]) -> str:
    """Extract and normalize content based on input type."""
    input_type = data.get("input_type")
    content = data.get("content")
    entries = data.get("entries")

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
# API Endpoints
# ============================================================================

# --- System & Health ---

@app.get("/health")
async def health() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


# --- Core Ingestion & Processing ---

@app.post("/analyze")
async def analyze_content(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Process transcript using the parallel summarization pipeline.
    Returns the aggregated summary string.
    """
    try:
        # Extract and normalize content based on input type
        content_text = extract_input_content(payload)
        
        if not content_text:
            raise HTTPException(status_code=400, detail="No content provided")

        # Extract metadata
        title = payload.get("title") or "Untitled Video"
        input_type = payload.get("input_type")
        video_id = payload.get("video_id")
        
        if input_type != "transcript":
             raise HTTPException(status_code=400, detail="Only 'transcript' input is supported for this pipeline.")
        
        if not video_id:
             raise HTTPException(status_code=400, detail="video_id is required.")

        # Pass the global pool to the agent
        pool = getattr(app.state, "pool", None)
        agent_ir = IRAgent(pool=pool)
        
        # We need to pass the structured entries if available
        transcript_entries = payload.get("entries")

        # If entries are not provided, try to parse from content_text
        if not transcript_entries and content_text:
            try:
                transcript_entries = json.loads(content_text)
            except json.JSONDecodeError:
                # If parsing fails, raise a clear error
                raise HTTPException(status_code=400, detail="Invalid JSON format in transcript content.")
        
        # Execute Pipeline
        pipeline_result = await agent_ir.generate_ir(
            transcript_text=content_text, 
            title=title, 
            input_type=input_type, 
            video_id=video_id,
            transcript_entries=transcript_entries
        )
        
        # Return the summary string wrapped in a dict
        return {
            "content": pipeline_result["full_summary"],
            "chunks": pipeline_result["chunks"],
            "logs": pipeline_result.get("logs", []),
            "cached": pipeline_result.get("cached", False),
            "input_tokens": 0 
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analyze endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# --- Storage & Data Management ---

@app.post("/storage_status")
async def storage_status(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Check if storage is complete for a video.
    Returns the count of chunks stored.
    """
    try:
        video_id = payload.get("video_id")
        if not video_id:
            raise HTTPException(status_code=400, detail="video_id is required")

        storage: UnifiedChunkStorage = getattr(app.state, "storage", None)
        if not storage:
             storage = UnifiedChunkStorage()

        count = storage.get_chunk_count(video_id)
        return {"status": "success", "count": count, "video_id": video_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("StorageStatus endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@app.post("/retrieve")
async def retrieve_chunks(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Retrieve chunks for a video.
    Required: video_id
    Optional: chunk_index (if provided, returns specific chunk, else returns all)
    """
    try:
        video_id = payload.get("video_id")
        chunk_index = payload.get("chunk_index")

        if not video_id:
            raise HTTPException(status_code=400, detail="video_id is required")

        storage: UnifiedChunkStorage = getattr(app.state, "storage", None)
        if not storage:
             # Fallback if not initialized (though lifespan should handle it)
             storage = UnifiedChunkStorage()

        if chunk_index is not None:
            # Retrieve specific chunk
            try:
                idx = int(chunk_index)
                chunk = storage.get_specific_chunk(video_id, idx)
                if chunk:
                    return {"status": "success", "chunk": chunk}
                else:
                    return {"status": "not_found", "detail": f"Chunk {idx} not found for video {video_id}"}
            except ValueError:
                 raise HTTPException(status_code=400, detail="chunk_index must be an integer")
        else:
            # Retrieve all chunks
            chunks = storage.get_chunks(video_id)
            return {"status": "success", "chunks": chunks, "count": len(chunks)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Retrieve endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(e)}")


@app.post("/delete_embeddings")
async def delete_embeddings(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Delete embeddings for a video.
    Required: video_id
    Optional: chunk_index (if provided, deletes specific chunk, else deletes all)
    """
    try:
        video_id = payload.get("video_id")
        chunk_index = payload.get("chunk_index")

        if not video_id:
            raise HTTPException(status_code=400, detail="video_id is required")

        storage: UnifiedChunkStorage = getattr(app.state, "storage", None)
        if not storage:
             storage = UnifiedChunkStorage()

        if chunk_index is not None:
             try:
                 idx = int(chunk_index)
                 return storage.delete_chunks(video_id, idx)
             except ValueError:
                 raise HTTPException(status_code=400, detail="chunk_index must be an integer")
        else:
             return storage.delete_chunks(video_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("DeleteEmbeddings endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")


# --- Generation & Analysis ---

@app.post("/summarize")
async def summarize_from_ir(payload: Dict[str, Any] = Body(...)):
    async def generate():
        try:
            # Validate IR presence
            logger.debug("Summarize: payload keys=%s", list(payload.keys()))
            ir_obj = payload.get("ir")
            language = payload.get("language", "English")
            logger.debug("Summarize: language=%s", language)
            # if not ir_obj:
            #     yield json.dumps({"error": "No IR provided"}) + "\n"
            #     return

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
                        ir_dict = ir_obj # It's already a dict
                        for chunk in writer.stream_module(ir_dict, language=language):
                            try:
                                # Put without blocking the producer thread indefinitely
                                loop.call_soon_threadsafe(chunk_queue.put_nowait, chunk)
                            except Exception:
                                break
                    except Exception as e:
                        # Surface producer errors to the async consumer loop
                        try:
                            loop.call_soon_threadsafe(chunk_queue.put_nowait, f"__ERR__:{str(e)}")
                        except Exception:
                            pass
                    finally:
                        loop.call_soon_threadsafe(chunk_queue.put_nowait, None)

                thread = threading.Thread(target=producer, daemon=True)
                thread.start()

                while True:
                    try:
                        # Apply a guard timeout so we don't hang forever on stalled streams
                        chunk = await asyncio.wait_for(chunk_queue.get(), timeout=120)
                    except asyncio.TimeoutError:
                        yield json.dumps({"error": "Summary stream timed out"}) + "\n"
                        break
                    if chunk is None:
                        break
                    if isinstance(chunk, str) and chunk.startswith("__ERR__:"):
                        yield json.dumps({"error": chunk.replace("__ERR__:", "", 1)}) + "\n"
                        break
                    summary_accumulated += chunk
                    yield json.dumps({
                        "type": "summary",
                        "content": chunk
                    }) + "\n"
                

                if not summary_accumulated.strip():
                    yield json.dumps({"error": "Failed to generate summary"}) + "\n"
                    return

                yield json.dumps({
                    "type": "summary_complete",
                    "content": summary_accumulated
                }) + "\n"
            except Exception as e:
                yield json.dumps({"error": f"Error generating summary: {str(e)}"}) + "\n"
                return
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/recommendations")
async def recommendations_from_ir(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Generate recommendations from IR."""
    try:
        ir_obj = payload.get("ir")
        # if not ir_obj:
        #     raise HTTPException(status_code=400, detail="No IR provided")

        agent_rec = RecommendationAgent()
        loop = asyncio.get_event_loop()
        # ir_obj is already a dict
        recs = await loop.run_in_executor(None, agent_rec.generate_recommendations, ir_obj)
        if not recs:
            raise HTTPException(status_code=500, detail="Failed to generate recommendations")
        return recs
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quiz")
async def quiz_from_ir(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Generate quiz from IR."""
    try:
        ir_obj = payload.get("ir")
        # if not ir_obj:
        #     raise HTTPException(status_code=400, detail="No IR provided")

        logger.debug("Quiz: received IR data")
        
        # Generate quiz from IR
        agent3 = quiz_agent()
        loop = asyncio.get_event_loop()
        # ir_obj is already a dict
        quiz = await loop.run_in_executor(None, agent3.generate_quiz, ir_obj)
        
        logger.debug("Quiz: generated")
        
        if not quiz:
             raise HTTPException(status_code=500, detail="Failed to generate quiz")
        
        # Ensure the response is properly structured
        response_data = {
            "content": str(quiz.get("content", "")),
            "output_tokens": int(quiz.get("output_tokens", 0))
        }
        
        return JSONResponse(content=response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Quiz endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=str(e))


# --- Search & Discovery ---

@app.post("/search_content")
async def search_content(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Search for video content using natural language query.
    Required: query
    Optional: limit (default 5), threshold (default 0.0)
    """
    try:
        query = payload.get("query")
        limit = payload.get("limit", 5)
        threshold = payload.get("threshold", 0.0)
        max_duration = payload.get("max_duration") # Optional: in seconds
        user_id = payload.get("user_id") # Optional: for scoped search

        if not query:
            raise HTTPException(status_code=400, detail="query is required")

        storage: UnifiedChunkStorage = getattr(app.state, "storage", None)
        if not storage:
            storage = UnifiedChunkStorage()

        # Handle Scoped Search
        allowed_ids = None
        if user_id:
             user_storage: UserProfileStorage = getattr(app.state, "user_storage", None)
             if not user_storage:
                 user_storage = UserProfileStorage()
             
             # Fetch history
             allowed_ids = await asyncio.to_thread(user_storage.get_watched_video_ids, user_id)
             
             # Edge case: If user provided but has no history, return empty immediately
             if not allowed_ids:
                 return {"status": "success", "results": [], "detail": "User has no watch history"}

        results = storage.search_similar_chunks(
            query, 
            limit=limit, 
            score_threshold=threshold,
            max_duration=float(max_duration) if max_duration is not None else None,
            allowed_video_ids=allowed_ids
        )
        return {"status": "success", "results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("SearchContent endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/search_videos")
async def search_videos(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Search for videos based on semantic metadata match (Concept Search).
    Returns top matching Video IDs.
    Required: query
    Optional: limit (default 10), threshold (default 0.0)
    """
    try:
        query = payload.get("query")
        limit = payload.get("limit", 10)
        threshold = payload.get("threshold", 0.0)

        if not query:
            raise HTTPException(status_code=400, detail="query is required")

        storage: UnifiedChunkStorage = getattr(app.state, "storage", None)
        if not storage:
            storage = UnifiedChunkStorage()

        results = await asyncio.to_thread(
            storage.search_video_metadata,
            query_text=query,
            limit=limit,
            score_threshold=threshold
        )
        return {"status": "success", "results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("SearchVideos endpoint error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# --- User History & Profiles ---

@app.post("/track_interaction")
async def track_interaction(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Log a user interaction.
    Required: user_id, video_id
    Optional: quiz_score
    """
    try:
        user_id = payload.get("user_id")
        video_id = payload.get("video_id")
        if not user_id or not video_id:
            raise HTTPException(status_code=400, detail="user_id and video_id are required")

        storage: UnifiedChunkStorage = getattr(app.state, "storage", None)
        if not storage:
            storage = UnifiedChunkStorage()

        user_storage: UserProfileStorage = getattr(app.state, "user_storage", None)
        if not user_storage:
            user_storage = UserProfileStorage()
            
        result = await asyncio.to_thread(
            user_storage.add_interaction,
            user_id=user_id,
            video_id=video_id,
            quiz_score=payload.get("quiz_score"),
            unified_storage=storage
        )
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail="Interaction tracking failed")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("TrackInteraction failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/update_quiz_score")
async def update_quiz_score(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Update a quiz score for an existing interaction.
    """
    try:
        user_id = payload.get("user_id")
        video_id = payload.get("video_id")
        quiz_score = payload.get("quiz_score")
        if not user_id or not video_id or quiz_score is None:
            raise HTTPException(status_code=400, detail="user_id, video_id, and quiz_score are required")

        user_storage: UserProfileStorage = getattr(app.state, "user_storage", None)
        if not user_storage:
             user_storage = UserProfileStorage()

        result = await asyncio.to_thread(
            user_storage.update_quiz_score,
            user_id=user_id,
            video_id=video_id,
            new_score=quiz_score
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


@app.get("/user_history/{user_id}")
async def get_user_history(user_id: str) -> Dict[str, Any]:
    """Get full learning history for a user."""
    try:
        user_storage: UserProfileStorage = getattr(app.state, "user_storage", None)
        if not user_storage:
             user_storage = UserProfileStorage()

        history = await asyncio.to_thread(
            user_storage.get_user_history,
            user_id=user_id
        )
        return {"user_id": user_id, "history": history}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("UserHistory failed: %s", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)