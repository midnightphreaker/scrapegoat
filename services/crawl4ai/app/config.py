"""Configuration for Crawl4AI service."""

import os
from typing import Optional


class Settings:
    """Application settings loaded from environment variables."""

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8001"))

    # Crawl4AI settings
    VERBOSE: bool = os.getenv("VERBOSE", "false").lower() == "true"
    HEADLESS: bool = os.getenv("HEADLESS", "true").lower() == "true"

    # Performance settings
    MAX_CONCURRENT_CRAWLS: int = int(os.getenv("MAX_CONCURRENT_CRAWLS", "5"))
    REQUEST_TIMEOUT: int = int(os.getenv("REQUEST_TIMEOUT", "30"))

    # Browser settings
    BROWSER_TYPE: str = os.getenv("BROWSER_TYPE", "chromium")  # chromium, firefox, webkit
    USER_AGENT: Optional[str] = os.getenv("USER_AGENT")


settings = Settings()
