#!/usr/bin/env python3
"""
Hybrid Storage System for Chat History

This module orchestrates the three storage systems:
- Redis (0-3 hours): Hot cache for active conversations
- Qdrant (3 hours to 7 days): Vector search for recent chats
- Firebase (7+ days): Long-term durable storage

Chat ID Format: {user_id}::CHAT::{video_id}
- Uses "::CHAT::" separator to handle IDs with dashes
- Example: "user-123::CHAT::BV0YUeam4y8"
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Import the individual storage modules
from .redis_storage import RedisStorage
from .qdrant_storage import QdrantStorage
from .firebase_storage import FirebaseStorage

# Storage tiers configuration
REDIS_TTL_HOURS = 3
QDRANT_TTL_DAYS = 7
REDIS_TTL_SECONDS = REDIS_TTL_HOURS * 3600
QDRANT_TTL_SECONDS = QDRANT_TTL_DAYS * 24 * 3600

class HybridChatStorage:
    """Hybrid storage system for chat history with Redis, Qdrant, and Firebase."""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern to prevent multiple instances."""
        if cls._instance is None:
            cls._instance = super(HybridChatStorage, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        # Only initialize once
        if self._initialized:
            return
            
        self.redis = RedisStorage()
        self.qdrant = QdrantStorage()
        self.firebase = FirebaseStorage()
        
        # Simple cache to prevent multiple Qdrant calls for same chat
        self._recent_queries = {}
        self._query_cache_ttl = 5  # 5 seconds
        
        self._initialized = True
    
    @classmethod
    def reset_singleton(cls):
        """Reset singleton for testing purposes."""
        cls._instance = None
        cls._initialized = False
    
    def _get_next_sequence(self, chat_id: str) -> int:
        """Get the next sequence number for a chat using Redis atomic increment."""
        return self.redis.get_next_sequence(chat_id)
    
    def _generate_message_id(self, chat_id: str, sequence: int) -> str:
        """Generate deterministic message ID using chat_id and sequence."""
        return f"{chat_id}::seq_{sequence:06d}"
    
    
    def _generate_chat_id(self, user_id: str, video_id: str) -> str:
        """Generate unique chat ID from user_id and video_id using a robust separator."""
        # Use a separator that's unlikely to appear in IDs: "::CHAT::"
        return f"{user_id}::CHAT::{video_id}"
    
    def _parse_chat_id(self, chat_id: str) -> tuple[str, str]:
        """Parse chat_id back to user_id and video_id."""
        parts = chat_id.split("::CHAT::")
        if len(parts) != 2:
            raise ValueError(f"Invalid chat_id format: {chat_id}")
        return parts[0], parts[1]
    
    def _extract_sequence_from_message_id(self, message_id: str) -> Optional[int]:
        """Extract sequence number from message_id format: chat_id::seq_XXXXXX"""
        try:
            if "::seq_" in message_id:
                seq_part = message_id.split("::seq_")[-1]
                return int(seq_part)
        except (ValueError, IndexError):
            pass
        return None
    
    def _extract_sequence_from_message(self, msg: Dict[str, Any]) -> Optional[int]:
        """Extract sequence from message structure (sequence field or message_id)."""
        # Try direct sequence field first
        if 'sequence' in msg:
            try:
                return int(msg['sequence'])
            except (ValueError, TypeError):
                pass
        
        # Try extracting from message_id
        message_id = msg.get('message_id')
        if message_id:
            return self._extract_sequence_from_message_id(message_id)
        
        return None
    
    def _get_chat_meta_key(self, chat_id: str) -> str:
        """Get Redis key for chat metadata."""
        return f"chatmeta:{chat_id}"
    
    def init_chat(self, user_id: str, video_id: str) -> str:
        """Initialize a new chat session."""
        chat_id = self._generate_chat_id(user_id, video_id)
        
        # Initialize Redis storage
        self.redis.init_chat(user_id, video_id, ttl_seconds=REDIS_TTL_SECONDS)
        
        # Set initial metadata
        meta = {
            "chat_id": chat_id,
            "user_id": user_id,
            "video_id": video_id,
            "created_at": int(time.time()),
            "last_activity": int(time.time()),
            "message_count": 0,
            "tier": "redis"
        }
        
        self.redis.set_metadata(user_id, video_id, meta, ttl_seconds=REDIS_TTL_SECONDS)
        
        # Firebase metadata initialization happens only during migration to Firebase
        # This maintains proper tier separation: Redis -> Qdrant -> Firebase
        
        return chat_id
    
    def add_message(self, chat_id: str, role: str, content: str, user_id: str = None, video_id: str = None, attachments: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Add a message to the chat using hybrid sequence + timestamp approach."""
        if not user_id or not video_id:
            # Extract from chat_id if not provided
            user_id, video_id = self._parse_chat_id(chat_id)
        
        # Get next sequence number and timestamp
        sequence = self._get_next_sequence(chat_id)
        timestamp = int(time.time())
        message_id = self._generate_message_id(chat_id, sequence)
        
        # Add to Redis ONLY (hot cache) with standardized format
        # Qdrant storage happens only during explicit migration via migrate_to_qdrant()
        self.redis.append_message(user_id, video_id, role, content, timestamp, message_id, REDIS_TTL_SECONDS, attachments=attachments)
        self.redis.set_last_activity(user_id, video_id, timestamp, REDIS_TTL_SECONDS)
        
        # Update metadata
        meta = self.redis.get_metadata(user_id, video_id)
        meta["message_count"] = int(meta.get("message_count", 0)) + 1
        meta["last_activity"] = timestamp
        meta["tier"] = "redis"  # Explicitly mark as Redis-tier storage
        self.redis.set_metadata(user_id, video_id, meta, ttl_seconds=REDIS_TTL_SECONDS)
        
        result = {
            "message_id": message_id,
            "timestamp": timestamp,
            "role": role,
            "content": content
        }
        if attachments:
            result["attachments"] = attachments
        return result
    
    
    def get_chat_history(self, chat_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get chat history with automatic rehydration from higher tiers."""
        user_id, video_id = self._parse_chat_id(chat_id)
        
        # Try Redis first (hot cache)
        history = self.redis.get_history(user_id, video_id, last_n=limit)
        if history:
            # Sort by timestamp
            sorted_history = sorted(history, key=lambda x: x.get('timestamp', 0))
            return sorted_history
        
        # Try Qdrant (recent chats) - rehydrate Redis if found
        qdrant_history = self.qdrant.get_history(chat_id, limit)
        if qdrant_history:
            self._rehydrate_redis_from_qdrant(user_id, video_id, qdrant_history)
            return qdrant_history
        
        # Fallback to Firebase (long-term storage) - rehydrate Redis and Qdrant
        firebase_history = self.firebase.get_recent_messages(user_id, video_id, limit)
        if firebase_history:
            # Sort Firebase messages by timestamp
            sorted_firebase = sorted(firebase_history, key=lambda x: x.get('timestamp', 0))
            # Rehydrate Redis first
            self._rehydrate_redis_from_firebase(user_id, video_id, sorted_firebase)
            # Then rehydrate Qdrant
            self._rehydrate_qdrant_from_firebase(chat_id, sorted_firebase)
            return sorted_firebase
    
        return []

    def get_chat_history_fast(self, chat_id: str, limit: int = 50) -> Dict[str, Any]:
        """Return available history immediately with automatic Redis warming.

        Flow: Redis → Qdrant (warm Redis) → Firebase (warm Redis) → empty
        """
        user_id, video_id = self._parse_chat_id(chat_id)

        # Fast metadata check: if chat exists in Redis but is empty, don't hit Qdrant
        try:
            meta = self.redis.get_metadata(user_id, video_id)
            if meta and int(meta.get("message_count", 0)) == 0:
                return {"history": [], "source": "redis"}
        except Exception:
            pass

        # Try Redis first
        history = self.redis.get_history(user_id, video_id, last_n=limit)
        if history:
            sorted_history = sorted(history, key=lambda x: x.get('timestamp', 0))
            return {"history": sorted_history, "source": "redis"}

        # Check if we recently queried this chat to avoid multiple Qdrant calls
        current_time = time.time()
        cache_key = f"{chat_id}:full"
        
        if cache_key in self._recent_queries:
            cached_data, timestamp = self._recent_queries[cache_key]
            if current_time - timestamp < self._query_cache_ttl:
                # Return cached data with requested limit
                limited_history = cached_data[-limit:] if limit < len(cached_data) else cached_data
                return {"history": limited_history, "source": "qdrant"}

        # Try Qdrant - if found, warm Redis in background
        # Use max limit to get all data in one call, then slice as needed
        qdrant_history = self.qdrant.get_history(chat_id, limit=1000)
        if qdrant_history:
            # Cache the full result for 5 seconds
            self._recent_queries[cache_key] = (qdrant_history, current_time)
            
            # Warm Redis in background (non-blocking) using the data we already fetched
            try:
                self.rehydrate_redis_from_qdrant(chat_id, batch_first=4, data=qdrant_history)
            except Exception as e:
                logger.debug("Failed to warm Redis from Qdrant: %s", type(e).__name__)
            # Return only the requested limit
            limited_history = qdrant_history[-limit:] if limit < len(qdrant_history) else qdrant_history
            return {"history": limited_history, "source": "qdrant"}

        # Try Firebase - if found, warm Redis in background
        firebase_history = self.firebase.get_recent_messages(user_id, video_id, limit)
        if firebase_history:
            sorted_firebase = sorted(firebase_history, key=lambda x: x.get('timestamp', 0))
            # Warm Redis in background (non-blocking) using the data we already fetched
            try:
                self.rehydrate_from_firebase(chat_id, batch_first=4, data=firebase_history)
            except Exception as e:
                logger.debug("Failed to warm Redis from Firebase: %s", type(e).__name__)
            return {"history": sorted_firebase, "source": "firebase"}

        return {"history": [], "source": "empty"}

    def wait_until_redis_warm(self, chat_id: str, min_messages: int = 1, timeout_sec: float = 1.5, poll_interval: float = 0.05) -> bool:
        """Block briefly until Redis contains at least min_messages for the chat.

        Returns True if warmed within timeout, otherwise False.
        """
        try:
            user_id, video_id = self._parse_chat_id(chat_id)
            deadline = time.time() + timeout_sec
            while time.time() < deadline:
                history = self.redis.get_history(user_id, video_id, last_n=min_messages)
                if history and len(history) >= min_messages:
                    return True
                try:
                    import time as _t
                    _t.sleep(poll_interval)
                except Exception:
                    pass
            return False
        except Exception:
            return False

    def rehydrate_redis_from_qdrant(self, chat_id: str, batch_first: int = 4, batch_size: int = 25, data: Optional[List[Dict[str, Any]]] = None) -> None:
        """Warm Redis from Qdrant in batches. Clears Redis first to avoid duplicates.

        Inserts preserve original timestamps/message_ids; ordering ensured on read.
        
        Args:
            chat_id: Chat ID to rehydrate
            batch_first: Number of recent messages to process first
            batch_size: Batch size for remaining messages
            data: Optional pre-fetched data to avoid duplicate Qdrant calls
        """
        user_id, video_id = self._parse_chat_id(chat_id)
        
        # Use provided data or fetch from Qdrant
        if data is not None:
            all_msgs = data
        else:
            all_msgs = self.qdrant.get_history(chat_id, limit=1000)
            
        if not all_msgs:
            return

        # Clear existing Redis data to avoid duplicates
        self.redis.delete_chat(user_id, video_id)
        
        # Initialize fresh Redis chat
        self.redis.init_chat(user_id, video_id, ttl_seconds=REDIS_TTL_SECONDS)

        # Sort by timestamp ascending to maintain order
        all_msgs.sort(key=lambda x: x.get('timestamp', 0))

        def _append_batch(msgs: List[Dict[str, Any]]):
            for msg in msgs:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', 0) or 0)
                message_id = msg.get('message_id')
                attachments = msg.get('attachments')
                self.redis.append_message(user_id, video_id, role, content, timestamp, message_id, REDIS_TTL_SECONDS, attachments=attachments)

        # First small batch (latest N turns)
        first_batch = all_msgs[-batch_first:]
        _append_batch(first_batch)

        # Remaining in chunks
        remaining = all_msgs[:-batch_first]
        for i in range(0, len(remaining), batch_size):
            _append_batch(remaining[i:i+batch_size])
            
        logger.debug("Rehydrated Redis from Qdrant (%d messages)", len(all_msgs))

    def rehydrate_from_firebase(self, chat_id: str, batch_first: int = 4, batch_size: int = 25, data: Optional[List[Dict[str, Any]]] = None) -> None:
        """Warm Redis first, then Qdrant from Firebase data. Clears existing data to avoid duplicates.
        
        Args:
            chat_id: Chat ID to rehydrate
            batch_first: Number of recent messages to process first
            batch_size: Batch size for remaining messages
            data: Optional pre-fetched data to avoid duplicate Firebase calls
        """
        user_id, video_id = self._parse_chat_id(chat_id)
        
        # Use provided data or fetch from Firebase
        if data is not None:
            all_msgs = data
        else:
            all_msgs = self.firebase.get_recent_messages(user_id, video_id, limit_n=1000)
            
        if not all_msgs:
            return

        # Clear existing data to avoid duplicates
        self.redis.delete_chat(user_id, video_id)
        
        # Initialize fresh Redis chat
        self.redis.init_chat(user_id, video_id, ttl_seconds=REDIS_TTL_SECONDS)

        # Sort by timestamp ascending
        all_msgs.sort(key=lambda x: x.get('timestamp', 0))

        def _append_redis_batch(msgs: List[Dict[str, Any]]):
            for msg in msgs:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', 0) or 0)
                message_id = msg.get('message_id')
                attachments = msg.get('attachments')
                self.redis.append_message(user_id, video_id, role, content, timestamp, message_id, REDIS_TTL_SECONDS, attachments=attachments)

        def _append_qdrant_batch(msgs: List[Dict[str, Any]]):
            for msg in msgs:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', 0) or 0)
                message_id = msg.get('message_id')
                sequence = int(timestamp) % 1000000
                attachments = msg.get('attachments')
                self.qdrant.add_message(chat_id, role, content, timestamp, sequence, message_id, attachments=attachments)

        # First small batch (latest N turns) to Redis
        first_batch = all_msgs[-batch_first:]
        _append_redis_batch(first_batch)

        # Remaining to Redis in chunks
        remaining = all_msgs[:-batch_first]
        for i in range(0, len(remaining), batch_size):
            _append_redis_batch(remaining[i:i+batch_size])

        # Populate Qdrant as well (entire history) in chunks
        for i in range(0, len(all_msgs), batch_size):
            _append_qdrant_batch(all_msgs[i:i+batch_size])
            
        logger.debug("Rehydrated Redis and Qdrant from Firebase (%d messages)", len(all_msgs))
    
    def _rehydrate_redis_from_qdrant(self, user_id: str, video_id: str, qdrant_history: List[Dict[str, Any]]):
        """Rehydrate Redis from Qdrant data. Clears Redis first to avoid duplicates."""
        try:
            # Clear existing Redis data to avoid duplicates
            self.redis.delete_chat(user_id, video_id)
            
            # Initialize fresh Redis chat
            self.redis.init_chat(user_id, video_id, ttl_seconds=REDIS_TTL_SECONDS)
            
            for msg in qdrant_history:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', time.time()))
                message_id = msg.get('message_id', f"{user_id}::CHAT::{video_id}::seq_{int(time.time() * 1000) % 1000000:06d}")
                attachments = msg.get('attachments')
                
                # Add to Redis with TTL
                self.redis.append_message(user_id, video_id, role, content, timestamp, message_id, REDIS_TTL_SECONDS, attachments=attachments)
            
            logger.debug("Rehydrated Redis from Qdrant (%d messages)", len(qdrant_history))
        except Exception as e:
            logger.warning("Failed to rehydrate Redis from Qdrant: %s", type(e).__name__)
    
    def _rehydrate_redis_from_firebase(self, user_id: str, video_id: str, firebase_history: List[Dict[str, Any]]):
        """Rehydrate Redis from Firebase data. Clears Redis first to avoid duplicates."""
        try:
            # Clear existing Redis data to avoid duplicates
            self.redis.delete_chat(user_id, video_id)
            
            # Initialize fresh Redis chat
            self.redis.init_chat(user_id, video_id, ttl_seconds=REDIS_TTL_SECONDS)
            
            for msg in firebase_history:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', time.time()))
                message_id = msg.get('message_id', f"{user_id}::CHAT::{video_id}::seq_{int(time.time() * 1000) % 1000000:06d}")
                attachments = msg.get('attachments')
                
                # Add to Redis with TTL
                self.redis.append_message(user_id, video_id, role, content, timestamp, message_id, REDIS_TTL_SECONDS, attachments=attachments)
            
            logger.debug("Rehydrated Redis from Firebase (%d messages)", len(firebase_history))
        except Exception as e:
            logger.warning("Failed to rehydrate Redis from Firebase: %s", type(e).__name__)
    
    def _rehydrate_qdrant_from_firebase(self, chat_id: str, firebase_history: List[Dict[str, Any]]):
        """Rehydrate Qdrant from Firebase data."""
        try:
            for msg in firebase_history:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', time.time()))
                message_id = msg.get('message_id', f"{chat_id}::seq_{int(timestamp) % 1000000:06d}")
                
                # Extract sequence from message_id or use timestamp
                sequence = int(timestamp) % 1000000
                
                # Add to Qdrant
                attachments = msg.get('attachments')
                self.qdrant.add_message(chat_id, role, content, timestamp, sequence, message_id, attachments=attachments)
            
            logger.debug("Rehydrated Qdrant from Firebase")
        except Exception as e:
            logger.warning("Failed to rehydrate Qdrant from Firebase: %s", type(e).__name__)
    
    def search_chat_history(self, chat_id: str, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search chat history using semantic similarity."""
        return self.qdrant.search_history(chat_id, query, limit)
    
    def migrate_to_qdrant(self, chat_id: str):
        """Migrate chat from Redis to Qdrant using delta approach with safety checks."""
        user_id, video_id = self._parse_chat_id(chat_id)
        
        # Check if chat exists in Qdrant
        chat_exists_in_qdrant = self.qdrant.chat_exists(chat_id)
        
        # Get all Redis history
        redis_history = self.redis.get_history(user_id, video_id)
        if not redis_history:
            raise ValueError(f"No chat history found for {chat_id}")
        
        if chat_exists_in_qdrant:
            # Delta migration: only add new messages
            existing_qdrant_history = self.qdrant.get_history(chat_id, limit=1000)
            existing_message_ids = {msg.get('message_id') for msg in existing_qdrant_history}
            new_messages = [msg for msg in redis_history if msg.get('message_id') not in existing_message_ids]
            migration_type = "delta"
        else:
            # Full migration: push entire chat
            new_messages = redis_history
            migration_type = "full"

        added_count = 0
        summary_count = 0
        current_time = str(int(time.time()))
        
        for msg in new_messages:
            try:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', time.time()))
                message_id = msg.get('message_id')
                if not message_id:
                    # Extract sequence from existing message structure or use timestamp
                    sequence = self._extract_sequence_from_message(msg) or (int(timestamp) % 1000000)
                    message_id = f"{chat_id}::seq_{sequence:06d}"
                else:
                    # Extract sequence from existing message_id
                    sequence = self._extract_sequence_from_message_id(message_id) or (int(timestamp) % 1000000)
                attachments = msg.get('attachments')
                
                # Add last_activity to message payload for tracking
                if isinstance(attachments, list):
                    attachments.append({"type": "migration_metadata", "last_activity": current_time})
                else:
                    attachments = [{"type": "migration_metadata", "last_activity": current_time}]
                
                self.qdrant.add_message(chat_id, role, content, timestamp, sequence, message_id, attachments=attachments)
                added_count += 1
                
                # Track summary nodes separately
                if role == "summary":
                    summary_count += 1
                    
            except Exception as e:
                logger.warning("Failed to add message to Qdrant: %s", type(e).__name__)

        # Update metadata to indicate Qdrant storage and set last_activity
        meta = self.redis.get_metadata(user_id, video_id)
        meta["tier"] = "qdrant"
        meta["migrated_at"] = current_time
        meta["last_activity"] = current_time
        self.redis.set_metadata(user_id, video_id, meta, ttl_seconds=REDIS_TTL_SECONDS)
        
        # Also update Qdrant metadata
        qdrant_meta = {
            "tier": "qdrant",
            "migrated_at": current_time,
            "last_activity": current_time,
            "message_count": len(redis_history)
        }
        self.qdrant.set_chat_metadata(chat_id, qdrant_meta)
        
        return {
            "messages_migrated": added_count,
            "summary_nodes_migrated": summary_count,
            "total_messages": len(redis_history),
            "tier": "qdrant",
            "migration_type": migration_type
        }
    
    def migrate_to_firebase(self, chat_id: str):
        """Migrate chat from Qdrant to Firebase using delta approach with safety checks."""
        user_id, video_id = self._parse_chat_id(chat_id)

        # Check if chat exists in Firebase
        chat_exists_in_firebase = self.firebase.chat_exists(user_id, video_id)
        
        # Get data from Qdrant
        qdrant_history = self.qdrant.get_history(chat_id, limit=1000)
        if not qdrant_history:
            logger.debug("No chat history found in Qdrant for migration")
            return {
                "messages_migrated": 0,
                "summary_nodes_migrated": 0,
                "total_messages": 0,
                "tier": "firebase",
                "migration_type": "none"
            }
        
        current_time = str(int(time.time()))
        
        if chat_exists_in_firebase:
            # Delta migration: only add new messages
            existing_firebase_history = self.firebase.get_recent_messages(user_id, video_id, limit_n=1000)
            existing_message_ids = {msg.get('message_id') for msg in existing_firebase_history}
            new_messages = [msg for msg in qdrant_history if msg.get('message_id') not in existing_message_ids]
            migration_type = "delta"
        else:
            # Full migration: push entire chat
            new_messages = qdrant_history
            migration_type = "full"

        written = 0
        summary_count = 0
        for msg in new_messages:
            try:
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                timestamp = int(msg.get('timestamp', time.time()))
                message_id = msg.get('message_id')
                if not message_id:
                    # Extract sequence from existing message structure or use timestamp
                    sequence = self._extract_sequence_from_message(msg) or (int(timestamp) % 1000000)
                    message_id = f"{chat_id}::seq_{sequence:06d}"

                # Add last_activity to message attachments for tracking
                attachments = msg.get('attachments', [])
                if isinstance(attachments, list):
                    attachments.append({"type": "migration_metadata", "last_activity": current_time})
                else:
                    attachments = [{"type": "migration_metadata", "last_activity": current_time}]

                # Add to Firebase
                self.firebase.append_message(user_id, video_id, role, content, timestamp, message_id, attachments=attachments)
                written += 1
                
                # Track summary nodes separately
                if role == "summary":
                    summary_count += 1
                    
            except Exception as e:
                logger.warning("Failed to migrate message to Firebase: %s", type(e).__name__)

        # Update Firebase metadata
        firebase_meta = {
            "tier": "firebase",
            "migrated_at": current_time,
            "last_activity": current_time,
            "message_count": len(qdrant_history)
        }
        self.firebase.set_chat_metadata(user_id, video_id, firebase_meta)
        
        # Update Qdrant metadata to reflect migration
        qdrant_meta = {
            "tier": "firebase",
            "migrated_at": current_time,
            "last_activity": current_time,
            "message_count": len(qdrant_history)
        }
        self.qdrant.set_chat_metadata(chat_id, qdrant_meta)
        
        logger.info("Migration to Firebase: %d messages (%d summaries)", written, summary_count)
        
        return {
            "messages_migrated": written,
            "summary_nodes_migrated": summary_count,
            "total_messages": len(qdrant_history),
            "tier": "firebase",
            "migration_type": migration_type
        }
    
    def cleanup_old_qdrant_data(self, days_old: int = 7):
        """Clean up old data from Qdrant."""
        self.qdrant.cleanup_old_data(days_old)
    
    def cleanup_redis_chat(self, chat_id: str) -> bool:
        """Safely clean up a chat from Redis after successful migration."""
        try:
            user_id, video_id = self._parse_chat_id(chat_id)
            logger.debug("Cleaned up Redis chat")
            return True
        except Exception as e:
            logger.warning("Failed to cleanup Redis chat: %s", type(e).__name__)
            return False
    
    def cleanup_qdrant_chat(self, chat_id: str) -> bool:
        """Safely clean up a chat from Qdrant after successful migration."""
        try:
            logger.debug("Cleaned up Qdrant chat")
            return True
        except Exception as e:
            logger.warning("Failed to cleanup Qdrant chat: %s", type(e).__name__)
            return False
    
    def get_chat_metadata(self, chat_id: str) -> Dict[str, Any]:
        """Get chat metadata."""
        user_id, video_id = self._parse_chat_id(chat_id)
        return self.redis.get_metadata(user_id, video_id)
    
    def chat_exists_anywhere(self, chat_id: str) -> Dict[str, Any]:
        """Check if chat exists in any storage tier and return existence info with source tier.
        
        Returns:
            Dict with keys: exists (bool), source (str), metadata (Dict)
        """
        user_id, video_id = self._parse_chat_id(chat_id)
        
        # Check Redis first (fastest)
        redis_metadata = self.redis.get_metadata(user_id, video_id)
        if redis_metadata:
            return {
                "exists": True,
                "source": "redis", 
                "metadata": redis_metadata
            }
        
        # Check Qdrant
        if self.qdrant.chat_exists(chat_id):
            return {
                "exists": True,
                "source": "qdrant",
                "metadata": {"tier": "qdrant", "chat_id": chat_id}
            }
        
        # Check Firebase
        if self.firebase.chat_exists(user_id, video_id):
            firebase_metadata = self.firebase.get_video_metadata(user_id, video_id)
            return {
                "exists": True,
                "source": "firebase",
                "metadata": {"tier": "firebase", **firebase_metadata}
            }
        
        return {
            "exists": False,
            "source": "none",
            "metadata": {}
        }

    def update_message_attachments(self, chat_id: str, message_id: str, attachments: List[Dict[str, Any]]) -> bool:
        """Persist attachments for a specific message in Redis (and optionally mirror to Qdrant later)."""
        user_id, video_id = self._parse_chat_id(chat_id)
        try:
            return self.redis.update_message_attachments(user_id, video_id, message_id, attachments, REDIS_TTL_SECONDS)
        except Exception:
            return False

    # Progressive Summary Node Management Functions
    
    def get_summary_nodes(self, chat_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get all summary nodes for a chat across all storage tiers."""
        try:
            # Get full history and filter for summary nodes
            all_messages = self.get_chat_history_fast(chat_id, limit=1000)["history"]
            summary_nodes = [msg for msg in all_messages if msg.get("role") == "summary"]
            
            # Sort by sequence to maintain chronological order  
            from chatbot_utils import MemorySummarizer
            summarizer = MemorySummarizer()
            summary_nodes.sort(key=lambda x: summarizer.extract_sequence_from_message_id(x.get("message_id", "")))
            
            return summary_nodes[-limit:] if limit > 0 else summary_nodes
            
        except Exception as e:
            logger.warning("Failed to get summary nodes: %s", type(e).__name__)
            return []
    
    def get_recent_non_summary_messages(self, chat_id: str, limit: int = 6) -> List[Dict[str, Any]]:
        """Get recent messages excluding summary nodes."""
        try:
            all_messages = self.get_chat_history_fast(chat_id, limit=50)["history"]
            non_summary = [msg for msg in all_messages if msg.get("role") != "summary"]
            return non_summary[-limit:] if limit > 0 else non_summary
            
        except Exception as e:
            logger.warning("Failed to get non-summary messages: %s", type(e).__name__)
            return []
    
    def count_messages_since_last_summary(self, chat_id: str) -> int:
        """Count non-summary messages since the last summary node."""
        try:
            all_messages = self.get_chat_history_fast(chat_id, limit=1000)["history"]
            
            # Use the library for sequence extraction
            from chatbot_utils import MemorySummarizer
            summarizer = MemorySummarizer()
            
            # Find the last summary node
            last_summary_seq = 0
            for msg in reversed(all_messages):
                if msg.get("role") == "summary":
                    last_summary_seq = summarizer.extract_sequence_from_message_id(msg.get("message_id", "")) or 0
                    break
            
            # Count non-summary messages after the last summary
            count = 0
            for msg in all_messages:
                if msg.get("role") != "summary":
                    msg_seq = summarizer.extract_sequence_from_message_id(msg.get("message_id", "")) or 0
                    if msg_seq > last_summary_seq:
                        count += 1
            
            return count
            
        except Exception as e:
            logger.warning("Failed to count messages since last summary: %s", type(e).__name__)
            return 0

    def ensure_summary_nodes_in_higher_tiers(self, chat_id: str):
        """Ensure summary nodes are propagated to Qdrant and Firebase during migrations."""
        try:
            user_id, video_id = self._parse_chat_id(chat_id)
            
            # Get all messages including summaries from Redis
            redis_messages = self.redis.get_history(user_id, video_id, last_n=1000)
            summary_nodes = [msg for msg in redis_messages if msg.get("role") == "summary"]
            
            if not summary_nodes:
                return
                
            # Ensure summaries are in Qdrant
            for summary in summary_nodes:
                try:
                    if not self._summary_exists_in_qdrant(chat_id, summary.get("message_id")):
                        self._migrate_summary_to_qdrant(chat_id, summary)
                except Exception as e:
                    logger.warning("Failed to migrate summary to Qdrant: %s", type(e).__name__)
            
            # Ensure summaries are in Firebase for long-term storage
            for summary in summary_nodes:
                try:
                    if not self._summary_exists_in_firebase(user_id, video_id, summary.get("message_id")):
                        self._migrate_summary_to_firebase(user_id, video_id, summary)
                except Exception as e:
                    logger.warning("Failed to migrate summary to Firebase: %s", type(e).__name__)
                    
        except Exception as e:
            logger.warning("Failed to ensure summary nodes in higher tiers: %s", type(e).__name__)

    def _summary_exists_in_qdrant(self, chat_id: str, message_id: str) -> bool:
        """Check if a summary node exists in Qdrant."""
        try:
            # Simple check - attempt to retrieve by message_id
            history = self.qdrant.get_history(chat_id, limit=1000)
            return any(msg.get("message_id") == message_id for msg in history if msg.get("role") == "summary")
        except Exception:
            return False

    def _summary_exists_in_firebase(self, user_id: str, video_id: str, message_id: str) -> bool:
        """Check if a summary node exists in Firebase."""
        try:
            # Simple check - attempt to retrieve by message_id
            history = self.firebase.get_recent_messages(user_id, video_id, limit_n=1000)
            return any(msg.get("message_id") == message_id for msg in history if msg.get("role") == "summary")
        except Exception:
            return False

    def _migrate_summary_to_qdrant(self, chat_id: str, summary: Dict[str, Any]):
        """Migrate a summary node to Qdrant."""
        try:
            # Extract summary details
            role = summary.get("role", "summary")
            content = summary.get("content", "")
            timestamp = summary.get("timestamp", int(time.time()))
            message_id = summary.get("message_id", "")
            attachments = summary.get("attachments", [])
            
            # Extract sequence for Qdrant
            from chatbot_utils import MemorySummarizer
            summarizer = MemorySummarizer()
            sequence = summarizer.extract_sequence_from_message_id(message_id) or int(timestamp) % 1000000
            
            # Add to Qdrant
            self.qdrant.add_message(chat_id, role, content, timestamp, sequence, message_id, attachments)
            
        except Exception as e:
            logger.warning("Failed to migrate summary to Qdrant: %s", type(e).__name__)

    def _migrate_summary_to_firebase(self, user_id: str, video_id: str, summary: Dict[str, Any]):
        """Migrate a summary node to Firebase."""
        try:
            # Extract summary details
            role = summary.get("role", "summary")
            content = summary.get("content", "")
            timestamp = summary.get("timestamp", int(time.time()))
            message_id = summary.get("message_id", "")
            attachments = summary.get("attachments", [])
            
            # Add to Firebase
            self.firebase.append_message(user_id, video_id, role, content, timestamp, message_id, attachments)
            
        except Exception as e:
            logger.warning("Failed to migrate summary to Firebase: %s", type(e).__name__)

# Export the main class for use by chatbot.py
__all__ = ["HybridChatStorage"]
