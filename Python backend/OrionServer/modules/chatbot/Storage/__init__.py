#!/usr/bin/env python3
"""
Storage Package for Chat History

This package provides a modular storage system for chat history with three tiers:
- Redis (0-3 hours): Hot cache for active conversations
- Qdrant (3 hours to 7 days): Vector search for recent chats
- Firebase (7+ days): Long-term durable storage

The hybrid storage system orchestrates all three storage tiers automatically.
"""

from .redis_storage import RedisStorage
from .qdrant_storage import QdrantStorage
from .firebase_storage import FirebaseStorage
from .r2_storage import R2Storage
from .hybrid_storage import HybridChatStorage

# Export the main classes
__all__ = [
    "RedisStorage",
    "QdrantStorage", 
    "FirebaseStorage",
    "R2Storage",
    "HybridChatStorage"
]

# Version information
__version__ = "1.0.0"
__author__ = "Video Chatbot Team"
__description__ = "Modular storage system for chat history with Redis, Qdrant, and Firebase"
