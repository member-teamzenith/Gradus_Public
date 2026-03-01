#!/usr/bin/env python3
"""
Chatbot Utilities Package

This package contains utility modules for the chatbot system:
- answering_client: final answering client for generating responses
- vision_client: Vision client for image context
- ir_selector: IR Selector agent for chunk selection
- embedding_client: Shared embedding client for vector operations
"""

from .answering_client import AnsweringClient, get_shared_llm_http_client, close_shared_llm_http_client
from .vision_client import VisionClient, get_shared_vision_http_client, close_shared_vision_http_client
from .ir_selector import IRSelectorAgent, get_shared_ir_selector_client, close_shared_ir_selector_client, get_shared_ir_selector
from .embedding_client import DeepInfraEmbeddingClient, get_shared_embedding_client, close_shared_embedding_client
from .memory_summarizer import MemorySummarizer, get_shared_memory_summarizer_client, close_shared_memory_summarizer_client

__all__ = [
    # Answering Client
    "AnsweringClient",
    "get_shared_llm_http_client",
    "close_shared_llm_http_client",
    
    # Vision Client
    "VisionClient",
    "get_shared_vision_http_client",
    "close_shared_vision_http_client",
    
    # IR Selector
    "IRSelectorAgent",
    "get_shared_ir_selector_client",
    "close_shared_ir_selector_client",
    "get_shared_ir_selector",
    
    # Embedding Client
    "DeepInfraEmbeddingClient",
    "get_shared_embedding_client",
    "close_shared_embedding_client",
    
    # Memory Summarizer
    "MemorySummarizer",
    "get_shared_memory_summarizer_client",
    "close_shared_memory_summarizer_client",
]