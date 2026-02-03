"""Pydantic models for API request/response validation."""

from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class CacheMode(str, Enum):
    """Cache mode options."""
    enabled = "enabled"
    disabled = "disabled"
    bypass = "bypass"


class ProxyConfig(BaseModel):
    """Proxy configuration."""
    server: str
    username: Optional[str] = None
    password: Optional[str] = None


class CrawlConfig(BaseModel):
    """Configuration for crawling."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    cache_mode: CacheMode = Field(default=CacheMode.enabled)
    wait_for: Optional[str] = Field(default=None, description="CSS selector to wait for")
    wait_for_timeout: int = Field(default=10000, ge=0, le=60000)
    use_fit_markdown: bool = Field(default=True, description="Use BM25-filtered markdown")
    remove_overlays: bool = Field(default=True)
    screenshot: Optional[Literal[False, True, "full", "viewport"]] = Field(default=False)
    extract_media: bool = Field(default=False)
    custom_js: Optional[str] = Field(default=None)
    stealth_mode: Optional[str] = Field(default=None, description="Stealth mode for anti-detection (disabled, basic, advanced)")
    proxy: Optional[ProxyConfig] = None

    @field_validator('wait_for_timeout')
    @classmethod
    def validate_timeout(cls, v):
        if v < 0 or v > 60000:
            raise ValueError('Timeout must be between 0 and 60000ms')
        return v


class CrawlRequest(BaseModel):
    """Request to crawl a URL."""
    url: str
    config: CrawlConfig = Field(default_factory=CrawlConfig)

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
