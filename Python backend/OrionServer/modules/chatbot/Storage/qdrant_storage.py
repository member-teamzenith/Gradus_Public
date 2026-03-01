#!/usr/bin/env python3
"""
Qdrant Storage Module for Chat History

This module handles all Qdrant operations for the hybrid storage system.
Qdrant is used for vector search and recent chats (3 hours to 7 days).
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

# Import Qdrant utilities
from utils.qdrant import get_qdrant_client, ensure_collection, upsert_points, qmodels
from chatbot_utils.embedding_client import get_shared_embedding_client
from core.config import settings

logger = logging.getLogger(__name__)

class QdrantStorage:
    """Qdrant storage operations for chat history."""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern to prevent multiple instances."""
        if cls._instance is None:
            cls._instance = super(QdrantStorage, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        # Only initialize once
        if self._initialized:
            return
            
        self.client = get_qdrant_client()
        self.embedding_client = get_shared_embedding_client()  # OPTIMIZATION: singleton
        self.collection_name = "chat_history"
        
        # Ensure collection exists (only once)
        self._ensure_collection()
        self._initialized = True
        try:
            import logging
            httpx_logger = logging.getLogger("httpx")
            httpx_logger.setLevel(logging.WARNING)
            httpx_logger.disabled = True
            logging.getLogger("qdrant_client").setLevel(logging.ERROR)
        except Exception:
            pass
    
    def _ensure_collection(self):
        """Ensure chat_history collection exists in Qdrant with proper indexes."""
        try:
            # Get vector size from embedding client (test with sample text)
            sample_vector = self.embedding_client.embed_texts(["sample"])[0]
            vector_size = len(sample_vector)
            ensure_collection(self.client, self.collection_name, vector_size)
            
            # Check existing indexes to avoid redundant creation
            existing_indexes = self._get_existing_indexes()
            
            # Create indexes for filtering fields
            indexes_to_create = [
                ("chat_id", qmodels.PayloadSchemaType.KEYWORD),
                ("message_id", qmodels.PayloadSchemaType.TEXT),
                ("role", qmodels.PayloadSchemaType.KEYWORD),
                ("timestamp", qmodels.PayloadSchemaType.INTEGER)
            ]
            
            for field_name, field_schema in indexes_to_create:
                if field_name in existing_indexes:
                    continue
                    
                try:
                    self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name=field_name,
                        field_schema=field_schema
                    )
                    logger.info("Created index: %s", field_name)
                except Exception as idx_error:
                    # Index might already exist, which is fine
                    if "already exists" not in str(idx_error).lower():
                        logger.warning("Could not create %s index: %s", field_name, type(idx_error).__name__)
            
            logger.info("Chat history collection ensured (vector_size=%d)", vector_size)
        except Exception as e:
            logger.warning("Could not ensure chat collection: %s", type(e).__name__)
    
    def _get_existing_indexes(self):
        """Get list of existing payload indexes for the collection."""
        try:
            collection_info = self.client.get_collection(self.collection_name)
            payload_schema = getattr(collection_info, 'payload_schema', {})
            return list(payload_schema.keys()) if payload_schema else []
        except Exception:
            return []
    
    @classmethod
    def reset_singleton(cls):
        """Reset singleton for testing purposes."""
        cls._instance = None
        cls._initialized = False
    
    def _generate_qdrant_point_id(self, chat_id: str, sequence: int) -> str:
        """Generate UUID-based point ID for Qdrant compatibility."""
        # Create a deterministic UUID from chat_id and sequence
        namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # Fixed namespace
        name = f"{chat_id}::{sequence:06d}"
        return str(uuid.uuid5(namespace, name))
    
    def add_message(self, chat_id: str, role: str, content: str, timestamp: int, 
                   sequence: int, message_id: str, attachments: Optional[List[Dict[str, Any]]] = None):
        """Add message to Qdrant for semantic search with standardized format."""
        try:
            # Generate embedding for the message
            embedding = self.embedding_client.embed_texts([content])[0]
            
            # Use UUID-based point ID for Qdrant compatibility
            point_id = self._generate_qdrant_point_id(chat_id, sequence)
            
            payload = {
                "chat_id": chat_id,
                "message_id": message_id,
                "timestamp": timestamp,
                "role": role,
                "content": content
            }
            # Include attachments if present (JSON only)
            if attachments:
                try:
                    import json as _json
                    payload["attachments"] = _json.loads(_json.dumps(attachments))
                except Exception:
                    payload["attachments"] = []

            point = qmodels.PointStruct(
                id=point_id,
                vector=embedding,
                payload=payload
            )
            
            # Upsert to Qdrant
            upsert_points(self.client, self.collection_name, [point])
            
        except Exception as e:
            logger.warning("Failed to add message to Qdrant: %s", type(e).__name__)
    
    def get_history(self, chat_id: str, limit: int) -> List[Dict[str, Any]]:
        """Get chat history from Qdrant."""
        try:
            # Search for messages by chat_id
            results = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter={
                    "must": [
                        {
                            "key": "chat_id",
                            "match": {"value": chat_id}
                        }
                    ]
                },
                limit=limit,
                with_payload=True
            )
            
            messages = []
            for point in results[0]:  # results[0] contains the points
                payload = point.payload
                messages.append({
                    "message_id": payload.get("message_id"),
                    "timestamp": payload.get("timestamp"),
                    "role": payload.get("role"),
                    "content": payload.get("content"),
                    "attachments": payload.get("attachments")
                })
            
            # Sort by timestamp
            messages.sort(key=lambda x: x.get("timestamp", 0))
            
            return messages
            
        except Exception as e:
            logger.warning("Failed to get history from Qdrant: %s", type(e).__name__)
            return []
    
    def search_history(self, chat_id: str, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search chat history using semantic similarity."""
        try:
            # Generate query embedding
            query_embedding = self.embedding_client.embed_texts([query])[0]
            
            # Search in Qdrant
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter={
                    "must": [
                        {
                            "key": "chat_id",
                            "match": {"value": chat_id}
                        }
                    ]
                },
                limit=limit,
                with_payload=True
            )
            
            messages = []
            for result in results:
                payload = result.payload
                messages.append({
                    "message_id": payload.get("message_id"),
                    "timestamp": payload.get("timestamp"),
                    "role": payload.get("role"),
                    "content": payload.get("content"),
                    "attachments": payload.get("attachments"),
                    "score": result.score
                })
            
            # Sort by timestamp to maintain chronological order
            messages.sort(key=lambda x: x.get("timestamp", 0))
            return messages
            
        except Exception as e:
            logger.warning("Failed to search chat history: %s", type(e).__name__)
            return []
    
    def delete_chat(self, chat_id: str) -> None:
        """Delete all messages for a chat from Qdrant."""
        try:
            # Delete Qdrant points for this chat
            self.client.delete(
                collection_name=self.collection_name,
                points_selector={
                    "filter": {
                        "must": [
                            {
                                "key": "chat_id",
                                "match": {"value": chat_id}
                            }
                        ]
                    }
                }
            )
            logger.debug("Cleaned up Qdrant data")
        except Exception as e:
            logger.warning("Failed to clean up Qdrant data: %s", type(e).__name__)
    
    def chat_exists(self, chat_id: str) -> bool:
        """Check if chat exists in Qdrant."""
        try:
            results = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter={
                    "must": [
                        {
                            "key": "chat_id",
                            "match": {"value": chat_id}
                        }
                    ]
                },
                limit=1,
                with_payload=False
            )
            return len(results[0]) > 0
        except Exception as e:
            logger.warning("Failed to check if chat exists in Qdrant: %s", type(e).__name__)
            return False
    
    def cleanup_old_data(self, days_old: int = 7) -> None:
        """Clean up old data from Qdrant. (Disabled - will be implemented separately)"""
        # TODO: Implement separate cleanup system
        pass
    
    def list_all_chats(self) -> List[str]:
        """List all unique chat IDs in Qdrant."""
        try:
            # Get all points and extract unique chat_ids
            results, _ = self.client.scroll(
                collection_name="chat_history",
                scroll_filter={"must": []},
                limit=10000,  # Adjust based on your needs
                with_payload=True,
                with_vectors=False
            )
            
            chat_ids = set()
            for point in results:
                payload = point.payload if hasattr(point, 'payload') else point.get('payload', {})
                chat_id = payload.get('chat_id')
                if chat_id:
                    chat_ids.add(chat_id)
            
            return list(chat_ids)
        except Exception as e:
            logger.warning("Failed to list chats from Qdrant: %s", type(e).__name__)
            return []
    
    def get_chat_metadata(self, chat_id: str) -> Dict[str, Any]:
        """Get metadata for a specific chat."""
        try:
            # Try to get metadata from a recent message
            results, _ = self.client.scroll(
                collection_name="chat_history",
                scroll_filter={
                    "must": [
                        {"key": "chat_id", "match": {"value": chat_id}}
                    ]
                },
                limit=1,
                with_payload=True,
                with_vectors=False
            )
            
            if results:
                payload = results[0].payload if hasattr(results[0], 'payload') else results[0].get('payload', {})
                return {
                    "last_activity": payload.get("last_activity"),
                    "message_count": payload.get("message_count", 0),
                    "created_at": payload.get("created_at"),
                    "tier": "qdrant"
                }
            else:
                return {"tier": "qdrant"}
                
        except Exception as e:
            logger.warning("Failed to get chat metadata from Qdrant: %s", type(e).__name__)
            return {"tier": "qdrant"}
    
    def set_chat_metadata(self, chat_id: str, metadata: Dict[str, Any]) -> bool:
        """Set metadata for a specific chat."""
        try:
            # Get all messages for this chat with vectors
            results, _ = self.client.scroll(
                collection_name="chat_history",
                scroll_filter={
                    "must": [
                        {"key": "chat_id", "match": {"value": chat_id}}
                    ]
                },
                limit=1000,
                with_payload=True,
                with_vectors=True  # Include vectors for upsert
            )
            
            # Update each message with new metadata
            for point in results:
                payload = point.payload if hasattr(point, 'payload') else point.get('payload', {})
                payload.update(metadata)
                
                # Get the vector from the point
                vector = point.vector if hasattr(point, 'vector') else point.get('vector')
                
                # Update the point with both payload and vector
                self.client.upsert(
                    collection_name="chat_history",
                    points=[{
                        "id": point.id,
                        "vector": vector,
                        "payload": payload
                    }]
                )
            
            return True
            
        except Exception as e:
            logger.warning("Failed to set chat metadata in Qdrant: %s", type(e).__name__)
            return False

# Export the main class
__all__ = ["QdrantStorage"]
