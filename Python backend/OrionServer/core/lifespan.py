
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
import importlib

from core.logging_config import setup_production_logging

# Initialize logging FIRST (before any imports that might log)
setup_production_logging()
logger = logging.getLogger(__name__)

# Import dependencies using fully qualified names from OrionServer modules
# Note: we import these inside the lifespan or strictly when needed if circular imports arise, 
# but here it should be fine as lifespan uses them.
# Video Player Dependencies
from modules.video_player.Chunking_Embedding_Processor.summarization_worker import SummarizationPool
from modules.video_player.Chunking_Embedding_Processor.unified_storage import UnifiedChunkStorage
from modules.video_player.Chunking_Embedding_Processor.user_profile_storage import UserProfileStorage

# Chatbot Dependencies
# These must be imported carefully. existing main.py logic had try/except.
try:
    from modules.chatbot.Storage.qdrant_storage import QdrantStorage
except Exception as e:
    logger.warning("Could not import QdrantStorage: %s", type(e).__name__)
    QdrantStorage = None

try:
    from modules.chatbot.chatbot_utils.answering_client import get_shared_llm_http_client, close_shared_llm_http_client
    from modules.chatbot.chatbot_utils.vision_client import get_shared_vision_http_client, close_shared_vision_http_client
    from modules.chatbot.chatbot_utils.ir_selector import get_shared_ir_selector_client, close_shared_ir_selector_client, get_shared_ir_selector
    from modules.chatbot.chatbot_utils.embedding_client import get_shared_embedding_client, close_shared_embedding_client
    from modules.chatbot.chatbot_utils.memory_summarizer import get_shared_memory_summarizer_client, close_shared_memory_summarizer_client
    from modules.chatbot.chatbot import get_chatbot_thread_pool, shutdown_chatbot_thread_pool
except Exception as e:
    logger.warning("Could not import Chatbot dependencies: %s", type(e).__name__)
    get_shared_llm_http_client = None
    close_shared_llm_http_client = None
    get_shared_vision_http_client = None
    close_shared_vision_http_client = None
    get_shared_ir_selector_client = None
    close_shared_ir_selector_client = None
    get_shared_ir_selector = None
    get_shared_embedding_client = None
    close_shared_embedding_client = None
    get_shared_memory_summarizer_client = None
    close_shared_memory_summarizer_client = None
    get_chatbot_thread_pool = None
    shutdown_chatbot_thread_pool = None

# Video Player Embedding Client
try:
    from modules.video_player.Chunking_Embedding_Processor.unified_storage import get_shared_vp_embedding_client, close_shared_vp_embedding_client
except Exception as e:
    logger.warning("Could not import Video Player embedding client: %s", type(e).__name__)
    get_shared_vp_embedding_client = None
    close_shared_vp_embedding_client = None

# Video Player Agent Clients (Quiz, Recommendation, Writer)
try:
    from modules.video_player.quiz_generator import get_shared_quiz_client, close_shared_quiz_client
    from modules.video_player.recommendation_agent import get_shared_recommendation_client, close_shared_recommendation_client
    from modules.video_player.writer_agent import get_shared_writer_client, close_shared_writer_client
except Exception as e:
    logger.warning("Could not import Video Player agent clients: %s", type(e).__name__)
    get_shared_quiz_client = None
    close_shared_quiz_client = None
    get_shared_recommendation_client = None
    close_shared_recommendation_client = None
    get_shared_writer_client = None
    close_shared_writer_client = None

# Video Player Qdrant Client
try:
    from utils.qdrant import close_qdrant_client
except Exception as e:
    logger.warning("Could not import Qdrant utils: %s", type(e).__name__)
    close_qdrant_client = None

@asynccontextmanager
async def unified_lifespan(app: FastAPI):
    logger.info("🚀 Starting Orion Server...")
    
    # --- Chatbot Startup ---
    try:
        if get_shared_llm_http_client:
            get_shared_llm_http_client()
            logger.info("Chatbot: LLM Client initialized")
    except Exception:
        pass
    try:
        if get_shared_vision_http_client:
            get_shared_vision_http_client()
            logger.info("Chatbot: Vision Client initialized")
    except Exception:
        pass
    try:
        if get_shared_ir_selector_client:
            get_shared_ir_selector_client()
            logger.info("Chatbot: IR Selector Client initialized")
    except Exception:
        pass
    try:
        if get_shared_ir_selector:
            get_shared_ir_selector()
            logger.info("Chatbot: IR Selector Agent initialized")
    except Exception:
        pass
    try:
        if get_shared_embedding_client:
            get_shared_embedding_client()
            logger.info("Chatbot: Embedding Client initialized")
    except Exception:
        pass
    try:
        if get_shared_memory_summarizer_client:
            get_shared_memory_summarizer_client()
            logger.info("Chatbot: Memory Summarizer initialized")
    except Exception:
        pass
    try:
        if get_chatbot_thread_pool:
            get_chatbot_thread_pool()
            logger.info("Chatbot: Thread pool pre-warmed")
    except Exception:
        pass

    # --- Video Player Startup ---
    try:
        if get_shared_vp_embedding_client:
            get_shared_vp_embedding_client()
            logger.info("Video Player: Embedding Client initialized")
    except Exception:
        pass
    try:
        if get_shared_quiz_client:
            get_shared_quiz_client()
            logger.info("Video Player: Quiz Client initialized")
    except Exception:
        pass
    try:
        if get_shared_recommendation_client:
            get_shared_recommendation_client()
            logger.info("Video Player: Recommendation Client initialized")
    except Exception:
        pass
    try:
        if get_shared_writer_client:
            get_shared_writer_client()
            logger.info("Video Player: Writer Client initialized")
    except Exception:
        pass
    
    # Initialize Global Worker Pool
    app.state.pool = SummarizationPool(num_workers=5)
    await app.state.pool.start()
    logger.info("Video Player: Summarization Pool started")

    # Initialize Global IO Executor
    from concurrent.futures import ThreadPoolExecutor
    app.state.executor = ThreadPoolExecutor(max_workers=10)
    logger.info("Video Player: ThreadPoolExecutor initialized (10 workers)")

    # Initialize Unified Storage
    app.state.storage = UnifiedChunkStorage()
    app.state.storage.ensure_schema()
    logger.info("Video Player: Unified Storage initialized")
    
    # Initialize User Profile Storage
    app.state.user_storage = UserProfileStorage()
    app.state.user_storage.ensure_schema()
    logger.info("Video Player: User Profile Storage initialized")
    
    # Initialize Chat History storage (Singleton auto-initializes collection)
    if QdrantStorage:
        try:
            QdrantStorage()
            logger.info("Chatbot: Chat History Storage initialized")
        except Exception as e:
            logger.warning("Chatbot: Failed to initialize Chat History Storage: %s", e)

    # Log usage of routes
    logger.info("Listing all registered routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            methods = getattr(route, "methods", "")
            logger.debug("Route: %s [%s]", route.path, methods)

    yield
    
    # --- Shutdown ---
    logger.info("🛑 Shutting down Orion Server...")
    
    # Stop Video Player Pool
    if hasattr(app.state, 'pool') and app.state.pool:
        await app.state.pool.stop()
        logger.info("Video Player: Summarization Pool stopped")

    # Shutdown Executor
    if hasattr(app.state, 'executor') and app.state.executor:
        app.state.executor.shutdown(wait=True)
        logger.info("Video Player: Global ThreadPoolExecutor shutdown")
        
    # Close Chatbot Clients
    try:
        if close_shared_llm_http_client:
            close_shared_llm_http_client()
            logger.info("Chatbot: LLM Client closed")
    except Exception:
        pass
    try:
        if close_shared_vision_http_client:
            close_shared_vision_http_client()
            logger.info("Chatbot: Vision Client closed")
    except Exception:
        pass
    try:
        if close_shared_ir_selector_client:
            close_shared_ir_selector_client()
            logger.info("Chatbot: IR Selector HTTP Client closed")
    except Exception:
        pass
    try:
        if close_shared_embedding_client:
            close_shared_embedding_client()
            logger.info("Chatbot: Embedding Client closed")
    except Exception:
        pass
    try:
        if close_shared_memory_summarizer_client:
            close_shared_memory_summarizer_client()
            logger.info("Chatbot: Memory Summarizer Client closed")
    except Exception:
        pass
    
    # Close Video Player Clients
    try:
        if close_shared_vp_embedding_client:
            close_shared_vp_embedding_client()
            logger.info("Video Player: Embedding Client closed")
    except Exception:
        pass
    try:
        if close_shared_quiz_client:
            close_shared_quiz_client()
            logger.info("Video Player: Quiz Client closed")
    except Exception:
        pass
    try:
        if close_shared_recommendation_client:
            close_shared_recommendation_client()
            logger.info("Video Player: Recommendation Client closed")
    except Exception:
        pass
    try:
        if close_shared_writer_client:
            close_shared_writer_client()
            logger.info("Video Player: Writer Client closed")
    except Exception:
        pass
    try:
        if close_qdrant_client:
            close_qdrant_client()
            logger.info("Video Player: Qdrant Client closed")
    except Exception:
        pass
    
    # Shutdown Chatbot Thread Pool
    try:
        if shutdown_chatbot_thread_pool:
            shutdown_chatbot_thread_pool()
            logger.info("Chatbot: Global thread pool shutdown")
    except Exception:
        pass
