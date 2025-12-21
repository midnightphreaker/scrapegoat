#!/bin/bash
# Deployment script for qwen3-embedding dimension fix
# Run this on docs.den.lan as: bash deploy-dimension-fix.sh

set -e

echo "======================================"
echo "Deploying qwen3-embedding dimension fix"
echo "======================================"

# Navigate to scrapegoat directory
cd /opt/scrapegoat

echo ""
echo "1. Pulling latest code changes..."
git pull

echo ""
echo "2. Updating .env to use qwen3-embedding..."
# Update DOCS_MCP_EMBEDDING_MODEL to qwen3-embedding
sed -i 's/^DOCS_MCP_EMBEDDING_MODEL=.*/DOCS_MCP_EMBEDDING_MODEL=qwen3-embedding/' .env

# Verify the change
echo "   Current embedding model configuration:"
grep "DOCS_MCP_EMBEDDING_MODEL" .env

echo ""
echo "3. Stopping services..."
docker compose -f docker-compose.byo-postgres.yml down

echo ""
echo "4. Rebuilding Docker images with updated code..."
docker compose -f docker-compose.byo-postgres.yml build --no-cache worker mcp web

echo ""
echo "5. Starting services..."
docker compose -f docker-compose.byo-postgres.yml up -d

echo ""
echo "6. Waiting for services to start..."
sleep 10

echo ""
echo "7. Checking service status..."
docker compose -f docker-compose.byo-postgres.yml ps

echo ""
echo "8. Checking worker logs for dimension configuration..."
docker compose -f docker-compose.byo-postgres.yml logs --tail=50 worker | grep -i "dimension\|embedding\|error" || echo "No dimension errors found!"

echo ""
echo "======================================"
echo "Deployment complete!"
echo "======================================"
echo ""
echo "To monitor worker logs in real-time:"
echo "  docker compose -f docker-compose.byo-postgres.yml logs -f worker"
