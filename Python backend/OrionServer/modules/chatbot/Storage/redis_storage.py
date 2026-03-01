#!/usr/bin/env python3
"""
Redis Storage Module for Chat History

This module handles all Redis operations for the hybrid storage system.
Redis is used as the hot cache for active conversations (0-3 hours).
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    import redis
except ImportError:
    redis = None

# Redis client singleton
_redis_client = None

from core.config import settings

def get_redis_client():
    """Get Redis client with fallback credentials."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if redis is None:
        if redis is None:
            logger.warning("redis package not installed - Redis functionality disabled")
            return None

    
    redis_url = settings.REDIS_URL
    if not redis_url:
        logger.warning("REDIS_URL not set - Redis functionality disabled")
        return None

    
    
    # Increased timeouts and added retry logic for stability
    _redis_client = redis.from_url(
        redis_url, 
        socket_timeout=10, 
        socket_connect_timeout=10, 
        retry_on_timeout=True
    )
    return _redis_client

class RedisStorage:
    """Redis storage operations for chat history."""
    
    def __init__(self):
        self.client = get_redis_client()
    
    def _key_uv_history(self, user_id: str, video_id: str) -> str:
        """Get Redis key for user-video chat history."""
        return f"chathistory:{user_id}:{video_id}"
    
    def _key_user_index(self, user_id: str) -> str:
        """Get Redis key for user video index."""
        return f"chathistory:index:{user_id}"
    
    def _key_uv_meta(self, user_id: str, video_id: str) -> str:
        """Get Redis key for user-video metadata."""
        return f"chathistory:meta:{user_id}:{video_id}"

    # --- Simple KV helpers (used for auxiliary caches like Video IR) ---
    def get(self, key: str) -> Optional[bytes]:
        """Get raw value for a key (returns bytes or None)."""
        try:
            return self.client.get(key)
        except Exception:
            return None

    def setex(self, key: str, ttl_seconds: int, value: str) -> bool:
        """Set value with TTL (expects JSON/string)."""
        try:
            self.client.setex(key, ttl_seconds, value)
            return True
        except Exception:
            return False
    
    def exists(self, user_id: str, video_id: str) -> bool:
        """Check if chat exists in Redis."""
        try:
            key = self._key_uv_history(user_id, video_id)
            return self.client.exists(key) == 1
        except Exception as e:
            logger.warning("Redis exists check failed: %s", type(e).__name__)
            return False
    
        if ttl_seconds:
            try:
                self.client.expire(key, ttl_seconds)
                self.client.expire(self._key_user_index(user_id), ttl_seconds)
            except Exception:
                pass

    def init_chat(self, user_id: str, video_id: str, ttl_seconds: Optional[int] = None) -> None:
        """Initialize chat in Redis."""
        try:
            key = self._key_uv_history(user_id, video_id)
            self.client.delete(key)
            self.client.sadd(self._key_user_index(user_id), video_id)
            if ttl_seconds:
                self.client.expire(key, ttl_seconds)
                self.client.expire(self._key_user_index(user_id), ttl_seconds)
        except Exception as e:
            logger.warning("Redis init_chat failed: %s", type(e).__name__)
    
    def append_message(self, user_id: str, video_id: str, role: str, content: str, 
                      timestamp: Optional[int] = None, message_id: Optional[str] = None, 
                      ttl_seconds: Optional[int] = None, attachments: Optional[List[Dict[str, Any]]] = None) -> None:
        """Append message to Redis chat history."""
        try:
            if timestamp is None:
                timestamp = int(time.time())
            if message_id is None:
                # Use consistent message ID format with sequence number
                chat_id = f"{user_id}::CHAT::{video_id}"
                # Generate a simple sequence number based on timestamp for fallback
                sequence = int(time.time() * 1000) % 1000000  # Use last 6 digits of timestamp
                message_id = f"{chat_id}::seq_{sequence:06d}"
            
            entry = {
                "message_id": message_id,
                "timestamp": timestamp,
                "role": role,
                "content": content
            }
            # Persist attachments if provided; ensure JSON-serializable (no raw bytes)
            if attachments:
                try:
                    # Shallow copy to avoid side effects
                    entry["attachments"] = json.loads(json.dumps(attachments))
                except Exception:
                    entry["attachments"] = []
            key = self._key_uv_history(user_id, video_id)
            self.client.rpush(key, json.dumps(entry))
            self.client.sadd(self._key_user_index(user_id), video_id)
            if ttl_seconds:
                self.client.expire(key, ttl_seconds)
                self.client.expire(self._key_user_index(user_id), ttl_seconds)
        except Exception as e:
            logger.warning("Redis append_message failed: %s", type(e).__name__)
    
    def get_history(self, user_id: str, video_id: str, last_n: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get chat history from Redis."""
        try:
            key = self._key_uv_history(user_id, video_id)
            length = self.client.llen(key)
            if not length:
                return []
            if last_n is None or last_n >= length:
                raw = self.client.lrange(key, 0, -1)
            else:
                start = max(0, length - last_n)
                raw = self.client.lrange(key, start, -1)
            
            out = []
            for b in raw:
                try:
                    out.append(json.loads(b))
                except Exception:
                    continue
            return out
        except Exception as e:
            logger.warning("Redis get_history failed: %s", type(e).__name__)
            return []

    def update_message_attachments(self, user_id: str, video_id: str, message_id: str, attachments: List[Dict[str, Any]], ttl_seconds: Optional[int] = None) -> bool:
        """Update attachments for a specific message by message_id.

        Returns True if updated, False if message not found.
        """
        try:
            key = self._key_uv_history(user_id, video_id)
            length = self.client.llen(key)
            if not length:
                return False
            updated = False
            for idx in range(0, length):
                raw = self.client.lindex(key, idx)
                if not raw:
                    continue
                try:
                    item = json.loads(raw)
                except Exception:
                    continue
                if item.get("message_id") == message_id:
                    try:
                        # ensure JSON-serializable
                        item["attachments"] = json.loads(json.dumps(attachments))
                    except Exception:
                        item["attachments"] = []
                    self.client.lset(key, idx, json.dumps(item))
                    updated = True
                    break
            if updated and ttl_seconds:
                self.client.expire(key, ttl_seconds)
            return updated
        except Exception as e:
            logger.warning("Redis update_message_attachments failed: %s", type(e).__name__)
            return False
    
    def set_last_activity(self, user_id: str, video_id: str, ts: Optional[int] = None, 
                          ttl_seconds: Optional[int] = None) -> None:
        """Set last activity timestamp in Redis."""
        try:
            if ts is None:
                ts = int(time.time())
            meta_key = self._key_uv_meta(user_id, video_id)
            self.client.hset(meta_key, mapping={"last_activity_ts": ts})
            if ttl_seconds:
                self.client.expire(meta_key, ttl_seconds)
        except Exception as e:
            logger.warning("Redis set_last_activity failed: %s", type(e).__name__)
    
    def get_metadata(self, user_id: str, video_id: str) -> Dict[str, Any]:
        """Get chat metadata from Redis."""
        try:
            meta_key = self._key_uv_meta(user_id, video_id)
            meta = self.client.hgetall(meta_key)
            
            if not meta:
                return {}
            
            # Convert bytes to strings
            result = {}
            for key, value in meta.items():
                if isinstance(key, bytes):
                    key = key.decode('utf-8')
                if isinstance(value, bytes):
                    value = value.decode('utf-8')
                result[key] = value
            
            return result
        except Exception as e:
            logger.warning("Redis get_metadata failed: %s", type(e).__name__)
            return {}
    
    def set_metadata(self, user_id: str, video_id: str, metadata: Dict[str, Any], 
                    ttl_seconds: Optional[int] = None) -> None:
        """Set chat metadata in Redis."""
        try:
            meta_key = self._key_uv_meta(user_id, video_id)
            self.client.hset(meta_key, mapping=metadata)
            if ttl_seconds:
                self.client.expire(meta_key, ttl_seconds)
        except Exception as e:
            logger.warning("Redis set_metadata failed: %s", type(e).__name__)
    
    def delete_chat(self, user_id: str, video_id: str) -> None:
        """Delete a chat's Redis data."""
        try:
            try:
                self.client.delete(self._key_uv_history(user_id, video_id))
            except Exception:
                pass
            try:
                self.client.delete(self._key_uv_meta(user_id, video_id))
            except Exception:
                pass
            try:
                self.client.srem(self._key_user_index(user_id), video_id)
            except Exception:
                pass
        except Exception as e:
            logger.warning("Redis delete_chat failed: %s", type(e).__name__)
            pass
    
    def get_next_sequence(self, chat_id: str) -> int:
        """Get the next sequence number for a chat using Redis atomic increment."""
        try:
            sequence_key = f"chat_seq:{chat_id}"
            return self.client.incr(sequence_key)
        except Exception as e:
            logger.warning("Failed to get sequence number, using timestamp fallback: %s", type(e).__name__)
            # Fallback to timestamp-based sequence if Redis fails
            return int(time.time() * 1000)  # Use millisecond timestamp as fallback
    
    def list_active_sessions(self) -> List[Dict[str, Any]]:
        """List all active chat sessions from Redis."""
        try:
            sessions = []
            # Get all user index keys (format: chathistory:index:{user_id})
            user_keys = self.client.keys("chathistory:index:*")
            
            for user_key in user_keys:
                # Key is bytes, decode and remove prefix
                key_str = user_key.decode('utf-8')
                user_id = key_str.replace("chathistory:index:", "")
                
                # Get all video IDs for this user
                video_ids = self.client.smembers(user_key)
                
                for video_id_bytes in video_ids:
                    video_id = video_id_bytes.decode('utf-8')
                    chat_id = f"{user_id}::CHAT::{video_id}"
                    
                    # Get metadata to check if session is active
                    metadata = self.get_metadata(user_id, video_id)
                    if metadata:
                        sessions.append({
                            "chat_id": chat_id,
                            "user_id": user_id,
                            "video_id": video_id,
                            "metadata": metadata
                        })
            
            return sessions
        except Exception as e:
            logger.warning("Failed to list active sessions: %s", type(e).__name__)
            return []

# Export the main class
__all__ = ["RedisStorage"]
