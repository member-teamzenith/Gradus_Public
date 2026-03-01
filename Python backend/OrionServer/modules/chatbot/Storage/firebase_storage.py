"""
Firebase Storage Module for Chat History

This module handles all Firebase Firestore operations for the hybrid storage system.
Firebase is used for long-term durable storage (7+ days).
"""

from __future__ import annotations
import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    firebase_admin = None
    credentials = None
    firestore = None

# Firebase client singleton
_firestore_client = None

from core.config import settings

def get_firestore_client():
    """Get Firestore client with fallback credentials."""
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client
    if firebase_admin is None:
        raise RuntimeError("firebase-admin not installed. pip install firebase-admin")
    
    if not firebase_admin._apps:
        try:
            # Check for JSON string in settings first
            if settings.GOOGLE_APPLICATION_CREDENTIALS_JSON:
                import json as json_lib
                cred_dict = json_lib.loads(settings.GOOGLE_APPLICATION_CREDENTIALS_JSON)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
            # Check for file path in settings
            elif settings.GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS):
                cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
                firebase_admin.initialize_app(cred)
            else:
                logger.warning("Google Credentials not found - Firebase disabled")
        except Exception as e:
            logger.error("Error initializing Firebase: %s", type(e).__name__)
    
    _firestore_client = firestore.client()
    return _firestore_client

class FirebaseStorage:
    """Firebase storage operations for chat history."""
    
    def __init__(self):
        self.client = get_firestore_client()
        self.collection_name = "chat_history"
    
    def upsert_chat_metadata(self, user_id: str, video_id: str) -> None:
        """Create/update chat metadata in Firebase."""
        now = firestore.SERVER_TIMESTAMP
        self.client.collection(self.collection_name).document(user_id).collection("videos").document(video_id).set({
            "created_at": now,
            "updated_at": now,
            "last_persisted_ts": firestore.DELETE_FIELD,
        }, merge=True)
    
    def append_message(self, user_id: str, video_id: str, role: str, content: str, 
                     timestamp: Optional[int] = None, message_id: Optional[str] = None, attachments: Optional[List[Dict[str, Any]]] = None) -> None:
        """Append message to Firebase."""
        if timestamp is None:
            timestamp = int(time.time())
        if message_id is None:
            # Use consistent message ID format with sequence number
            chat_id = f"{user_id}::CHAT::{video_id}"
            # Generate a simple sequence number based on timestamp for fallback
            sequence = int(time.time() * 1000) % 1000000  # Use last 6 digits of timestamp
            message_id = f"{chat_id}::seq_{sequence:06d}"
        
        msg = {
            "message_id": message_id,
            "timestamp": timestamp,
            "role": role,
            "content": content
        }
        if attachments:
            try:
                import json as _json
                msg["attachments"] = _json.loads(_json.dumps(attachments))
            except Exception:
                msg["attachments"] = []
        self.client.collection(self.collection_name).document(user_id).collection("videos").document(video_id).collection("messages").add(msg)
        self.client.collection(self.collection_name).document(user_id).collection("videos").document(video_id).set({"updated_at": firestore.SERVER_TIMESTAMP}, merge=True)
    
    def get_recent_messages(self, user_id: str, video_id: str, limit_n: int = 20) -> List[Dict[str, Any]]:
        """Get recent messages from Firebase."""
        q = (self.client.collection(self.collection_name).document(user_id)
             .collection("videos").document(video_id)
             .collection("messages").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit_n))
        docs = list(q.stream())
        out = []
        for d in reversed(docs):
            data = d.to_dict() or {}
            out.append({
                "message_id": data.get("message_id"),
                "timestamp": data.get("timestamp"),
                "role": data.get("role"),
                "content": data.get("content"),
                "attachments": data.get("attachments")
            })
        return out
    
    def get_video_metadata(self, user_id: str, video_id: str) -> Dict[str, Any]:
        """Get video metadata from Firebase."""
        doc = self.client.collection(self.collection_name).document(user_id).collection("videos").document(video_id).get()
        return doc.to_dict() or {}
    
    def persist_history_delta(self, user_id: str, video_id: str) -> int:
        """Persist only messages newer than Firebase's last_persisted_ts."""
        # This would need to be implemented with Redis integration
        # For now, return 0 as this is a complex operation
        return 0
    
    def chat_exists(self, user_id: str, video_id: str) -> bool:
        """Check if chat exists in Firebase."""
        try:
            doc = self.client.collection(self.collection_name).document(user_id).collection("videos").document(video_id).get()
            return doc.exists
        except Exception as e:
            logger.warning("Failed to check if chat exists in Firebase: %s", type(e).__name__)
            return False
    
    def delete_chat(self, user_id: str, video_id: str) -> None:
        """Delete a chat's Firebase data."""
        try:
            # Delete all messages in the chat
            messages_ref = (self.client.collection(self.collection_name)
                          .document(user_id)
                          .collection("videos")
                          .document(video_id)
                          .collection("messages"))
            
            # Get all message documents and delete them
            docs = messages_ref.stream()
            for doc in docs:
                doc.reference.delete()
            
            # Delete the video document
            self.client.collection(self.collection_name).document(user_id).collection("videos").document(video_id).delete()
            
        except Exception as e:
            logger.warning("Failed to delete Firebase data: %s", type(e).__name__)
    
    def list_all_chats(self) -> List[str]:
        """List all unique chat IDs in Firebase."""
        try:
            chat_ids = []
            users_ref = self.client.collection(self.collection_name)
            
            # Iterate through all users
            for user_doc in users_ref.stream():
                user_id = user_doc.id
                videos_ref = user_doc.reference.collection("videos")
                
                # Iterate through all videos for this user
                for video_doc in videos_ref.stream():
                    video_id = video_doc.id
                    chat_id = f"{user_id}::CHAT::{video_id}"
                    chat_ids.append(chat_id)
            
            return chat_ids
        except Exception as e:
            logger.warning("Failed to list chats from Firebase: %s", type(e).__name__)
            return []
    
    def get_chat_metadata(self, user_id: str, video_id: str) -> Dict[str, Any]:
        """Get metadata for a specific chat."""
        try:
            video_ref = (self.client.collection(self.collection_name)
                        .document(user_id)
                        .collection("videos")
                        .document(video_id))
            
            video_doc = video_ref.get()
            if video_doc.exists:
                data = video_doc.to_dict()
                return {
                    "last_activity": data.get("last_activity"),
                    "message_count": data.get("message_count", 0),
                    "created_at": data.get("created_at"),
                    "tier": "firebase"
                }
            else:
                return {"tier": "firebase"}
                
        except Exception as e:
            logger.warning("Failed to get chat metadata from Firebase: %s", type(e).__name__)
            return {"tier": "firebase"}
    
    def set_chat_metadata(self, user_id: str, video_id: str, metadata: Dict[str, Any]) -> bool:
        """Set metadata for a specific chat."""
        try:
            video_ref = (self.client.collection(self.collection_name)
                        .document(user_id)
                        .collection("videos")
                        .document(video_id))
            
            video_ref.update(metadata)
            return True
            
        except Exception as e:
            logger.warning("Failed to set chat metadata in Firebase: %s", type(e).__name__)
            return False

# Export the main class
__all__ = ["FirebaseStorage"]
