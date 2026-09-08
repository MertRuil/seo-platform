import json
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional

SENSITIVE_PATTERNS = [
    re.compile(r"bearer\s+[a-zA-Z0-9_\-\.]+", re.IGNORECASE),
    re.compile(r"password['\"]?\s*[:=]\s*['\"][^'\"]+['\"]", re.IGNORECASE),
    re.compile(r"client_secret['\"]?\s*[:=]\s*['\"][^'\"]+['\"]", re.IGNORECASE),
    re.compile(r"AIza[0-9A-Za-z-_]{35}"),  # Google API key pattern
]

class RedactingJsonFormatter(logging.Formatter):
    """
    JSON log formatter with automatic redaction of bearer tokens,
    API keys, and credentials, injecting correlation context IDs.
    """
    def format(self, record: logging.LogRecord) -> str:
        message = record.getMessage()
        # Apply redactions
        for pattern in SENSITIVE_PATTERNS:
            message = pattern.sub("[REDACTED_SECRET]", message)

        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": message,
            "request_id": getattr(record, "request_id", None),
            "organization_id": getattr(record, "organization_id", None),
            "site_id": getattr(record, "site_id", None),
            "crawl_id": getattr(record, "crawl_id", None),
        }

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)

def setup_logger(name: str = "seo_platform", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(RedactingJsonFormatter())
        logger.addHandler(handler)
    return logger
