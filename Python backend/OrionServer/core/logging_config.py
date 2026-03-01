"""
Logging Configuration for OrionServer
=====================================
JSON structured logging with tiered retention:
- DEBUG: 12 hours (verbose debugging)
- INFO: 36 hours (normal operations)
- WARNING/ERROR: 7 days (issues requiring investigation)

Usage:
    from core.logging_config import setup_logging
    setup_logging()  # Call once at app startup
"""

import os
import json
import logging
import sys
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from typing import Optional


# ============================================================================
# Configuration
# ============================================================================

LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_LEVELS = {
    "debug": {
        "level": logging.DEBUG,
        "filename": "debug.log",
        "backup_count": 1,  # ~12 hours (rotate every 12h, keep 1 backup)
        "when": "H",
        "interval": 12
    },
    "info": {
        "level": logging.INFO,
        "filename": "app.log",
        "backup_count": 3,  # ~36 hours (rotate every 12h, keep 3 backups)
        "when": "H",
        "interval": 12
    },
    "error": {
        "level": logging.WARNING,
        "filename": "error.log",
        "backup_count": 14,  # ~7 days (rotate every 12h, keep 14 backups)
        "when": "H",
        "interval": 12
    }
}


# ============================================================================
# JSON Formatter
# ============================================================================

class JSONFormatter(logging.Formatter):
    """
    Outputs log records as JSON for structured logging.
    Easy to parse, search, and ingest into log aggregation systems.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        try:
            # Human-readable timestamp: YYYY-MM-DD HH:MM:SS
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        except (ImportError, AttributeError, TypeError):
            # Fallback during shutdown when datetime/sys might be unloaded
            timestamp = "SHUTDOWN"
        
        log_data = {
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if any
        if hasattr(record, "extra_data"):
            log_data["extra"] = record.extra_data
            
        return json.dumps(log_data, ensure_ascii=False)


# ============================================================================
# Level Filters
# ============================================================================

class LevelRangeFilter(logging.Filter):
    """Filter that only allows logs within a specific level range."""
    
    def __init__(self, min_level: int, max_level: int = logging.CRITICAL):
        super().__init__()
        self.min_level = min_level
        self.max_level = max_level
    
    def filter(self, record: logging.LogRecord) -> bool:
        return self.min_level <= record.levelno <= self.max_level


class ExactLevelFilter(logging.Filter):
    """Filter that only allows logs of an exact level."""
    
    def __init__(self, level: int):
        super().__init__()
        self.level = level
    
    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno == self.level


# ============================================================================
# Setup Functions
# ============================================================================

def setup_logging(
    log_dir: Optional[Path] = None,
    console_level: int = logging.INFO,
    enable_file_logging: bool = True
) -> None:
    """
    Configure logging for the application.
    
    Args:
        log_dir: Directory to store log files (default: OrionServer/logs)
        console_level: Minimum level for console output (default: INFO)
        enable_file_logging: Whether to enable file-based logging (default: True)
    """
    log_path = log_dir or LOG_DIR
    
    # Ensure log directory exists
    if enable_file_logging:
        log_path.mkdir(parents=True, exist_ok=True)
    
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)  # Capture all, filter at handler level
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # JSON formatter for all handlers
    json_formatter = JSONFormatter()
    
    # Console handler (always enabled)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(console_level)
    console_handler.setFormatter(json_formatter)
    root_logger.addHandler(console_handler)
    
    if enable_file_logging:
        # Debug file handler (12 hours)
        debug_config = LOG_LEVELS["debug"]
        debug_handler = TimedRotatingFileHandler(
            log_path / debug_config["filename"],
            when=debug_config["when"],
            interval=debug_config["interval"],
            backupCount=debug_config["backup_count"],
            encoding="utf-8"
        )
        debug_handler.setLevel(logging.DEBUG)
        debug_handler.addFilter(ExactLevelFilter(logging.DEBUG))
        debug_handler.setFormatter(json_formatter)
        root_logger.addHandler(debug_handler)
        
        # Info file handler (36 hours)
        info_config = LOG_LEVELS["info"]
        info_handler = TimedRotatingFileHandler(
            log_path / info_config["filename"],
            when=info_config["when"],
            interval=info_config["interval"],
            backupCount=info_config["backup_count"],
            encoding="utf-8"
        )
        info_handler.setLevel(logging.INFO)
        info_handler.addFilter(ExactLevelFilter(logging.INFO))
        info_handler.setFormatter(json_formatter)
        root_logger.addHandler(info_handler)
        
        # Error file handler (7 days) - captures WARNING, ERROR, CRITICAL
        error_config = LOG_LEVELS["error"]
        error_handler = TimedRotatingFileHandler(
            log_path / error_config["filename"],
            when=error_config["when"],
            interval=error_config["interval"],
            backupCount=error_config["backup_count"],
            encoding="utf-8"
        )
        error_handler.setLevel(logging.WARNING)
        error_handler.setFormatter(json_formatter)
        root_logger.addHandler(error_handler)
    
    # Log startup message
    logging.info("Logging initialized", extra={"extra_data": {
        "log_dir": str(log_path) if enable_file_logging else "console_only",
        "console_level": logging.getLevelName(console_level),
        "file_logging": enable_file_logging
    }})


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a module.
    
    Args:
        name: Usually __name__ of the calling module
        
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


# ============================================================================
# Convenience Functions
# ============================================================================

def setup_production_logging() -> None:
    """Production preset: INFO+ to console, all levels to files."""
    setup_logging(console_level=logging.INFO, enable_file_logging=True)


def setup_development_logging() -> None:
    """Development preset: DEBUG to console, no files."""
    setup_logging(console_level=logging.DEBUG, enable_file_logging=False)
