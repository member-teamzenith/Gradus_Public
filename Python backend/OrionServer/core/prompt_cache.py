"""
Prompt Cache Utility with Registry Pattern

Provides a centralized registry of all prompt files and an in-memory cache
for loading them. Prompts are loaded once on first access and cached forever.
"""

from functools import lru_cache
import os

# Base directory for all modules (OrionServer/modules)
_MODULES_BASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "modules")

# Registry mapping logical names to relative paths from modules directory
PROMPT_REGISTRY = {
    # Chatbot agents
    "ir_selector": "chatbot/chatbot_utils/ir_selector_system_prompt.md",
    "answering": "chatbot/chatbot_utils/chatbot_system_prompt.md",
    "memory_summarizer": "chatbot/chatbot_utils/memory_summarizer_system_prompt.md",
    "vision": "chatbot/chatbot_utils/vision_instruction_prompt.md",
    
    # Video player agents
    "writer": "video_player/prompts/Summary_instruction prompts.md",
    "recommendation": "video_player/prompts/recommendation_instruction.md",
    "quiz": "video_player/prompts/Quiz_instruction.md",
    "summarization": "video_player/prompts/ir_summarization.md",
}


@lru_cache(maxsize=None)
def _load_file(path: str) -> str:
    """Internal: Load and cache a file by absolute path."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def load_prompt(name: str) -> str:
    """Load a prompt by its registry name.
    
    Args:
        name: Logical name of the prompt (e.g., "ir_selector", "writer")
        
    Returns:
        The contents of the prompt file, stripped of leading/trailing whitespace.
        
    Raises:
        KeyError: If the prompt name is not in the registry.
        FileNotFoundError: If the prompt file doesn't exist.
        
    Example:
        >>> system_prompt = load_prompt("ir_selector")
    """
    relative_path = PROMPT_REGISTRY.get(name)
    if not relative_path:
        raise KeyError(f"Unknown prompt: '{name}'. Available: {list(PROMPT_REGISTRY.keys())}")
    
    full_path = os.path.join(_MODULES_BASE, relative_path)
    return _load_file(full_path)


def load_prompt_by_path(prompt_path: str) -> str:
    """Load and cache a prompt file by absolute path (legacy support).
    
    Args:
        prompt_path: Absolute path to the prompt file.
        
    Returns:
        The contents of the prompt file, stripped of leading/trailing whitespace.
    """
    return _load_file(prompt_path)


def clear_prompt_cache() -> None:
    """Clear the prompt cache. Useful for testing or hot-reloading prompts."""
    _load_file.cache_clear()


def list_prompts() -> list:
    """List all available prompt names in the registry."""
    return list(PROMPT_REGISTRY.keys())


__all__ = ["load_prompt", "load_prompt_by_path", "clear_prompt_cache", "list_prompts", "PROMPT_REGISTRY"]
