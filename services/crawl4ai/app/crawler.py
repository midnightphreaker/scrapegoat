"""Crawl4AI wrapper for crawling web pages."""

import time
from typing import Optional
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

from .models import CrawlConfig, CrawlData, CrawlMetadata, MediaItem, LinkItem


class Crawler:
    """Wrapper around Crawl4AI library."""

    def __init__(self):
        self.crawler: Optional[AsyncWebCrawler] = None
        self.start_time = time.time()

    async def initialize(self):
        """Initialize the crawler."""
        if self.crawler is None:
            self.crawler = AsyncWebCrawler()
            await self.crawler.__aenter__()

    async def cleanup(self):
        """Clean up crawler resources."""
        if self.crawler:
            await self.crawler.__aexit__(None, None, None)
            self.crawler = None

    async def crawl(self, url: str, config: CrawlConfig) -> CrawlData:
        """
        Crawl a URL and return markdown content.

        Args:
            url: URL to crawl
            config: Crawl configuration

        Returns:
            CrawlData with markdown and metadata
        """
        await self.initialize()

        start = time.time()

        # Build CrawlerRunConfig
        run_config_params = {}

        # Add cache bypass
        if config.cache_mode == "bypass":
            run_config_params["cache_mode"] = "bypass"

        # Add wait configuration if specified
        if config.wait_for:
            run_config_params["wait_for"] = config.wait_for
            run_config_params["wait_for_timeout"] = config.wait_for_timeout / 1000  # Convert to seconds

        # Add stealth mode if specified
        if config.stealth_mode:
            run_config_params["stealth_mode"] = config.stealth_mode

        # Execute custom JS if provided
        if config.custom_js:
            run_config_params["js_code"] = config.custom_js

        # Add screenshot configuration if enabled
        if config.screenshot:
            run_config_params["screenshot"] = True

        # Add media extraction if requested
        if config.extract_media:
            run_config_params["extract_media"] = True

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
            crawl_time=crawl_time
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

        # Build response
        data = CrawlData(
            markdown=markdown,
            raw_markdown=raw_markdown,
            fit_markdown=fit_markdown,
            metadata=metadata,
            screenshot=screenshot,
            media=media,
            links=links
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
