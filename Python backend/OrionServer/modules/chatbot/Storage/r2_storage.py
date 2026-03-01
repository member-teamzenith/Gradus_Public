"""
Cloudflare R2 Storage Module for Chat Assets (e.g., Images)

This module provides a minimal S3-compatible interface to Cloudflare R2 for:
- Uploading files (bytes or file-like)
- Generating pre-signed (temporary) download URLs
- Deleting objects
- Computing content hashes for deduplication

Environment variables used (fallbacks via creds.txt supported):
- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME
- R2_PUBLIC_BASE_URL (optional, if using public bucket/CDN)

Notes:
- R2 is S3-compatible; we use boto3 with a custom endpoint.
- Prefer storing only references (paths/URLs) in chat history, not raw bytes.
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
from typing import Any, Dict, Optional, Union, IO

logger = logging.getLogger(__name__)

try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    Config = None
    ClientError = Exception


from core.config import settings

class R2Storage:
    """Cloudflare R2 storage operations for chat assets."""

    def __init__(self):
        if boto3 is None:
            raise RuntimeError("boto3 is required for R2 integration. pip install boto3")

        account_id = settings.R2_ACCOUNT_ID
        access_key = settings.R2_ACCESS_KEY_ID
        secret_key = settings.R2_SECRET_ACCESS_KEY
        bucket = settings.R2_BUCKET_NAME

        if not all([account_id, access_key, secret_key, bucket]):
            raise RuntimeError("Missing R2 configuration env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME")

        self.bucket_name = bucket
        # S3-compatible endpoint for R2
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"

        self.s3 = boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=endpoint_url,
            config=Config(signature_version="s3v4"),
            region_name="auto",  # R2 ignores region
        )

        self.public_base_url = settings.R2_PUBLIC_BASE_URL  # Optional CDN/Custom domain

    def make_public_url(self, key: str) -> Optional[str]:
        """Build a stable public URL for an object key if a public base URL is configured."""
        if not self.public_base_url:
            return None
        return f"{self.public_base_url.rstrip('/')}/{key}"

    def _make_key(self, chat_id: str, message_id: str, filename: str) -> str:
        safe_chat = chat_id.replace("/", "_")
        safe_msg = message_id.replace("/", "_")
        return f"chat-assets/{safe_chat}/{safe_msg}/{filename}"

    def compute_sha256(self, data: bytes) -> str:
        h = hashlib.sha256()
        h.update(data)
        return h.hexdigest()

    def upload_bytes(
        self,
        chat_id: str,
        message_id: str,
        filename: str,
        data: Union[bytes, IO[bytes]],
        content_type: Optional[str] = None,
        cache_control: Optional[str] = None,
        extra_metadata: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Upload bytes/file-like to R2. Returns object metadata with key and optional URL."""
        key = self._make_key(chat_id, message_id, filename)
        put_kwargs: Dict[str, Any] = {"Bucket": self.bucket_name, "Key": key, "Body": data}
        if content_type:
            put_kwargs["ContentType"] = content_type
        if cache_control:
            put_kwargs["CacheControl"] = cache_control
        if extra_metadata:
            put_kwargs["Metadata"] = extra_metadata

        self.s3.put_object(**put_kwargs)

        result = {
            "bucket": self.bucket_name,
            "key": key,
            "content_type": content_type or "application/octet-stream",
        }

        public_url = self.make_public_url(key)
        if public_url:
            # Public URL (if bucket exposed behind CDN)
            result["url"] = public_url

        return result

    def upload_image_with_meta(
        self,
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
        """
        High-level helper to upload an image (and optional thumbnail) and return attachment metadata
        with stable public URLs when R2_PUBLIC_BASE_URL is configured.

        thumbnail structure:
            {
                "filename": str,
                "data": bytes,
                "mime_type": Optional[str]
            }
        """
        # Compute content hash for dedupe/metadata
        try:
            content_hash = self.compute_sha256(data)
        except Exception:
            content_hash = None

        cache_control = "public, max-age=31536000, immutable"

        uploaded = self.upload_bytes(
            chat_id=chat_id,
            message_id=message_id,
            filename=filename,
            data=data,
            content_type=mime_type,
            cache_control=cache_control,
            extra_metadata={"chat-id": chat_id, "message-id": message_id},
        )

        attachment: Dict[str, Any] = {
            "url": uploaded.get("url"),
            "key": uploaded.get("key"),
            "bucket": uploaded.get("bucket"),
            "mime_type": uploaded.get("content_type") or (mime_type or "application/octet-stream"),
            "size_bytes": size_bytes if size_bytes is not None else len(data),
            "hash": content_hash,
            "width": width,
            "height": height,
        }

        # Optional thumbnail
        if thumbnail and isinstance(thumbnail, dict) and thumbnail.get("data"):
            thumb_filename = thumbnail.get("filename") or f"thumb_{filename}"
            thumb_mime = thumbnail.get("mime_type") or "image/jpeg"
            thumb_data = thumbnail.get("data")
            thumb_uploaded = self.upload_bytes(
                chat_id=chat_id,
                message_id=message_id,
                filename=thumb_filename,
                data=thumb_data,
                content_type=thumb_mime,
                cache_control=cache_control,
                extra_metadata={"chat-id": chat_id, "message-id": message_id, "variant": "thumbnail"},
            )
            attachment["thumbnail_url"] = thumb_uploaded.get("url")
            attachment["thumbnail_key"] = thumb_uploaded.get("key")
            attachment["thumbnail_mime_type"] = thumb_uploaded.get("content_type") or thumb_mime

        return attachment

    def generate_presigned_url(self, key: str, expires_in_seconds: int = 900) -> str:
        """Generate a time-limited signed URL for object download."""
        try:
            return self.s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expires_in_seconds,
            )
        except ClientError as e:
            raise RuntimeError(f"Failed to generate signed URL: {e}")

    def delete_object(self, key: str) -> None:
        """Delete an object from R2."""
        try:
            self.s3.delete_object(Bucket=self.bucket_name, Key=key)
        except ClientError as e:
            # Non-fatal; log and continue
            logger.warning("Failed to delete R2 object: %s", type(e).__name__)


__all__ = ["R2Storage"]


