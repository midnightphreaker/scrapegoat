"""FastAPI application for Crawl4AI service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from .models import CrawlRequest, CrawlResponse, ErrorDetail, HealthResponse
from .crawler import crawler_instance
from .config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Crawl4AI Service",
    description="AI-optimized web crawling service for Scrapegoat",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Internal service, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Initialize crawler on startup."""
    logger.info("Starting Crawl4AI service...")
    await crawler_instance.initialize()
    logger.info("Crawl4AI service ready")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    logger.info("Shutting down Crawl4AI service...")
    await crawler_instance.cleanup()
    logger.info("Crawl4AI service stopped")


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        uptime=crawler_instance.get_uptime()
    )


@app.post("/crawl", response_model=CrawlResponse)
async def crawl(request: CrawlRequest):
    """
    Crawl a URL and return markdown content.

    Args:
        request: Crawl request with URL and configuration

    Returns:
        Crawl response with markdown and metadata
    """
    try:
        logger.info(f"Crawling URL: {request.url}")

        # Perform crawl
        data = await crawler_instance.crawl(request.url, request.config)

        logger.info(f"Successfully crawled {request.url} in {data.metadata.crawl_time:.2f}s")

        return CrawlResponse(
            success=True,
            data=data,
            error=None
        )

    except Exception as e:
        logger.error(f"Error crawling {request.url}: {str(e)}")

        # Determine error code
        error_code = "CRAWL_ERROR"
        if "timeout" in str(e).lower():
            error_code = "TIMEOUT"
        elif "network" in str(e).lower():
            error_code = "NETWORK_ERROR"

        return CrawlResponse(
            success=False,
            data=None,
            error=ErrorDetail(
                code=error_code,
                message=str(e),
                details={"url": request.url}
            )
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False
    )
