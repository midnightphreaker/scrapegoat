"""Pydantic models for API request/response validation."""

from enum import Enum
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class CacheMode(str, Enum):
    """Cache mode options - matching Crawl4AI v0.8.0 CacheMode."""
    enabled = "enabled"
    disabled = "disabled"
    bypass = "bypass"
    write_only = "write_only"
    read_only = "read_only"
    # For backward compatibility with TypeScript, "fresh" maps to "bypass"
    fresh = "bypass"


class BrowserType(str, Enum):
    """Browser type options - matching Crawl4AI v0.8.0 BrowserConfig.

    Options are chromium, firefox, webkit - NOT "playwright" or "undetected".
    For anti-bot detection, use enable_stealth=True in BrowserConfig instead.
    """
    chromium = "chromium"
    firefox = "firefox"
    webkit = "webkit"


class ProxyConfig(BaseModel):
    """Proxy configuration - matching Crawl4AI v0.8.0 ProxyConfig."""
    server: str
    username: Optional[str] = None
    password: Optional[str] = None


class BrowserConfig(BaseModel):
    """Browser configuration for Crawl4AI v0.8.0.

    Maps to Crawl4AI's BrowserConfig class. Note that browser_type uses
    "chromium", "firefox", or "webkit" - not "playwright" or "undetected".
    For anti-bot detection, the service will use enable_stealth=True.
    """
    browser_type: BrowserType = Field(default=BrowserType.chromium)
    headless: bool = Field(default=True)
    verbose: bool = Field(default=False)
    user_agent: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    # For anti-bot detection (replaces "undetected" browser type)
    enable_stealth: bool = Field(default=False)


class VirtualScrollConfig(BaseModel):
    """Virtual scroll configuration for Crawl4AI v0.8.0.

    Maps to Crawl4AI's VirtualScrollConfig class. This enables capturing
    content from pages with virtualized scrolling (like Twitter, Instagram).

    Note: The official Crawl4AI VirtualScrollConfig uses different field names
    than what was previously implemented.
    """
    container_selector: str = Field(
        description="CSS selector for the scrollable container (e.g., '.scrollable-div', '[role=\"feed\"]')"
    )
    scroll_count: int = Field(default=10, ge=1, description="Maximum number of scrolls to perform")
    scroll_by: str = Field(
        default="container_height",
        description='Amount to scroll: "container_height", "page_height", or integer pixels'
    )
    wait_after_scroll: float = Field(default=0.5, ge=0, description="Seconds to wait after each scroll")


class UrlPatternConfig(BaseModel):
    """URL pattern configuration for multi-URL crawling.

    Allows different crawl configurations based on URL patterns.
    """
    pattern: str = Field(description="URL pattern (supports wildcards, e.g., 'https://example.com/docs/*')")
    priority: int = Field(default=0, ge=0, le=100, description="Higher priority patterns are checked first")
    config: 'CrawlConfig' = Field(description="Crawl configuration for this pattern")


class CrawlConfig(BaseModel):
    """Configuration for crawling - matching Crawl4AI v0.8.0 CrawlerRunConfig."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    cache_mode: CacheMode = Field(default=CacheMode.bypass)
    wait_for: Optional[str] = Field(default=None, description="CSS selector to wait for")
    wait_for_timeout: int = Field(default=30000, ge=0, le=60000, description="Wait timeout in milliseconds")
    use_fit_markdown: bool = Field(default=True, description="Use BM25-filtered markdown")
    remove_overlays: bool = Field(default=True, description="Auto-remove popups/modals")
    screenshot: bool = Field(default=False, description="Capture screenshot")
    extract_media: bool = Field(default=False, description="Extract media metadata")
    custom_js: Optional[str] = Field(default=None, description="Custom JavaScript to execute")
    # stealth_mode is now handled via browser.enable_stealth
    stealth_mode: Optional[str] = Field(
        default=None,
        description="Deprecated: Use browser.enable_stealth instead. Values: disabled, basic, advanced"
    )
    proxy: Optional[ProxyConfig] = None

    # v0.8.0 features
    browser: Optional[BrowserConfig] = None
    virtual_scroll: Optional[VirtualScrollConfig] = None

    # Note: Hooks are not exposed via API as they require Python async functions
    # Server-side hooks can be configured in the crawler implementation

    @field_validator('wait_for_timeout')
    @classmethod
    def validate_timeout(cls, v):
        if v < 0 or v > 60000:
            raise ValueError('Timeout must be between 0 and 60000ms')
        return v


class MultiUrlCrawlConfig(BaseModel):
    """Configuration for multi-URL crawling with pattern matching."""
    default_config: CrawlConfig = Field(default_factory=CrawlConfig)
    url_patterns: list[UrlPatternConfig] = Field(default_factory=list, description="URL-specific configurations")


class CrawlRequest(BaseModel):
    """Request to crawl a URL."""
    url: str
    config: CrawlConfig = Field(default_factory=CrawlConfig)
    multi_url_config: Optional[MultiUrlCrawlConfig] = None

    @field_validator('url')
    @classmethod
    def validate_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        return v


class MediaItem(BaseModel):
    """Media item extracted from page."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    type: Literal["image", "video", "audio"]
    url: str
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class LinkItem(BaseModel):
    """Link extracted from page."""
    url: str
    text: str
    rel: Optional[str] = None


class CrawlMetadata(BaseModel):
    """Metadata about the crawl."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: Optional[str] = None
    description: Optional[str] = None
    status_code: int
    url: str
    crawl_time: float
    # v0.8.0 additional metadata
    screenshot_path: Optional[str] = None
    fetcher_type: Optional[str] = None


class CrawlData(BaseModel):
    """Successful crawl result data."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    markdown: str
    raw_markdown: Optional[str] = None
    fit_markdown: Optional[str] = None
    metadata: CrawlMetadata
    screenshot: Optional[str] = None
    media: Optional[list[MediaItem]] = None
    links: Optional[list[LinkItem]] = None
    # v0.8.0 additional fields
    extracted_content: Optional[dict[str, Any]] = Field(default=None, description="Structured content extraction")
    css: Optional[dict[str, str]] = Field(default=None, description="Extracted CSS selectors")


class ErrorDetail(BaseModel):
    """Error details."""
    code: str
    message: str
    details: Optional[dict] = None


class CrawlResponse(BaseModel):
    """Response from crawl endpoint."""
    success: bool
    data: Optional[CrawlData] = None
    error: Optional[ErrorDetail] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: Literal["ok", "degraded", "down"]
    version: str
    uptime: float
    crawl4ai_version: str = "0.8.0"
