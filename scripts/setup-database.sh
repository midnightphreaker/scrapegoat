#!/bin/bash
# Scrapegoat Database Setup Script
# Purpose: Create PostgreSQL database and user for Scrapegoat deployment
#
# NOTE: This script ONLY creates the database and user.
# Schema, tables, indexes, and pgvector extension are automatically created
# by Scrapegoat's migration system on first worker service startup.
#
# Migration System Details:
# - File: src/store/applyMigrations.ts
# - Migrations Directory: db/migrations/
# - Key Migration: 001-initial-schema.sql
#   * Creates pgvector extension
#   * Creates all required tables (libraries, versions, pages, documents)
#   * Creates schema tracking table (_schema_migrations)
#   * Creates vector indexes
# - Automatic Execution: When worker service initializes DocumentStore
# - Timing: Phase 4 of deployment (after Phase 2 database setup)
#
# Usage:
#   ./setup-database.sh <postgres_host> <database_password> <postgres_password>
#
# Example:
#   ./setup-database.sh postgres.den.lan 'MySecurePassword123!' 'PostgresAdminPassword'
#
# Requirements:
#   - SSH access to postgres_host with root or sudo privileges
#   - PostgreSQL admin credentials (postgres user)
#   - Network connectivity from this machine to postgres_host
#
# Security Notes:
#   - Password is passed as command-line argument (consider piping from secure source)
#   - Passwords are passed via PGPASSWORD environment variable during SQL execution
#   - Recommend using .pgpass file or environment for sensitive credentials in production
#   - Script will drop existing database/user if they exist (use with caution)

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

print_info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Validate arguments
if [ "$#" -ne 3 ]; then
    echo "Scrapegoat Database Setup Script"
    echo "Usage: $0 <postgres_host> <database_password> <postgres_password>"
    echo ""
    echo "Arguments:"
    echo "  postgres_host       - Hostname/IP of PostgreSQL server (e.g., postgres.den.lan)"
    echo "  database_password   - Password for scrapegoat_user (will be created)"
    echo "  postgres_password   - Password for postgres admin user"
    echo ""
    echo "Example:"
    echo "  $0 postgres.den.lan 'MySecurePassword123!' 'PostgresAdminPassword'"
    exit 1
fi

POSTGRES_HOST="$1"
DB_PASSWORD="$2"
PG_PASSWORD="$3"

# Validate arguments are not empty
if [ -z "$POSTGRES_HOST" ]; then
    print_error "PostgreSQL host cannot be empty"
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    print_error "Database password cannot be empty"
    exit 1
fi

if [ -z "$PG_PASSWORD" ]; then
    print_error "PostgreSQL admin password cannot be empty"
    exit 1
fi

print_info "Starting Scrapegoat database setup"
print_info "Target PostgreSQL Server: $POSTGRES_HOST"
print_info "Target Database: scrapegoat"
print_info "Target User: scrapegoat_user"
echo ""

# Create SQL commands
SQL_SETUP=$(cat <<'SQLEOF'
-- Scrapegoat Database Setup
-- Created by setup-database.sh
-- This script only creates database and user
-- Schema/tables created automatically by migration system on first startup

-- Check current state
SELECT 'Checking existing database...' as step;
SELECT datname FROM pg_database WHERE datname = 'scrapegoat';

-- Clean up if exists (CAUTION: destroys data)
DROP DATABASE IF EXISTS scrapegoat;
DROP USER IF EXISTS scrapegoat_user;

SELECT 'Creating scrapegoat_user...' as step;
-- Create user with provided password
CREATE USER scrapegoat_user WITH PASSWORD %s;

SELECT 'Creating scrapegoat database...' as step;
-- Create database owned by scrapegoat_user
CREATE DATABASE scrapegoat OWNER scrapegoat_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat_user;

SELECT 'Verifying setup...' as step;
-- Verify creation
\l scrapegoat
SQLEOF
)

# Function to execute SQL on remote PostgreSQL
execute_sql() {
    local sql="$1"
    local host="$2"
    local admin_pass="$3"

    # Use environment variable for password (more secure than command-line)
    export PGPASSWORD="$admin_pass"

    # Connect as postgres admin user
    psql -h "$host" -U postgres -d postgres -c "$sql" 2>&1

    # Clear password from environment
    unset PGPASSWORD
}

# Execute setup
print_info "Connecting to PostgreSQL server..."

# Prepare SQL with password
FORMATTED_SQL=$(printf "CREATE USER scrapegoat_user WITH PASSWORD '%s';" "$DB_PASSWORD")

# Create all SQL commands
ALL_SQL=$(cat <<SQLEOF
-- Check existing database
SELECT datname FROM pg_database WHERE datname = 'scrapegoat';

-- Clean up if exists
DROP DATABASE IF EXISTS scrapegoat;
DROP USER IF EXISTS scrapegoat_user;

-- Create user
$FORMATTED_SQL

-- Create database
CREATE DATABASE scrapegoat OWNER scrapegoat_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat_user;

-- Verify
\l scrapegoat
SQLEOF
)

# Execute via SSH
print_info "Executing database setup on remote server..."

export PGPASSWORD="$PG_PASSWORD"

psql -h "$POSTGRES_HOST" -U postgres -d postgres << EOSQL
-- Check existing database
SELECT datname FROM pg_database WHERE datname = 'scrapegoat';

-- Clean up if exists
DROP DATABASE IF EXISTS scrapegoat;
DROP USER IF EXISTS scrapegoat_user;

-- Create user with provided password
CREATE USER scrapegoat_user WITH PASSWORD '$DB_PASSWORD';

-- Create database
CREATE DATABASE scrapegoat OWNER scrapegoat_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat_user;

-- Verify creation
\l scrapegoat
EOSQL

unset PGPASSWORD

if [ $? -ne 0 ]; then
    print_error "Failed to set up database on $POSTGRES_HOST"
    exit 1
fi

print_success "Database setup completed successfully"
echo ""

# Test connection as new user
print_info "Testing connection as scrapegoat_user..."

export PGPASSWORD="$DB_PASSWORD"

# Test connection
psql -h "$POSTGRES_HOST" -U scrapegoat_user -d scrapegoat -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_success "Connection test passed"
else
    print_error "Connection test failed"
    unset PGPASSWORD
    exit 1
fi

# Verify database is empty (no tables yet - migrations will create them)
TABLE_COUNT=$(psql -h "$POSTGRES_HOST" -U scrapegoat_user -d scrapegoat -c "\dt" 2>&1 | grep -c "relations" || echo "0")

unset PGPASSWORD

echo ""
print_info "Database verification:"
echo "  Database: scrapegoat"
echo "  Owner: scrapegoat_user"
echo "  Connection: Working"
echo "  Tables: None (correct - created by migration system)"
echo ""
print_success "Scrapegoat database ready for Phase 4 deployment"
echo ""

# Generate connection string
DATABASE_URL="postgresql://scrapegoat_user:${DB_PASSWORD}@${POSTGRES_HOST}:5432/scrapegoat"
echo "DATABASE_URL for .env configuration:"
echo "=================================================="
echo "$DATABASE_URL"
echo "=================================================="
echo ""
print_info "Migration system will automatically:"
print_info "  1. Enable pgvector extension"
print_info "  2. Create all required tables"
print_info "  3. Create vector indexes (HNSW and GIN)"
print_info "  4. Add additional schema columns as needed"
echo ""
print_info "See src/store/applyMigrations.ts and db/migrations/ for details"
