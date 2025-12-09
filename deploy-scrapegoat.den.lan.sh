#!/bin/bash
# ============================================================================
# Scrapegoat Deployment Script for scrapegoat.den.lan
# ============================================================================
# Automates deployment of Scrapegoat to scrapegoat.den.lan
#
# Usage:
#   ./deploy-scrapegoat.den.lan.sh
#
# Prerequisites:
#   - SSH access to scrapegoat.den.lan (root/P@ssw0rd)
#   - SSH access to postgres.den.lan (root/P@ssw0rd)
#   - sshpass installed (for automated SSH)
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRAPEGOAT_HOST="scrapegoat.den.lan"
SCRAPEGOAT_USER="root"
SCRAPEGOAT_PASS="P@ssw0rd"

POSTGRES_HOST="postgres.den.lan"
POSTGRES_USER="root"
POSTGRES_PASS="P@ssw0rd"
POSTGRES_ADMIN="postgres"
POSTGRES_ADMIN_PASS="P@ssw0rd"

DB_NAME="scrapegoat"
DB_USER="scrapegoat"
DB_PASS="scrapegoat_P@ssw0rd"

GIT_REPO="http://git.den.lan/pub/scrapegoat"
DEPLOY_DIR="/opt/scrapegoat"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# Check prerequisites
log_info "Checking prerequisites..."
check_command "sshpass"
check_command "ssh"
check_command "psql"
log_success "Prerequisites check passed"

# ============================================================================
# Step 1: Create PostgreSQL Database
# ============================================================================
log_info "Step 1: Creating PostgreSQL database and user on $POSTGRES_HOST"

log_info "Connecting to PostgreSQL..."
export PGPASSWORD="$POSTGRES_ADMIN_PASS"

# Check if database exists
DB_EXISTS=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_ADMIN" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    log_warning "Database '$DB_NAME' already exists. Skipping creation."
else
    log_info "Creating database '$DB_NAME'..."

    # Create user
    psql -h "$POSTGRES_HOST" -U "$POSTGRES_ADMIN" <<EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

    # Enable pgvector extension
    psql -h "$POSTGRES_HOST" -U "$POSTGRES_ADMIN" -d "$DB_NAME" <<EOF
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

    log_success "Database created successfully"
fi

# Verify database setup
log_info "Verifying database setup..."
psql -h "$POSTGRES_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null
psql -h "$POSTGRES_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT * FROM pg_extension WHERE extname='vector';" | grep vector > /dev/null
export PGPASSWORD="$DB_PASS"
log_success "Database verification passed"

# ============================================================================
# Step 2: Deploy to scrapegoat.den.lan
# ============================================================================
log_info "Step 2: Deploying to $SCRAPEGOAT_HOST"

# Create deployment script to run on remote server
cat > /tmp/deploy-scrapegoat-remote.sh << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

echo "[INFO] Navigating to /opt"
cd /opt

# Clone or pull repository
if [ -d "scrapegoat" ]; then
    echo "[INFO] Repository exists, pulling latest changes..."
    cd scrapegoat
    git pull
else
    echo "[INFO] Cloning repository..."
    git clone http://git.den.lan/pub/scrapegoat
    cd scrapegoat
fi

# Check if migration 014 exists, create if not
if [ ! -f "db/migrations/014-change-vector-dimensions-jina-v3.sql" ]; then
    echo "[INFO] Creating migration 014..."
    cat > db/migrations/014-change-vector-dimensions-jina-v3.sql << 'MIGRATION'
-- Migration 014: Change Vector Dimensions for Jina-Embedding-v3
-- Date: 2025-12-09
-- Purpose: Update vector dimensions from 1536 (OpenAI ada-002) to 1024 (Jina-Embedding-v3)

ALTER TABLE documents ALTER COLUMN embedding TYPE VECTOR(1024);

COMMENT ON COLUMN documents.embedding IS
  'Document embedding vector (1024 dimensions for Jina-Embedding-v3)';
MIGRATION
fi

# Create .env file
echo "[INFO] Creating .env file..."
cat > .env << 'ENV'
# Scrapegoat Configuration - scrapegoat.den.lan
DATABASE_URL=postgresql://scrapegoat:scrapegoat_P@ssw0rd@postgres.den.lan:5432/scrapegoat
OPENAI_API_BASE=http://embed.den.lan/v1
OPENAI_API_KEY=not-required
DOCS_MCP_EMBEDDING_MODEL=Jina-Embedding-v3
CRAWL4AI_ENABLED=true
CRAWL4AI_SERVICE_URL=http://localhost:8001
MCP_PORT=6280
WEB_PORT=80
WORKER_PORT=8080
POSTHOG_API_KEY=
DOCS_MCP_STORE_PATH=/data
NODE_ENV=production
ENV

# Stop existing services if running
echo "[INFO] Stopping existing services (if any)..."
docker compose -f docker-compose.byo-postgres.yml down 2>/dev/null || true

# Build and start services
echo "[INFO] Building Docker images..."
docker compose -f docker-compose.byo-postgres.yml build

echo "[INFO] Starting services..."
docker compose -f docker-compose.byo-postgres.yml up -d

# Wait for services to start
echo "[INFO] Waiting for services to initialize (30 seconds)..."
sleep 30

# Check service status
echo "[INFO] Checking service status..."
docker compose -f docker-compose.byo-postgres.yml ps

echo "[SUCCESS] Deployment complete!"
REMOTE_SCRIPT

# Copy and execute deployment script on remote server
log_info "Copying deployment script to $SCRAPEGOAT_HOST..."
sshpass -p "$SCRAPEGOAT_PASS" scp /tmp/deploy-scrapegoat-remote.sh "$SCRAPEGOAT_USER@$SCRAPEGOAT_HOST:/tmp/"

log_info "Executing deployment on $SCRAPEGOAT_HOST..."
sshpass -p "$SCRAPEGOAT_PASS" ssh "$SCRAPEGOAT_USER@$SCRAPEGOAT_HOST" "bash /tmp/deploy-scrapegoat-remote.sh"

# ============================================================================
# Step 3: Install Systemd Service
# ============================================================================
log_info "Step 3: Installing systemd service"

sshpass -p "$SCRAPEGOAT_PASS" ssh "$SCRAPEGOAT_USER@$SCRAPEGOAT_HOST" <<'SYSTEMD'
cat > /etc/systemd/system/scrapegoat.service << 'EOF'
[Unit]
Description=Scrapegoat Documentation Scraping Service
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/scrapegoat
ExecStart=/usr/bin/docker compose -f docker-compose.byo-postgres.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.byo-postgres.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.byo-postgres.yml restart
Restart=on-failure
RestartSec=10s
TimeoutStartSec=300
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable scrapegoat.service
systemctl status scrapegoat.service --no-pager
SYSTEMD

log_success "Systemd service installed and enabled"

# ============================================================================
# Step 4: Verification
# ============================================================================
log_info "Step 4: Verifying deployment"

log_info "Checking Web UI..."
if curl -s -o /dev/null -w "%{http_code}" http://scrapegoat.den.lan/ | grep -q "200"; then
    log_success "Web UI is accessible at http://scrapegoat.den.lan/"
else
    log_warning "Web UI might not be ready yet. Try accessing http://scrapegoat.den.lan/ in a few moments."
fi

log_info "Checking MCP Server..."
if curl -s -o /dev/null -w "%{http_code}" http://scrapegoat.den.lan:6280/health | grep -q "200"; then
    log_success "MCP Server is accessible at http://scrapegoat.den.lan:6280"
else
    log_warning "MCP Server might not be ready yet."
fi

log_info "Checking Worker API..."
if curl -s -o /dev/null -w "%{http_code}" http://scrapegoat.den.lan:8080/api/health | grep -q "200"; then
    log_success "Worker API is accessible at http://scrapegoat.den.lan:8080"
else
    log_warning "Worker API might not be ready yet."
fi

# ============================================================================
# Deployment Summary
# ============================================================================
echo ""
log_success "============================================"
log_success "Scrapegoat Deployment Complete!"
log_success "============================================"
echo ""
echo "Access URLs:"
echo "  Web UI:     http://scrapegoat.den.lan/"
echo "  MCP Server: http://scrapegoat.den.lan:6280"
echo "  Worker API: http://scrapegoat.den.lan:8080"
echo ""
echo "Database:"
echo "  Host: postgres.den.lan:5432"
echo "  Database: scrapegoat"
echo "  User: scrapegoat"
echo ""
echo "Embeddings:"
echo "  Service: embed.den.lan"
echo "  Model: Jina-Embedding-v3 (1024 dims)"
echo ""
echo "Service Management:"
echo "  Start:   systemctl start scrapegoat"
echo "  Stop:    systemctl stop scrapegoat"
echo "  Restart: systemctl restart scrapegoat"
echo "  Status:  systemctl status scrapegoat"
echo "  Logs:    docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs -f"
echo ""
log_success "Deployment script completed successfully!"
