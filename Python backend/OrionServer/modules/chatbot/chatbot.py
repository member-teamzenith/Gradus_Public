"""
Chatbot Core Logic - IR-First Retrieval Architecture

This module contains the core chatbot logic, data models, and business functions
that are used by the FastAPI server. It implements a LangGraph-based chatbot 
that uses Video IR first, then falls back to transcript retrieval when needed.

The chatbot uses a hybrid storage system:
- Redis: Hot cache for active conversations (0-3 hours)
- Qdrant: Vector search for recent chats (12 hours to 7 days)  
- Firebase: Long-term durable storage (7+ days)

Chat sessions are identified by a unique chat_id generated from user_id and video_id.
Format: {user_id}::CHAT::{video_id}
"""

from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Generator, TypedDict, Tuple
from datetime import datetime
import time
import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# LangGraph imports
try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    # reduce noise

# Import our chunking and embedding modules
# Removed unused validators; IR/transcript validation is disabled for normal operation

# Import chatbot utilities
from chatbot_utils import (
    AnsweringClient,
    VisionClient,
    MemorySummarizer
)
from chatbot_utils.ir_selector import IRSelectorAgent, get_shared_ir_selector
from utils.qdrant import get_qdrant_client
from chatbot_utils.embedding_client import DeepInfraEmbeddingClient, get_shared_embedding_client

# Import hybrid storage system
from Storage import HybridChatStorage
from Storage import R2Storage
from Storage.migration_manager import MigrationManager

# Initialize global storage instance
hybrid_storage = HybridChatStorage()

# ============================================================================
# GLOBAL THREAD POOL (Singleton)
# ============================================================================
# OPTIMIZATION: Reuse thread pool across all requests instead of creating per-request.
# This avoids ~3-15ms overhead per request from thread creation/destruction.
# Thread-safe: ThreadPoolExecutor handles concurrent task submission internally.
# ============================================================================
_chatbot_thread_pool: Optional[ThreadPoolExecutor] = None

def get_chatbot_thread_pool() -> ThreadPoolExecutor:
    """Get or create the global chatbot thread pool (singleton).
    
    Thread pool is shared across all chat requests for:
    - Vision context fetching
    - IR selection pipeline
    
    Workers: 8 threads (handles ~4 concurrent full-parallel requests)
    Beyond that, tasks queue up which is acceptable for I/O-bound LLM calls.
    """
    global _chatbot_thread_pool
    if _chatbot_thread_pool is None:
        _chatbot_thread_pool = ThreadPoolExecutor(
            max_workers=8,
            thread_name_prefix="chatbot-worker"
        )
        logger.info("[CHATBOT] Global thread pool initialized (8 workers)")
    return _chatbot_thread_pool

def shutdown_chatbot_thread_pool():
    """Gracefully shutdown the global thread pool. Call on app shutdown."""
    global _chatbot_thread_pool
    if _chatbot_thread_pool is not None:
        _chatbot_thread_pool.shutdown(wait=True)
        _chatbot_thread_pool = None
        logger.info("[CHATBOT] Global thread pool shutdown complete")

# LangGraph State Definition
class ChatState(TypedDict):
    """State for the chat graph."""
    chat_id: str
    user_message: str
    chat_history: List[Dict[str, Any]]
    video_context: Optional[Dict[str, Any]]
    vision_context: Optional[Dict[str, Any]]
    attachment: Optional[Dict[str, Any]]
    llm_response: str
    messages: List[Dict[str, str]]  # For LangGraph message format
    total_tokens: int  # Simple running total of all tokens

# LLM Client is now imported from chatbot_utils

# LangGraph Node Functions

def _detect_conversational_intent(message: str) -> bool:
    """Speculative Execution: Returns True if message is likely meta/chitchat (skip IR retrieval).
    
    Meta queries don't need video context - Orion can answer from persona alone.
    This saves ~500ms+ per meta query by skipping IR selector LLM call.
    """
    if not message:
        return True
    msg = message.strip().lower()
    
    # Length heuristic: very short messages are usually phatic
    if len(msg) < 4:
        return True
    
    # Strip punctuation for matching
    msg_clean = msg.rstrip('?!.,;:')
    
    # Exact match phrases (greetings, acknowledgments, farewells)
    meta_exact = {
        # Greetings
        "hi", "hello", "hey", "hii", "hiii", "yo", "sup",
        "good morning", "good afternoon", "good evening", "good night",
        "namaste", "namaskar",
        # Acknowledgments
        "thanks", "thank you", "thanks a lot", "thank you so much",
        "ok", "okay", "k", "cool", "nice", "great", "awesome", "got it",
        "understood", "i see", "makes sense", "perfect", "alright",
        # Farewells
        "bye", "goodbye", "see you", "later", "take care",
        # Affirmations
        "yes", "yeah", "yep", "yup", "no", "nope", "nah",
    }
    if msg_clean in meta_exact:
        return True
    
    # Prefix patterns (identity/capability questions about Orion)
    meta_prefixes = (
        "who are you", "what are you", "what's your name", "whats your name",
        "are you a", "are you an", "are you human", "are you ai", "are you bot",
        "what can you do", "how can you help", "what do you do",
        "tell me about yourself", "introduce yourself",
        "can you help", "will you help",
        "how are you", "how r u", "how do you work",
    )
    if msg_clean.startswith(meta_prefixes):
        return True
    
    # Contains patterns (commonly embedded in longer messages)
    meta_contains = (
        "your name", "who r u", "who ru",
    )
    for pattern in meta_contains:
        if pattern in msg_clean:
            return True
    
    # Single word follow-ups that don't need fresh context
    single_word_meta = {"what", "why", "how", "huh", "hmm", "oh", "ah", "wow"}
    if msg_clean in single_word_meta and len(msg_clean) <= 4:
        return True
    
    return False

def _detect_jailbreak(message: str) -> bool:
    """Layer 1 Security: Detect basic prompt injection attacks."""
    if not message: return False
    msg = message.lower()
    triggers = [
        "ignore previous instructions",
        "ignore all instructions",
        "system prompt",
        "reveal your instructions",
        "you are now dan",
        "developer mode",
        "repeat the words above"
    ]
    for t in triggers:
        if t in msg: return True
    return False

def context_assembler_node(state: ChatState) -> ChatState:
    """Context assembler node: fetches last 3 pairs (6 messages) from chat history."""
    # LAYER 1: FIREWALL
    if _detect_jailbreak(state.get("user_message", "")):
        logger.warning("[SECURITY] 🛡️ Jailbreak attempt blocked.")
        # Return special state to trigger rejection
        state["llm_response"] = "I'm focusing purely on this video to give you the best learning experience. Let me know if you have specific questions about the content!"
        state["messages"] = [] # Skip LLM
        # Hack: Set flag to skip generation node
        state["security_blocked"] = True
        return state

    chat_id = state["chat_id"]
    
    # QUERY EXPANSION: Enhance retrieval query with Vision Context if present
    # This ensures the Retriever finds relevant chunks even if the user query is generic ("explain this")
    query_for_retrieval = state.get("user_message", "")
    vis_ctx = state.get("vision_context")
    if vis_ctx and isinstance(vis_ctx, dict):
        # Extract vision text
        v_text = vis_ctx.get("vision", "")
        # Handle legacy
        if not v_text:
             try: v_text = (vis_ctx.get("raw") or {}).get("response", "")
             except: pass
        
        if v_text:
            # Append full XML vision context (up to 1500 chars to preserve tags)
            query_for_retrieval = f"{query_for_retrieval}\n\n[Context from Image]: {v_text[:1500]}"
            logger.debug("[OPTIMIZATION] ⚡ Expanded Retrieval Query with Vision Context (+{len(v_text[:1500])} chars)")
    video_context = get_video_context(chat_id)
    chat_history: List[Dict[str, Any]] = []
    vision_context = None
    last_image_url = None

    # Single history fetch - used for both chat context AND prev_context for IR selector
    # OPTIMIZATION: Previously fetched twice (limit=2 sync + limit=6 parallel). Now single fetch.
    prev_context_str = None
    prefetched_history = []
    try:
        hist_fast = hybrid_storage.get_chat_history_fast(chat_id, limit=6)
        prefetched_history = (hist_fast or {}).get("history", [])
        # Extract last 2 messages for IR selector spatial awareness
        if len(prefetched_history) >= 2:
            last_msgs = prefetched_history[-2:]
            prev_context_str = f"User: {last_msgs[-2].get('content','')}\nOrion: {last_msgs[-1].get('content','')}"
    except Exception:
        pass

    def _task_vision():
        try:
             if state.get("vision_context"):
                 logger.debug("[OPTIMIZATION] Using fresh vision context")
                 return state["vision_context"]
             return {"vision": None, "url": None}
        except: return {"vision": None, "url": None}

    def _task_ir_selection(query_str: str, prev_context: Optional[str] = None):
        try:
            vid = chat_id.split("::")[-1]
            # 1. Cache Check (Redis)
            cached = _get_cached_ir_chunks(vid)
            chunks = []
            if cached: chunks = cached
            else:
                 chunks = fetch_video_chunks(vid)
                 if chunks: _set_cached_ir_chunks(vid, chunks)

            if not chunks: return {"raw": "", "compact": ""}

            # 2. Build INDEX sections for selector (concise 5-6 sentence summaries)
            logger.debug("[IR DEBUG] Retrieved {len(chunks)} chunks from storage for video {vid}")
            
            # Debug: Check what fields are actually in the chunks
            if chunks:
                sample = chunks[0]
                logger.debug("[IR DEBUG] Sample chunk 0 keys: {list(sample.keys())}")
                has_content = "content" in sample and sample.get("content")
                logger.debug("[IR DEBUG] Has 'content' field with data: {has_content}")
                if has_content:
                    content_sample = sample["content"]
                    logger.debug("[IR DEBUG] Content type: {type(content_sample)}, length: {len(content_sample) if content_sample else 0}")
                    if content_sample and len(content_sample) > 0:
                        logger.debug("[IR DEBUG] First content entry: {content_sample[0]}")
                else:
                    logger.debug("[IR DEBUG] ⚠️ WARNING: 'content' field is MISSING or EMPTY - raw transcript unavailable!")
            
            indices_for_selector = []
            chunk_map = {}
            for c in chunks:
                try:
                    idx = int(c.get("chunk_index"))
                    chunk_map[idx] = c
                    # Use index_text (concise INDEX) for selection; fallback to summary_text
                    index_section = c.get("index_text") or c.get("summary_text") or "No index available."
                    indices_for_selector.append({
                        "index": idx,
                        "summary": index_section  # Field name kept for backward compat with selector
                    })
                    
                    # Debug: Show first chunk's data structure
                    if idx == 0:
                        logger.debug("[IR DEBUG] Sample chunk {idx} keys: {list(c.keys())}")
                        logger.debug("[IR DEBUG] Sample chunk {idx} index_text length: {len(index_section)} chars")
                        logger.debug("[IR DEBUG] Sample chunk {idx} index_text preview: {index_section[:200]}...")
                        
                except Exception as e:
                    logger.debug("[IR DEBUG] Failed to process chunk: {e}")
                    pass
            indices_for_selector.sort(key=lambda x: x["index"])
            
            logger.debug("[IR DEBUG] Prepared {len(indices_for_selector)} index sections for selector")
            if indices_for_selector:
                logger.debug("[IR DEBUG] Index range: {indices_for_selector[0]['index']} to {indices_for_selector[-1]['index']}")

            # 3. Cache & Selector Logic
            selected_items = []
            cached_sel = _get_cached_selector_result(vid, query_str)
            
            if cached_sel:
                logger.debug("[IR DEBUG] Using cached selector result: {len(cached_sel)} chunks")
                selected_items = cached_sel
            else:
                # Always use selector for intelligent chunk selection
                # Selector sees ALL chunks and decides relevance + detail level
                if indices_for_selector:
                    logger.debug("[IR DEBUG] Calling selector with query: '{query_str[:100]}...'")
                    logger.debug("[IR DEBUG] Previous context length: {len(prev_context) if prev_context else 0} chars")
                    selector = get_shared_ir_selector()  # OPTIMIZATION: Reuse singleton
                    try:
                        selected_items = selector.select_sections(query_str, indices_for_selector, prev_context)
                        logger.debug("[IR DEBUG] Selector returned {len(selected_items)} items")
                    except Exception as e:
                        logger.debug("[IR DEBUG] Selector FAILED with error: {e}")
                        import traceback
                        traceback.print_exc()
                        # Fallback: select first 5 chunks with brief if selector fails
                        selected_items = [{"index": s["index"], "needs_detail": False} for s in indices_for_selector[:5]]
                        logger.debug("[IR DEBUG] Using fallback: first 5 chunks (approx 15m)")
                else:
                    logger.debug("[IR DEBUG] No indices_for_selector available!")

            # 4. SAFETY VALVE (Token Budget Enforcement)
            if selected_items:
                _set_cached_selector_result(vid, query_str, selected_items)
            
            if len(selected_items) > 8:
                # Hybrid Safety Valve: Allow max 3 full transcripts, squash rest to summary
                logger.debug("[OPTIMIZATION] 📉 High chunk count ({len(selected_items)}). Enforcing Max 3 Details.")
                detail_cnt = 0
                for item in selected_items:
                    if item.get("needs_detail", True):
                        if detail_cnt < 3:
                            detail_cnt += 1
                        else:
                            item["needs_detail"] = False
            
            # 5. Format Output
            final_raw = []
            final_compact = []
            
            # Detect Strategy
            strategy_label = "Standard Retrieval"
            detail_count = sum(1 for item in selected_items if item.get("needs_detail"))
            if len(selected_items) > 5:
                strategy_label = "Exhaustive Mode (Broad Coverage)"
            elif detail_count > 0:
                strategy_label = "Deep Dive Mode (Raw Transcript)"
            else:
                strategy_label = "Brief Mode (Dense Summaries)"
                
            header = f"## RETRIEVAL STRATEGY: {strategy_label}\n"
            
            for item in selected_items:
                idx = item["index"]
                needs_detail = item.get("needs_detail", False)
                chunk = chunk_map.get(idx)
                if not chunk: continue
                
                m, s = divmod(int(chunk.get("start_time", 0)), 60)
                ts_str = f"[{m:02d}:{s:02d}]"
                
                # Compact view always uses index_text (concise)
                index_text = chunk.get("index_text") or chunk.get("summary_text") or ""
                final_compact.append(f"{ts_str} {index_text}")
                
                # Full content retrieval based on detail flag
                if needs_detail:
                    # DETAILED: Raw transcript ONLY from 'content' field
                    content_entries = chunk.get("content")
                    logger.debug("[IR DEBUG] Chunk {idx} needs_detail=True, content field type: {type(content_entries)}, entries: {len(content_entries) if content_entries else 0}")
                    if content_entries and isinstance(content_entries, list):
                        # Join transcript text WITH timestamps [MM:SS] for precise referencing
                        def format_timestamp(seconds: float) -> str:
                            mins = int(seconds // 60)
                            secs = int(seconds % 60)
                            return f"[{mins:02d}:{secs:02d}]"
                        
                        transcript_lines = []
                        for entry in content_entries:
                            if isinstance(entry, list) and len(entry) > 2:
                                ts = format_timestamp(entry[0])  # Use start timestamp
                                text = entry[2]
                                transcript_lines.append(f"{ts} {text}")
                            else:
                                transcript_lines.append(str(entry))
                        content = "\n".join(transcript_lines)
                        logger.debug("[IR DEBUG] Chunk {idx} raw transcript length: {len(content)} chars")
                        logger.debug("[IR DEBUG] Chunk {idx} transcript preview: {content[:300]}...")
                    else:
                        # Fallback to summary_text if content not available
                        content = chunk.get("summary_text") or ""
                        logger.debug("[IR DEBUG] Chunk {idx} FALLBACK to summary_text (content unavailable): {len(content)} chars")
                    final_raw.append(f"{ts_str} [DETAILED]\n{content}")
                else:
                    # BRIEF: summary_text ONLY (no index_text, no transcript)
                    content = chunk.get("summary_text") or ""
                    if not content:
                        logger.debug("[IR DEBUG] Chunk {idx} WARNING: summary_text is empty!")
                    final_raw.append(f"{ts_str} [BRIEF]\n{content}")
            
            final_raw.insert(0, header)
            
            # Debug: Show final output before return
            raw_output = "\n\n".join(final_raw)
            compact_output = "\n".join(final_compact)
            logger.debug("[IR DEBUG] final_raw entries: {len(final_raw)}, total chars: {len(raw_output)}")
            logger.debug("[IR DEBUG] final_compact entries: {len(final_compact)}, total chars: {len(compact_output)}")
            
            return {"raw": raw_output, "compact": compact_output}

        except Exception as e:
            logger.error("[IR TASK ERROR] {e}")
            return {"raw": "", "compact": ""}

    # Check if this is a meta/greeting query that doesn't need video context
    is_meta_query = _detect_conversational_intent(state.get("user_message", ""))
    
    # OPTIMIZATION: History already pre-fetched above. Only parallelize vision + IR.
    chat_history = prefetched_history
    
    # Use global thread pool instead of creating per-request (saves ~3-15ms)
    pool = get_chatbot_thread_pool()
    fut_vis = pool.submit(_task_vision)
    
    fut_ir = None
    if not is_meta_query:
        # Knowledge query - run full IR pipeline
        fut_ir = pool.submit(_task_ir_selection, query_for_retrieval, prev_context_str)
    else:
        logger.debug("[OPTIMIZATION] ⚡ Meta/greeting query detected - skipping IR pipeline")
    
    try:
        vis_res = fut_vis.result(timeout=5)
        vision_context = (vis_res or {}).get("vision")
        last_image_url = (vis_res or {}).get("url")
    except Exception:
        vision_context = None
        last_image_url = None
    try:
        ir_res = (fut_ir.result(timeout=75) if fut_ir else {}) or {}
        ir_compact = ir_res.get("compact", "")
        ir_raw = ir_res.get("raw", "")
        
        # Debug: Show what's being returned from IR task
        logger.debug("[IR DEBUG] ir_res keys: {list(ir_res.keys())}")
        logger.debug("[IR DEBUG] ir_compact length: {len(ir_compact)} chars")
        logger.debug("[IR DEBUG] ir_raw length: {len(ir_raw)} chars")
        if ir_raw:
            logger.debug("[IR DEBUG] ir_raw preview: {ir_raw[:300]}...")
        else:
            logger.debug("[IR DEBUG] ⚠️ ir_raw is EMPTY!")
        
        if not isinstance(video_context, dict) or video_context is None:
            video_context = {}
        # Assign unified retrieval output
        video_context["ir_selection_compact"] = ir_compact
        # Attach RAW text (with [BRIEF]/[DETAILED] markers) for answering agent
        video_context["raw_selection"] = ir_raw
        
        # DEBUG: Print exact content passed to answering agent
        # (Removed per user request)

    except Exception:
        try:
            logger.warning("[IR_SELECTOR] timed out or failed; no IR passed this turn")
        except Exception:
            pass

    # If caller already appended the current user message, skip it to avoid duplication
    try:
        if chat_history and isinstance(chat_history[-1], dict):
            last_msg = chat_history[-1]
            if last_msg.get("role") == "user" and last_msg.get("content") == state.get("user_message"):
                chat_history = chat_history[:-1]
    except Exception:
        pass
    
    # Progressive Summary Strategy: Build complete context without gaps
    # Get ALL summary nodes for complete progressive context
    memory_summary = None
    try:
        memory_summary = _get_progressive_conversation_context(chat_id)
    except Exception:
        memory_summary = None

    # Update state with context
    state["chat_history"] = chat_history
    state["video_context"] = video_context
    state["vision_context"] = vision_context
    # Debug: ensure IR compact is attached to state video_context
    try:
        irc_len = len(video_context.get("ir_selection_compact", "")) if isinstance(video_context, dict) else 0
        logger.debug("[CTX] video_context.ir_selection_compact_len={irc_len}")
    except Exception:
        pass
    # Attach vision context into video_context so LLM can see it
    if vision_context:
        if not isinstance(state["video_context"], dict) or state["video_context"] is None:
            state["video_context"] = {}
        state["video_context"]["vision_context"] = vision_context
        if last_image_url:
            state["video_context"]["last_image_url"] = last_image_url
    if memory_summary:
        # Attach summary into video_context so it can be optionally used later
        # without changing the LLM prompt yet.
        if not isinstance(state["video_context"], dict) or state["video_context"] is None:
            state["video_context"] = {}
        state["video_context"]["memory_summary"] = memory_summary
    
    # Convert to LangGraph message format
    messages = []
    for msg in chat_history:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    
    # Add current user message
    messages.append({
        "role": "user", 
        "content": state["user_message"]
    })
    
    state["messages"] = messages
    
    return state

    


def stream_output_node(state: ChatState) -> Generator[Tuple[str, Optional[Dict[str, int]]], None, None]:
    """Stream output node: yields LLM response chunks with token usage."""
    # LAYER 1 HANDLER: Check if blocked
    if state.get("security_blocked"):
        yield state["llm_response"], None
        return

    answering_client = AnsweringClient()
    
    reasoning_context = _build_reasoning_context(state["video_context"])
    
    # LAYER 3: THE SEAL (Output Sanitization)
    blacklist = ["<vision_context>", "</vision_context>", "<retrieved_context>", "</retrieved_context>", "## RETRIEVAL STRATEGY"]
    
    for chunk, token_info in answering_client.generate_response(
        user_message=state["user_message"],
        chat_history=state["chat_history"],
        video_context=reasoning_context
    ):
        # Simple sanitization (Best Effort for streaming)
        clean_chunk = chunk
        for tag in blacklist:
            clean_chunk = clean_chunk.replace(tag, "")
        
        if clean_chunk:
            yield clean_chunk, token_info

def append_messages_node(state: ChatState) -> ChatState:
    """Append user and assistant messages to chat history."""
    chat_id = state["chat_id"]
    # User message is now pre-appended before LLM; only add assistant here
    # Add assistant response
    assistant_msg = hybrid_storage.add_message(chat_id, "assistant", state["llm_response"])
    
    # Check if we need to create a summary node after adding the assistant message
    try:
        _check_and_create_summary_node(chat_id)
    except Exception as e:
        logger.warning(" Failed to create summary node for {chat_id}: {e}")
    
    return state

# LangGraph Graph Construction (simplified for streaming-only)
def create_chat_graph():
    """Create the LangGraph chat workflow for streaming."""
    if not LANGGRAPH_AVAILABLE:
        return None
    
    # Create the graph
    workflow = StateGraph(ChatState)
    
    # Add nodes (streaming workflow uses direct node calls)
    workflow.add_node("context_assembler", context_assembler_node)
    workflow.add_node("append_messages", append_messages_node)
    
    # Define the flow
    workflow.set_entry_point("context_assembler")
    workflow.add_edge("context_assembler", "append_messages")
    workflow.add_edge("append_messages", END)
    
    # Compile the graph
    return workflow.compile()

# Initialize the graph
chat_graph = create_chat_graph() if LANGGRAPH_AVAILABLE else None

# Data Models
class ChatInitRequest(BaseModel):
    user_id: str
    video_id: str

class ChatInitResponse(BaseModel):
    chat_id: str
    user_id: str
    video_id: str
    status: str
    message: str
    timestamp: str


class StreamingChatResponse(BaseModel):
    chat_id: str
    chunk: str
    is_final: bool
    timestamp: str
    tokens_used: Optional[int] = None  # Total tokens used (division by 10) - only in final chunk

class ChatMessageStream(BaseModel):
    chat_id: str
    message: str
    stream: bool = True
    attachment: Optional[Dict[str, Any]] = None

# Core Chatbot Functions
def initialize_chat_session(user_id: str, video_id: str) -> ChatInitResponse:
    """
    Initialize a new chat session for a user and video, or return existing one.
    
    This function:
    1. Checks if a chat session already exists across all storage tiers (Redis, Qdrant, Firebase)
    2. If found, triggers appropriate rehydration based on source tier:
       - Qdrant: Rehydrate Redis in background
       - Firebase: Rehydrate Redis first, then Qdrant in background
    3. Returns existing session if found, or creates a new one with hybrid storage
    4. Returns session details with status indicating if it was created or already existed
    
    Note: Video IR/transcript validation is currently disabled for normal chatbot operation
    """
    # Validation intentionally disabled to keep init lightweight
    
    # Generate the chat_id to check if it already exists
    chat_id = f"{user_id}::CHAT::{video_id}"
    
    # Check if chat exists in any storage tier
    existence_info = chat_exists_anywhere(chat_id)
    
    if existence_info["exists"]:
        # Chat exists somewhere - trigger rehydration based on source tier
        source = existence_info["source"]
        
        # Update access time for the chat
        try:
            migration_manager = MigrationManager()
            migration_manager.update_access_time(chat_id, source)
        except Exception:
            # Non-blocking best-effort; ignore access time update errors
            pass
        
        try:
            if source == "qdrant":
                # Found in Qdrant: Rehydrate Redis in background (non-blocking)
                hybrid_storage.rehydrate_redis_from_qdrant(chat_id, batch_first=4)
                # Block briefly to allow Redis to warm
                try:
                    hybrid_storage.wait_until_redis_warm(chat_id, min_messages=1, timeout_sec=1.5)
                except Exception:
                    pass
            elif source == "firebase":
                # Found in Firebase: Rehydrate Redis first, then Qdrant (non-blocking)
                hybrid_storage.rehydrate_from_firebase(chat_id, batch_first=4)
                # Block briefly to allow Redis to warm
                try:
                    hybrid_storage.wait_until_redis_warm(chat_id, min_messages=1, timeout_sec=1.5)
                except Exception:
                    pass
            # If source == "redis", no rehydration needed
        except Exception:
            # Non-blocking best-effort; ignore rehydration errors during initialization
            pass
        
        # Pre-cache Video IR in Redis (non-blocking best-effort)
        try:
            cached = _get_cached_ir_chunks(video_id)
            if cached is None:
                ir_chunks = fetch_video_chunks(video_id, limit=2000)
                if isinstance(ir_chunks, list) and ir_chunks:
                    _set_cached_ir_chunks(video_id, ir_chunks, ttl_sec=7200)
                    try:
                        logger.debug("[IR][INIT] pre-cached chunks for video_id={video_id}: count={len(ir_chunks)}")
                    except Exception:
                        pass
            else:
                try:
                    logger.debug("[IR][INIT] cache hit for video_id={video_id}: count={len(cached)}")
                except Exception:
                    pass
        except Exception:
            pass

        return ChatInitResponse(
            chat_id=chat_id,
            user_id=user_id,
            video_id=video_id,
            status="existing",
            message=f"Chat session found in {source}, returning existing session",
            timestamp=datetime.now().isoformat()
        )
    else:
        # Initialize new chat session using hybrid storage
        chat_id = init_chat_session(user_id, video_id)
        # Pre-cache Video IR in Redis (non-blocking best-effort)
        try:
            cached = _get_cached_ir_chunks(video_id)
            if cached is None:
                ir_chunks = fetch_video_chunks(video_id, limit=2000)
                if isinstance(ir_chunks, list) and ir_chunks:
                    _set_cached_ir_chunks(video_id, ir_chunks, ttl_sec=7200)
                    try:
                        logger.debug("[IR][INIT] pre-cached chunks for video_id={video_id}: count={len(ir_chunks)}")
                    except Exception:
                        pass
            else:
                try:
                    logger.debug("[IR][INIT] cache hit for video_id={video_id}: count={len(cached)}")
                except Exception:
                    pass
        except Exception:
            pass

        return ChatInitResponse(
            chat_id=chat_id,
            user_id=user_id,
            video_id=video_id,
            status="created",
            message="New chat session initialized successfully",
            timestamp=datetime.now().isoformat()
        )

def check_chat_exists(user_id: str, video_id: str) -> Dict[str, Any]:
    """Check if a chat session exists for the given user and video."""
    # Generate the chat_id
    chat_id = f"{user_id}::CHAT::{video_id}"
    
    # Check if chat exists in our storage
    existing_metadata = get_chat_metadata(chat_id)
    
    return {
        "chat_id": chat_id,
        "user_id": user_id,
        "video_id": video_id,
        "exists": existing_metadata is not None,
        "tier": existing_metadata.get("tier", "none") if existing_metadata else "none",
        "message_count": int(existing_metadata.get("message_count", 0)) if existing_metadata else 0
    }

def get_session_info(chat_id: str) -> Dict[str, Any]:
    """Get information about a chat session."""
    # Validate chat_id format
    if not validate_chat_id(chat_id):
        raise ValueError("Invalid chat_id format")
    
    # Get metadata from hybrid storage
    metadata = get_chat_metadata(chat_id)
    
    if not metadata:
        raise ValueError("Chat session not found")
    
    # Parse chat_id to get user_id and video_id
    user_id, video_id = parse_chat_id(chat_id)
    
    # Get recent chat history
    history = get_chat_history(chat_id, limit=10)
    
    return {
        "chat_id": chat_id,
        "user_id": user_id,
        "video_id": video_id,
        "created_at": datetime.fromtimestamp(int(metadata.get("created_at", 0))).isoformat(),
        "last_activity": datetime.fromtimestamp(int(metadata.get("last_activity", 0))).isoformat(),
        "message_count": int(metadata.get("message_count", 0)),
        "tier": metadata.get("tier", "unknown"),
        "recent_messages": len(history)
    }

def get_chat_history_for_session(chat_id: str, limit: int = 50) -> Dict[str, Any]:
    """Get chat history for a session."""
    # Validate chat_id format
    if not validate_chat_id(chat_id):
        raise ValueError("Invalid chat_id format")
    
    # Fast path: return immediately from any tier
    fast = hybrid_storage.get_chat_history_fast(chat_id, limit)
    history = fast.get("history", [])
    source = fast.get("source", "empty")
    
    # If not from Redis, trigger background rehydration without blocking
    # But only if Redis is completely empty (to avoid double rehydration)
    try:
        if source == "qdrant":
            # Check if Redis is empty before rehydrating
            user_id, video_id = hybrid_storage._parse_chat_id(chat_id)
            redis_history = hybrid_storage.redis.get_history(user_id, video_id, last_n=1)
            if not redis_history:  # Only rehydrate if Redis is empty
                hybrid_storage.rehydrate_redis_from_qdrant(chat_id, batch_first=4)
                # Block briefly to allow Redis to warm for this response
                try:
                    hybrid_storage.wait_until_redis_warm(chat_id, min_messages=1, timeout_sec=1.0)
                except Exception:
                    pass
        elif source == "firebase":
            # Check if Redis is empty before rehydrating  
            user_id, video_id = hybrid_storage._parse_chat_id(chat_id)
            redis_history = hybrid_storage.redis.get_history(user_id, video_id, last_n=1)
            if not redis_history:  # Only rehydrate if Redis is empty
                hybrid_storage.rehydrate_from_firebase(chat_id, batch_first=4)
                # Block briefly to allow Redis to warm for this response
                try:
                    hybrid_storage.wait_until_redis_warm(chat_id, min_messages=1, timeout_sec=1.0)
                except Exception:
                    pass
    except Exception:
        # Non-blocking best-effort; ignore rehydrate errors here
        pass
    
    # Add summary analytics
    summary_nodes = [msg for msg in history if msg.get("role") == "summary"]
    non_summary_count = len([msg for msg in history if msg.get("role") != "summary"])
    
    return {
        "chat_id": chat_id,
        "history": history,
        "count": len(history),
        "non_summary_count": non_summary_count,
        "summary_nodes": len(summary_nodes),
        "tier": source if history else "empty"
    }


def add_message_stream(chat_id: str, message: str, attachment: Optional[Dict[str, Any]] = None) -> Generator[StreamingChatResponse, None, None]:
    """Add a message to the chat and stream LLM response using LangGraph."""
    # Validate chat_id format
    if not validate_chat_id(chat_id):
        raise ValueError("Invalid chat_id format")
    
    # Update access time for the chat
    try:
        migration_manager = MigrationManager()
        # Determine current tier by checking where chat exists
        existence_info = chat_exists_anywhere(chat_id)
        if existence_info["exists"]:
            migration_manager.update_access_time(chat_id, existence_info["source"])
    except Exception:
        # Non-blocking best-effort; ignore access time update errors
        pass
    
    try:
        if chat_graph is not None:
            # Pre-append user message to storage
            try:
                pre_user = add_chat_message(chat_id, "user", message)
            except Exception:
                pre_user = None
            # Use LangGraph workflow for streaming
            initial_state = {
                "chat_id": chat_id,
                "user_message": message,
                "chat_history": [],
                "video_context": None,
                "vision_context": None,
                "attachment": attachment,
                "llm_response": "",
                "messages": [],
                "total_tokens": 0
            }
            
            # If attachment present and we have a user message_id, process and persist
            try:
                if attachment and pre_user and isinstance(pre_user, dict):
                    msg_id = pre_user.get("message_id")
                    msg_id = pre_user.get("message_id")
                    if msg_id:
                        att_meta, vision_tokens = _process_attachment(chat_id, attachment, msg_id)
                        if att_meta:
                            # Add vision tokens to running total
                            vision_total = vision_tokens.get("prompt_tokens", 0) + vision_tokens.get("completion_tokens", 0)
                            initial_state["total_tokens"] += vision_total
                            
                            # CRITICAL FIX: Hoist vision context immediately to state so it's used this turn
                            if att_meta.get("vision_context"):
                                initial_state["vision_context"] = {"vision": att_meta["vision_context"], "url": att_meta.get("url")}
                                logger.debug("[VISION] 🚀 Hoisted vision context to state: {len(att_meta['vision_context'])} chars")
                                
                            try:
                                hybrid_storage.update_message_attachments(chat_id, msg_id, [att_meta])
                            except Exception:
                                pass
            except Exception:
                pass

            # Run context assembler (includes vision)
            # Ensure Redis has been warmed to avoid Qdrant fall-through in this turn
            try:
                hybrid_storage.wait_until_redis_warm(chat_id, min_messages=1, timeout_sec=1.0)
            except Exception:
                pass
            state_after_context = context_assembler_node(initial_state)
            
            # Stream the LLM response
            full_response = ""
            for chunk, token_info in stream_output_node(state_after_context):
                full_response += chunk
                yield StreamingChatResponse(
                    chat_id=chat_id,
                    chunk=chunk,
                    is_final=False,
                    timestamp=datetime.now().isoformat()
                )
                
                # Add agent tokens to running total
                if token_info:
                    state_after_context["total_tokens"] += token_info.get("completion_tokens", 0)
            
            # Update state with full response
            state_after_context["llm_response"] = full_response
            
            # Append messages to history
            append_messages_node(state_after_context)
            
            # Send final chunk with token count (division by 10)
            tokens_div10 = int(state_after_context["total_tokens"] / 10)
            
            yield StreamingChatResponse(
                chat_id=chat_id,
                chunk="",
                is_final=True,
                timestamp=datetime.now().isoformat(),
                tokens_used=tokens_div10
            )
        else:
            # Fallback to direct streaming
            logger.warning("FALLBACK: LangGraph not available for chat %s, using direct streaming", chat_id)
            yield from add_message_stream_direct(chat_id, message, attachment, user_already_saved=False)
            
    except Exception as e:
        # If graph fails, fallback to direct approach
        logger.warning("FALLBACK: LangGraph failed for chat %s (%s), using direct streaming", chat_id, str(e))
        try:
            yield from add_message_stream_direct(chat_id, message, attachment, user_already_saved=True)
        except Exception as fallback_error:
            logger.error("CRITICAL: Both LangGraph and fallback failed for chat %s", chat_id)
            error_response = f"Graph failed: {str(e)}, Fallback failed: {str(fallback_error)}"
            yield StreamingChatResponse(
                chat_id=chat_id,
                chunk=error_response,
                is_final=True,
                timestamp=datetime.now().isoformat()
            )

# Direct and context utilities moved back here to avoid circular imports

def get_video_context(chat_id: str) -> Optional[Dict[str, Any]]:
    """Get video context for the chat session."""
    try:
        user_id, video_id = parse_chat_id(chat_id)
        return {
            "video_id": video_id,
            "user_id": user_id,
            "context_type": "video_chat"
        }
    except Exception:
        return None

def _ir_cache_key(video_id: str) -> str:
    # Key for Video Analysis Chunks (IR)
    # Matches UnifiedChunkStorage hydration key
    return f"video_analysis:chunks:{video_id}"

def _get_cached_ir_chunks(video_id: str) -> Optional[List[Dict[str, Any]]]:
    try:
        # Leverage HybridChatStorage's Redis client if available
        r = getattr(hybrid_storage, "redis", None)
        if r is None:
            return None
        key = _ir_cache_key(video_id)
        raw = r.get(key)
        if not raw:
            return None
        import json as _json
        try:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
        except Exception:
            pass
        return _json.loads(raw)
    except Exception:
        return None

def _set_cached_ir_chunks(video_id: str, chunks: List[Dict[str, Any]], ttl_sec: int = 7200) -> None:
    try:
        r = getattr(hybrid_storage, "redis", None)
        if r is None:
            return
        import json as _json
        key = _ir_cache_key(video_id)
        r.setex(key, ttl_sec, _json.dumps(chunks))
    except Exception:
        return

def _selector_cache_key(video_id: str, query: str) -> str:
    import hashlib
    # Normalize query (lowercase, strip) for consistent caching
    q_hash = hashlib.md5(query.strip().lower().encode("utf-8")).hexdigest()
    return f"selector_result:{video_id}:{q_hash}"

def _get_cached_selector_result(video_id: str, query: str) -> Optional[List[Dict[str, Any]]]:
    try:
        r = getattr(hybrid_storage, "redis", None)
        if r is None:
            return None
        key = _selector_cache_key(video_id, query)
        val = r.get(key)
        if not val:
            return None
        import json as _json
        return _json.loads(val)
    except Exception:
        return None

def _set_cached_selector_result(video_id: str, query: str, result: List[Dict[str, Any]], ttl_sec: int = 86400) -> None:
    try:
        r = getattr(hybrid_storage, "redis", None)
        if r is None:
            return
        key = _selector_cache_key(video_id, query)
        import json as _json
        r.setex(key, ttl_sec, _json.dumps(result))
    except Exception:
        return

def _vector_search_candidates(video_id: str, query: str, limit: int = 25) -> set:
    """Vector Pre-Filter: Get top-k chunk indices from Qdrant.
    
    Generates embedding for query and searches unified chunks.
    Returns a set of chunk indices (integers).
    """
    if not query or len(query.strip()) < 3:
        return set()
        
    try:
        from qdrant_client import models
        
        # 1. Embed query - use shared client (OPTIMIZATION: singleton)
        emb_client = get_shared_embedding_client()
        vectors = emb_client.embed_texts([query])
        query_vector = vectors[0] if vectors else None
        if not query_vector:
            return set()
            
        # 2. Search Qdrant (using query_points for compatibility)
        client = get_qdrant_client()
        hits = client.query_points(
            collection_name="video_analysis",
            query=query_vector,
            limit=limit,
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="video_id",
                        match=models.MatchValue(value=video_id)
                    )
                ]
            )
        )
        
        # 3. Extract indices
        # query_points returns a QueryResponse object in recent versions, containing .points list
        hits_list = getattr(hits, "points", hits)
        
        indices = set()
        for hit in hits_list:
            # Robust extraction
            payload = getattr(hit, "payload", None)
            if payload is None:
                 if isinstance(hit, dict): payload = hit.get("payload")
                 # Check if it's a tuple (unlikely for ScoredPoint but possible in some client return types)
                 elif isinstance(hit, tuple) and len(hit) > 0:
                      # If tuple, try to find payload in it? Safe skip for now unless we know structure.
                      continue
            
            if payload:
                idx = payload.get("chunk_index")
                if idx is not None:
                    try: indices.add(int(idx))
                    except: pass
        
        # print(f"[VECTOR_FILTER] Found {len(indices)} candidates for query '{query[:30]}...'")
        return indices
        
    except Exception as e:
        logger.error("[VECTOR_FILTER_ERROR] %s", e)
        return set()

def fetch_video_chunks(video_id: str, limit: int = 2000) -> List[Dict[str, Any]]:
    """Fetch Unified Chunks from Qdrant 'video_analysis' collection."""
    try:
        client = get_qdrant_client()
        # Use simple filter on video_id
        flt = {"must": [{"key": "video_id", "match": {"value": video_id}}]}
        page_size = 1000
        acc: List[Dict[str, Any]] = []
        next_off = None
        fetched = 0
        while True:
            page_lim = min(page_size, (limit - fetched) if limit else page_size)
            points, next_off = client.scroll(
                collection_name="video_analysis", # Updated collection name
                scroll_filter=flt,
                limit=page_lim,
                with_payload=True,
                with_vectors=False,
                offset=next_off,
            )
            if not points:
                break
            for p in points:
                payload = p.payload if hasattr(p, "payload") else (p.get("payload", {}) if isinstance(p, dict) else {})
                if payload:
                    acc.append(payload)
            fetched += len(points)
            if next_off is None:
                break
            if limit and fetched >= limit:
                break
        return acc
    except Exception as e:
        logger.error("[FETCH_ERROR] %s", e)
        return []
    except Exception:
        return []

# Progressive Summary Implementation Functions

def _get_progressive_conversation_context(chat_id: str) -> Optional[str]:
    """Get complete progressive conversation context from summary nodes."""
    try:
        # Get all messages to find summary nodes
        all_messages = hybrid_storage.get_chat_history_fast(chat_id, limit=1000)["history"]
        
        # Extract all summary nodes
        summary_nodes = [msg for msg in all_messages if msg.get("role") == "summary"]
        
        if not summary_nodes:
            return None
        
        # Sort by sequence to maintain chronological order
        summarizer = MemorySummarizer()
        summary_nodes.sort(key=lambda x: summarizer.extract_sequence_from_message_id(x.get("message_id", "")))
        
        # Build progressive context by combining all summaries using the library
        return summarizer.combine_summary_chain(summary_nodes)
        
    except Exception as e:
        logger.warning(" Failed to get progressive context for {chat_id}: {e}")
        return None

def _check_and_create_summary_node(chat_id: str) -> None:
    """Check if we need to create a summary node and create it if needed."""
    try:
        # Get current message count (excluding existing summaries)
        all_messages = hybrid_storage.get_chat_history_fast(chat_id, limit=1000)["history"]
        non_summary_messages = [msg for msg in all_messages if msg.get("role") != "summary"]
        
        # Use the library to check if summary should be created
        summarizer = MemorySummarizer()
        last_summary_seq = _get_last_summary_sequence(all_messages)
        
        if summarizer.should_create_summary(non_summary_messages, last_summary_seq):
            _create_progressive_summary_node(chat_id, non_summary_messages, all_messages)
            
    except Exception as e:
        logger.warning(" Failed to check/create summary node for {chat_id}: {e}")

def _get_last_summary_sequence(all_messages: List[Dict[str, Any]]) -> int:
    """Get the sequence number of the last summary node."""
    summary_nodes = [msg for msg in all_messages if msg.get("role") == "summary"]
    if not summary_nodes:
        return 0
    
    # Use the library to extract sequences
    summarizer = MemorySummarizer()
    sequences = [
        summarizer.extract_sequence_from_message_id(msg.get("message_id", "")) 
        for msg in summary_nodes
    ]
    sequences = [seq for seq in sequences if seq is not None]
    return max(sequences) if sequences else 0

def _create_progressive_summary_node(
    chat_id: str, 
    non_summary_messages: List[Dict[str, Any]], 
    all_messages: List[Dict[str, Any]]
) -> None:
    """Create a new progressive summary node."""
    try:
        # Get the last 8 non-summary messages to summarize
        messages_to_summarize = non_summary_messages[-8:] if len(non_summary_messages) >= 8 else non_summary_messages
        
        if not messages_to_summarize:
            return
        
        # Get existing summary context for progressive building
        existing_summaries = [msg for msg in all_messages if msg.get("role") == "summary"]
        
        # Use the library to generate progressive summary
        summarizer = MemorySummarizer()
        
        if existing_summaries:
            # Build on ONLY the most recent summary (true progressive)
            previous_summary = existing_summaries[-1].get("content", "")
            summary_content = summarizer.create_progressive_summary(
                messages_to_summarize, previous_summary
            )
        else:
            # First summary in conversation
            summary_content = summarizer.create_progressive_summary(messages_to_summarize)
        
        # Create summary metadata
        start_seq = summarizer.extract_sequence_from_message_id(messages_to_summarize[0].get("message_id", ""))
        end_seq = summarizer.extract_sequence_from_message_id(messages_to_summarize[-1].get("message_id", ""))
        
        summary_metadata = {
            "summary_type": "progressive",
            "summary_range": f"seq_{start_seq:06d}:seq_{end_seq:06d}" if start_seq and end_seq else "unknown",
            "message_count": len(messages_to_summarize),
            "summary_generation": len(existing_summaries) + 1,
            "created_at": int(time.time())
        }
        
        # Store summary as special message node
        hybrid_storage.add_message(
            chat_id=chat_id,
            role="summary",
            content=summary_content,
            attachments=[{"metadata": summary_metadata}]
        )
        
        logger.info("Created progressive summary node for %s (generation %s)", chat_id, summary_metadata['summary_generation'])
        
    except Exception as e:
        logger.warning(" Failed to create progressive summary node: {e}")

def _build_reasoning_context(video_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Sanitize video_context to only include reasoning-relevant fields for the LLM.

    Excludes identifiers (video_id, user_id) and model metadata.
    Returns a minimal dict containing:
    - vision_text: extracted text/code from vision processing
    - memory_summary: compressed older history if present
    """
    try:
        if not isinstance(video_context, dict) or video_context is None:
            return {}
        vc = video_context
        # Vision context is now just a string, not a nested structure
        vision_text = vc.get("vision_context", "")
        if isinstance(vision_text, dict):
            # Handle new format {"vision": "...", "url": "..."}
            if "vision" in vision_text:
                vision_text = vision_text.get("vision", "")
            else:
                # Handle legacy format if it still exists
                try:
                    raw = (vision_text.get("raw") or {})
                    vision_text = (raw.get("response") or "").strip()
                except Exception:
                    vision_text = ""
        
        # Always include IR selection exactly as received (no trimming/filtering)
        reasoning_context: Dict[str, Any] = {
            "ir_selection_compact": vc.get("ir_selection_compact"),
            "raw_selection": vc.get("raw_selection"),  # Full content with [BRIEF]/[DETAILED] markers
        }
        # Include other optional fields only if present
        if vision_text:
            reasoning_context["vision_text"] = vision_text
        mem_sum = vc.get("memory_summary")
        if mem_sum:
            reasoning_context["memory_summary"] = mem_sum
        return reasoning_context
    except Exception:
        return {}


def _process_attachment(chat_id: str, attachment: Optional[Dict[str, Any]], message_id: str) -> Tuple[Optional[Dict[str, Any]], Dict[str, int]]:
    """Process attachment with vision processing and return both metadata and token usage."""
    if not attachment or not isinstance(attachment, dict):
        return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    
    # Existing URL case (store only the public URL)
    if attachment.get("url"):
        return {"url": attachment.get("url")}, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    # Upload case (expects base64 data)
    data_b64 = attachment.get("data_base64")
    filename = attachment.get("filename") or "upload.bin"
    mime_type = attachment.get("mime_type")
    if not data_b64:
        return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    
    try:
        import base64
        data_bytes = base64.b64decode(data_b64)
    except Exception:
        return None, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    thumb_meta = None
    thumbnail = attachment.get("thumbnail")
    if isinstance(thumbnail, dict) and thumbnail.get("data_base64"):
        try:
            import base64
            thumb_bytes = base64.b64decode(thumbnail.get("data_base64"))
            thumb_meta = {
                "filename": thumbnail.get("filename"),
                "data": thumb_bytes,
                "mime_type": thumbnail.get("mime_type"),
            }
        except Exception:
            thumb_meta = None

    # Process vision with token tracking
    vision_text = ""
    vision_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    try:
        mime_for_data = mime_type or "application/octet-stream"
        data_url = f"data:{mime_for_data};base64,{data_b64}"
        vc = VisionClient()
        vision_text, vision_tokens = vc.extract_context(image_url=data_url, detail="low")
    except Exception:
        vision_text = ""
        vision_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    # Upload to R2 for storage and frontend rendering
    r2 = R2Storage()
    uploaded = r2.upload_image_with_meta(
        chat_id=chat_id,
        message_id=message_id,
        filename=filename,
        data=data_bytes,
        mime_type=mime_type,
        size_bytes=attachment.get("size_bytes"),
        width=attachment.get("width"),
        height=attachment.get("height"),
        thumbnail=thumb_meta,
    )

    # Return both URL (for rendering) and vision context (for LLM) with tokens
    slim: Dict[str, Any] = {"url": uploaded.get("url")}
    if vision_text:
        slim["vision_context"] = vision_text
    return slim, vision_tokens



def add_message_stream_direct(chat_id: str, message: str, attachment: Optional[Dict[str, Any]] = None, user_already_saved: bool = False) -> Generator[StreamingChatResponse, None, None]:
    """Direct streaming approach without LangGraph (fallback)."""
    # Get current chat history (without user message)
    chat_history = get_chat_history(chat_id, limit=20)
    
    # Get video context (if available)
    video_context = get_video_context(chat_id)
    
    # Generate streaming LLM response FIRST
    answering_client = AnsweringClient()
    full_response = ""
    
    reasoning_context = _build_reasoning_context(video_context)
    for chunk, token_info in answering_client.generate_response(
        user_message=message,
        chat_history=chat_history,
        video_context=reasoning_context
    ):
        full_response += chunk
        yield StreamingChatResponse(
            chat_id=chat_id,
            chunk=chunk,
            is_final=False,
            timestamp=datetime.now().isoformat()
        )
    
    # Only save user message if not already saved by LangGraph
    if not user_already_saved:
        user_msg = add_chat_message(chat_id, "user", message)
    else:
        user_msg = None
    # Process optional attachment and attach to user message structure
    try:
        if attachment and user_msg:
            att_meta = _process_attachment(chat_id, attachment, user_msg.get("message_id"))
            if att_meta:
                user_msg["attachments"] = [att_meta]
    except Exception:
        pass

    bot_msg = add_chat_message(chat_id, "assistant", full_response)
    
    # Send final chunk
    yield StreamingChatResponse(
        chat_id=chat_id,
        chunk="",
        is_final=True,
        timestamp=datetime.now().isoformat()
    )


def list_active_sessions() -> Dict[str, Any]:
    """List all active chat sessions (Redis-based)."""
    # Note: This is a simplified version. In production, you'd want to scan Redis keys
    return {
        "message": "Use get_session_info(chat_id) to get specific session info",
        "note": "Session listing requires Redis key scanning implementation"
    }

# Storage convenience functions (moved back from chatbot_utils to avoid circular imports)
def init_chat_session(user_id: str, video_id: str) -> str:
    """Initialize a new chat session."""
    return hybrid_storage.init_chat(user_id, video_id)

def add_chat_message(chat_id: str, role: str, content: str) -> Dict[str, Any]:
    """Add a message to the chat."""
    return hybrid_storage.add_message(chat_id, role, content)

def get_chat_history(chat_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get chat history."""
    return hybrid_storage.get_chat_history(chat_id, limit)

def search_chat_history(chat_id: str, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Search chat history semantically."""
    return hybrid_storage.search_chat_history(chat_id, query, limit)

def migrate_to_qdrant(chat_id: str) -> Dict[str, Any]:
    """Migrate chat from Redis to Qdrant."""
    return hybrid_storage.migrate_to_qdrant(chat_id)

def migrate_to_firebase(chat_id: str) -> int:
    """Migrate chat from Qdrant to Firebase."""
    return hybrid_storage.migrate_to_firebase(chat_id)

def get_chat_metadata(chat_id: str) -> Dict[str, Any]:
    """Get chat metadata."""
    return hybrid_storage.get_chat_metadata(chat_id)

def chat_exists_anywhere(chat_id: str) -> Dict[str, Any]:
    """Check if chat exists in any storage tier."""
    return hybrid_storage.chat_exists_anywhere(chat_id)

def validate_chat_id(chat_id: str) -> bool:
    """Validate if chat_id has correct format."""
    try:
        hybrid_storage._parse_chat_id(chat_id)
        return True
    except ValueError:
        return False

def parse_chat_id(chat_id: str) -> tuple[str, str]:
    """Parse chat_id to get user_id and video_id."""
    return hybrid_storage._parse_chat_id(chat_id)

# R2 image upload: use high-level helper from Storage.r2_storage
def upload_image_with_meta(
    chat_id: str,
    message_id: str,
    filename: str,
    data: bytes,
    mime_type: Optional[str] = None,
    size_bytes: Optional[int] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    thumbnail: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    r2 = R2Storage()
    return r2.upload_image_with_meta(
        chat_id=chat_id,
        message_id=message_id,
        filename=filename,
        data=data,
        mime_type=mime_type,
        size_bytes=size_bytes,
        width=width,
        height=height,
        thumbnail=thumbnail,
    )

# Progressive Summary Helper Functions
def get_summary_nodes(chat_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get summary nodes for a chat."""
    return hybrid_storage.get_summary_nodes(chat_id, limit)

def get_recent_non_summary_messages(chat_id: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Get recent non-summary messages."""
    return hybrid_storage.get_recent_non_summary_messages(chat_id, limit)

def count_messages_since_last_summary(chat_id: str) -> int:
    """Count messages since last summary node."""
    return hybrid_storage.count_messages_since_last_summary(chat_id)

def force_create_summary_node(chat_id: str) -> Dict[str, Any]:
    """Force creation of a summary node (for testing/debugging)."""
    try:
        _check_and_create_summary_node(chat_id)
        return {"status": "success", "message": "Summary node creation triggered"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Export all functions and models
__all__ = [
    # Data Models
    "ChatInitRequest",
    "ChatInitResponse", 
    "StreamingChatResponse",
    "ChatMessageStream",
    
    # Answering Client
    "AnsweringClient",
    
    # Core Functions
    "initialize_chat_session",
    "check_chat_exists",
    "get_session_info",
    "get_chat_history_for_session",
    "add_message_stream",
    "list_active_sessions",
    
    # Storage Convenience Functions
    "init_chat_session",
    "add_chat_message",
    "get_chat_history",
    "search_chat_history",
    "migrate_to_qdrant",
    "migrate_to_firebase",
    "get_chat_metadata",
    "chat_exists_anywhere",
    "validate_chat_id",
    "parse_chat_id",
    
    # Progressive Summary Functions
    "get_summary_nodes",
    "get_recent_non_summary_messages", 
    "count_messages_since_last_summary",
    "force_create_summary_node",
    
    # Attachments helper (delegates to Storage.r2_storage)
    "upload_image_with_meta"
]