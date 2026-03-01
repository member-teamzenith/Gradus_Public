import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ============================================================================
# Path Configuration for Legacy Support
# ============================================================================
# Add modules to sys.path so that imports inside them like 'from chatbot import ...' work.
# We add them with lowest priority (at the end) or high priority? 
# Usually high priority if we want to override system packages, but here they are local.
base_dir = os.path.dirname(os.path.abspath(__file__))
modules_dir = os.path.join(base_dir, "modules")

# Add 'modules/chatbot' to path so 'import chatbot' works
chatbot_dir = os.path.join(modules_dir, "chatbot")
if chatbot_dir not in sys.path:
    sys.path.insert(0, chatbot_dir)

# Add 'modules/video_player' to path so 'import ir_agent' works
video_player_dir = os.path.join(modules_dir, "video_player")
if video_player_dir not in sys.path:
    # app/main.py imports ir_agent directly.
    sys.path.insert(0, video_player_dir)

# Now we can import from core and modules
from core.lifespan import unified_lifespan
from core.config import settings
from modules.video_player.router import router as video_router
from modules.chatbot.router import router as chat_router


# ============================================================================
# Application Setup
# ============================================================================

app = FastAPI(
    title="Orion Unified Server",
    description="Combined API for Video Analysis and Chatbot",
    version="2.1.0",
    lifespan=unified_lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, # Chatbot uses cookies? usually allow_credentials=True needs specific origins, but star works sometimes depending on browser. Original was False.
    # Video Player: allow_credentials=False
    # Chatbot: allow_credentials=False
    # We'll stick to False to match original behavior unless proven otherwise.
    # Actually, Chatbot main.py said allow_credentials=False.
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Routing
# ============================================================================

# Mount routers at root for "Flat Merge"
app.include_router(video_router, tags=["Video Analysis"]) 
app.include_router(chat_router, tags=["Chat & Memory"])


# Unified Health Check
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Orion Unified Server",
        "version": "2.1.0",
        "modules": ["video_player", "chatbot"]
    }

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    # Using reload=True for dev
    uvicorn.run("unified_server:app", host="0.0.0.0", port=port, reload=True)
