"""Crawl4AI wrapper for crawling web pages."""

import time
from typing import Optional
from crawl4ai import AsyncWebCrawler

from .models import CrawlConfig, CrawlData, CrawlMetadata


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

        # Build crawler params
        params = {
            "bypass_cache": config.cache_mode == "bypass",
        }

        # Add wait configuration if specified
        if config.wait_for:
            params["wait_for"] = config.wait_for
            params["wait_for_timeout"] = config.wait_for_timeout / 1000  # Convert to seconds

        # Execute custom JS if provided
        if config.custom_js:
            params["js_code"] = config.custom_js

        # Run the crawl
        result = await self.crawler.arun(url, **params)

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

        # Build response
        data = CrawlData(
            markdown=markdown,
            raw_markdown=raw_markdown,
            fit_markdown=fit_markdown,
            metadata=metadata,
            screenshot=None,  # TODO: Phase 3
            media=None,       # TODO: Phase 3
            links=None        # TODO: Phase 3
        )

        return data

    def get_uptime(self) -> float:
        """Get service uptime in seconds."""
        return time.time() - self.start_time


# Global crawler instance
crawler_instance = Crawler()
