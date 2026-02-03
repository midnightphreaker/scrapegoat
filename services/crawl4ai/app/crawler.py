"""Crawl4AI wrapper for crawling web pages with v0.8.0 support."""

import fnmatch
import time
from typing import Optional
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig as Crawl4AIBrowserConfig
from crawl4ai.async_configs import VirtualScrollConfig as Crawl4AIVirtualScrollConfig

from .models import (
    BrowserConfig as BrowserConfigModel,
    BrowserType,
    CrawlConfig,
    CrawlData,
    CrawlMetadata,
    MediaItem,
    LinkItem,
    UrlPatternConfig,
    VirtualScrollConfig,
)


class Crawler:
    """Wrapper around Crawl4AI library with v0.8.0 features."""

    def __init__(self):
        self.crawler: Optional[AsyncWebCrawler] = None
        self.start_time = time.time()

    async def initialize(self, config: Optional[CrawlConfig] = None):
        """Initialize the crawler with optional browser configuration."""
        if self.crawler is None:
            # Build browser config if specified
            browser_config = None
            if config and config.browser:
                browser_config = Crawl4AIBrowserConfig(
                    browser_type=config.browser.browser_type.value,
                    headless=config.browser.headless,
                    verbose=config.browser.verbose,
                    enable_stealth=config.browser.enable_stealth,
                    # user_agent and headers are set via CrawlerRunConfig
                )

            # Create crawler with browser config
            self.crawler = AsyncWebCrawler(config=browser_config)
            await self.crawler.__aenter__()

    async def cleanup(self):
        """Clean up crawler resources."""
        if self.crawler:
            await self.crawler.__aexit__(None, None, None)
            self.crawler = None

    def _match_url_pattern(self, url: str, patterns: list[UrlPatternConfig]) -> Optional[CrawlConfig]:
        """
        Match URL against patterns and return the highest priority matching config.

        Args:
            url: URL to match
            patterns: List of URL patterns with configurations

        Returns:
            Matching config or None
        """
        matching_configs = []

        for pattern_config in patterns:
            # Convert wildcard pattern to regex-like matching
            # e.g., 'https://example.com/docs/*' -> 'https://example.com/docs/*'
            pattern = pattern_config.pattern
            # Simple glob matching (can be enhanced for more complex patterns)
            if fnmatch.fnmatch(url, pattern) or url.startswith(pattern.rstrip('*')):
                matching_configs.append((pattern_config.priority, pattern_config.config))

        if matching_configs:
            # Sort by priority (highest first) and return the top match
            matching_configs.sort(key=lambda x: x[0], reverse=True)
            return matching_configs[0][1]

        return None

    async def crawl(self, url: str, config: CrawlConfig) -> CrawlData:
        """
        Crawl a URL and return markdown content.

        Args:
            url: URL to crawl
            config: Crawl configuration

        Returns:
            CrawlData with markdown and metadata
        """
        await self.initialize(config)

        start = time.time()

        # Build CrawlerRunConfig
        run_config_params = {}

        # Add cache bypass - map "fresh" to "bypass"
        cache_mode = config.cache_mode.value
        if cache_mode == "fresh":
            cache_mode = "bypass"
        run_config_params["cache_mode"] = cache_mode

        # Add wait configuration if specified
        if config.wait_for:
            run_config_params["wait_for"] = config.wait_for
            run_config_params["wait_for_timeout"] = config.wait_for_timeout  # Crawl4AI expects ms

        # Add stealth mode if specified (deprecated, but handle for backward compat)
        if config.stealth_mode and config.stealth_mode != "disabled":
            # Map stealth_mode to appropriate settings
            if config.stealth_mode == "advanced":
                run_config_params["simulate_user"] = True
                run_config_params["override_navigator"] = True

        # Execute custom JS if provided
        if config.custom_js:
            run_config_params["js_code"] = config.custom_js

        # Add screenshot configuration if enabled
        if config.screenshot:
            run_config_params["screenshot"] = True

        # Add media extraction if requested
        if config.extract_media:
            run_config_params["extract_media"] = True

        # v0.8.0: Add browser-specific options
        if config.browser:
            if config.browser.user_agent:
                run_config_params["user_agent"] = config.browser.user_agent
            if config.browser.headers:
                run_config_params["headers"] = config.browser.headers

        # v0.8.0: Add virtual scroll configuration
        if config.virtual_scroll:
            virtual_scroll_config = Crawl4AIVirtualScrollConfig(
                container_selector=config.virtual_scroll.container_selector,
                scroll_count=config.virtual_scroll.scroll_count,
                scroll_by=config.virtual_scroll.scroll_by,
                wait_after_scroll=config.virtual_scroll.wait_after_scroll,
            )
            run_config_params["virtual_scroll_config"] = virtual_scroll_config

        # Note: Hooks are not supported via API as they require Python async functions
        # Server-side hooks can be added directly to this crawler implementation

        # Create CrawlerRunConfig
        run_config = CrawlerRunConfig(**run_config_params)

        # Run the crawl
        result = await self.crawler.arun(url, config=run_config)

        crawl_time = time.time() - start

        # Extract markdown
        raw_markdown = result.markdown
        fit_markdown = result.fit_markdown if hasattr(result, 'fit_markdown') else None

        # Use fit markdown if requested and available, otherwise raw
        markdown = fit_markdown if (config.use_fit_markdown and fit_markdown) else raw_markdown

        # Build metadata
        metadata = CrawlMetadata(
            title=getattr(result, 'title', None),
            description=getattr(result, 'description', None),
            status_code=getattr(result, 'status_code', 200),
            url=url,
            crawl_time=crawl_time,
            screenshot_path=getattr(result, 'screenshot_path', None),
            fetcher_type="crawl4ai",
        )

        # Extract screenshot if available (base64-encoded PNG string)
        screenshot = None
        if config.screenshot and hasattr(result, 'screenshot') and result.screenshot:
            screenshot = result.screenshot

        # Extract and transform media items if requested
        media = None
        if config.extract_media and hasattr(result, 'media') and result.media:
            media = self._extract_media(result.media)

        # Extract and transform links
        links = None
        if hasattr(result, 'links') and result.links:
            links = self._extract_links(result.links)

        # v0.8.0: Extract structured content if available
        extracted_content = None
        if hasattr(result, 'extracted_content') and result.extracted_content:
            extracted_content = result.extracted_content

        # v0.8.0: Extract CSS selectors if available
        css = None
        if hasattr(result, 'css') and result.css:
            css = result.css

        # Build response
        data = CrawlData(
            markdown=markdown,
            raw_markdown=raw_markdown,
            fit_markdown=fit_markdown,
            metadata=metadata,
            screenshot=screenshot,
            media=media,
            links=links,
            extracted_content=extracted_content,
            css=css,
        )

        return data

    def _extract_media(self, media_dict: dict) -> list[MediaItem]:
        """
        Extract and transform media items from Crawl4AI result.

        Args:
            media_dict: Dictionary with media types as keys (e.g., "images", "videos", "audio")
                       Each value is a list of dicts with src, alt, score, etc.

        Returns:
            List of MediaItem objects
        """
        media_items = []

        # Process images
        for img in media_dict.get("images", []):
            if isinstance(img, dict) and "src" in img:
                media_items.append(MediaItem(
                    type="image",
                    url=img["src"],
                    alt=img.get("alt"),
                    width=img.get("width"),
                    height=img.get("height")
                ))

        # Process videos
        for video in media_dict.get("videos", []):
            if isinstance(video, dict) and "src" in video:
                media_items.append(MediaItem(
                    type="video",
                    url=video["src"],
                    alt=video.get("alt"),
                    width=video.get("width"),
                    height=video.get("height")
                ))

        # Process audio
        for audio in media_dict.get("audio", []):
            if isinstance(audio, dict) and "src" in audio:
                media_items.append(MediaItem(
                    type="audio",
                    url=audio["src"],
                    alt=audio.get("alt"),
                    width=None,  # Audio doesn't have dimensions
                    height=None
                ))

        return media_items if media_items else None

    def _extract_links(self, links_dict: dict) -> list[LinkItem]:
        """
        Extract and transform links from Crawl4AI result.

        Args:
            links_dict: Dictionary with "internal" and "external" keys
                       Each value is a list of dicts with href, text, title, etc.

        Returns:
            List of LinkItem objects
        """
        link_items = []

        # Process internal links
        for link in links_dict.get("internal", []):
            if isinstance(link, dict) and "href" in link:
                link_items.append(LinkItem(
                    url=link["href"],
                    text=link.get("text", ""),
                    rel=link.get("rel")
                ))

        # Process external links
        for link in links_dict.get("external", []):
            if isinstance(link, dict) and "href" in link:
                link_items.append(LinkItem(
                    url=link["href"],
                    text=link.get("text", ""),
                    rel=link.get("rel")
                ))

        return link_items if link_items else None

    def get_uptime(self) -> float:
        """Get service uptime in seconds."""
        return time.time() - self.start_time


# Global crawler instance
crawler_instance = Crawler()
