# Scrapegoat Production Access Guide

**Deployment**: docs.den.lan (10.1.1.27)
**Date**: 2025-11-10
**Configuration**: BYO (Bring Your Own)
**Status**: PRODUCTION READY

---

## Service Endpoints

### Web Interface
- **URL**: http://docs.den.lan
- **Port**: 80
- **Purpose**: Primary user interface for document management
- **Authentication**: None (internal network only)
- **Health Check**: `curl http://docs.den.lan/health`

### Worker API
- **URL**: http://docs.den.lan:8080/api
- **Port**: 8080
- **Purpose**: Backend API for document processing
- **Protocol**: tRPC over HTTP
- **Health Check**: `curl http://docs.den.lan:8080/health`

### MCP Server
- **URL**: http://docs.den.lan:6280/mcp
- **Port**: 6280
- **Purpose**: Model Context Protocol for AI tool integration
- **Health Check**: `curl http://docs.den.lan:6280/health`

### Crawl4AI Service
- **URL**: http://docs.den.lan:8001
- **Port**: 8001
- **Purpose**: AI-optimized web crawling (optional profile)
- **Health Check**: `curl http://docs.den.lan:8001/health`

---

## Server Access

### SSH Access
```bash
ssh root@docs.den.lan
# Password: P@ssw0rd
```

### Deployment Directory
```bash
cd /opt/scrapegoat-docker
```

### Service Management
```bash
# View service status
docker compose ps

# View logs
docker compose logs -f

# Start/Stop services
docker compose up -d
docker compose down
```

---

## Database Access

### PostgreSQL Connection Details
- **Host**: postgres.den.lan
- **Port**: 5432
- **Database**: scrapegoat
- **Username**: scrapegoat_user
- **Password**: NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag

### Connection String
```
postgresql://scrapegoat_user:NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag@postgres.den.lan:5432/scrapegoat
```

### Direct Connection
```bash
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat
```

### Database Statistics
```bash
# Check database size
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT pg_size_pretty(pg_database_size('scrapegoat')) AS size;"

# Check table counts
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

---

## External Services

### Embedding Service
- **URL**: http://embed.den.lan
- **API Endpoint**: http://embed.den.lan/embeddings
- **Model**: nomic-ai/nomic-embed-text-v1.5
- **Vector Dimensions**: 768
- **API Key**: not-required (internal service)

### Integration Example
```bash
curl -X POST http://embed.den.lan/embeddings \
  -H "Content-Type: application/json" \
  -d '{"texts": ["example text"]}'
```

---

## Backup and Recovery

### Backup Directory
```bash
/opt/scrapegoat-backups/
```

### Backup Files
- **Database**: `scrapegoat_YYYYMMDD_HHMMSS.sql.gz`
- **Configuration**: `scrapegoat_config_YYYYMMDD_HHMMSS.tar.gz`
- **Retention**: 7 days (automatic cleanup)
- **Schedule**: Daily at 2:00 AM AEDT

### Manual Backup
```bash
ssh root@docs.den.lan
/opt/scrapegoat-docker/backup.sh
```

### Restore Database from Backup
```bash
# Stop services first
cd /opt/scrapegoat-docker
docker compose down

# Restore database
BACKUP_FILE="/opt/scrapegoat-backups/scrapegoat_YYYYMMDD_HHMMSS.sql.gz"
gunzip -c "${BACKUP_FILE}" | \
  PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat

# Verify restore
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT COUNT(*) as document_count FROM documents;"

# Start services
docker compose up -d
```

### Restore Configuration
```bash
BACKUP_FILE="/opt/scrapegoat-backups/scrapegoat_config_YYYYMMDD_HHMMSS.tar.gz"
cd /opt/scrapegoat-docker
tar -xzf "${BACKUP_FILE}"
docker compose up -d
```

---

## Configuration Files

### Environment Configuration
```bash
/opt/scrapegoat-docker/.env
```

**Key Variables**:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_BASE`: Embedding API endpoint
- `CRAWL4AI_ENABLED`: Enable/disable Crawl4AI service
- `CRAWL4AI_SERVICE_URL`: Crawl4AI service URL

### Docker Compose
```bash
/opt/scrapegoat-docker/docker-compose.yml
```

**Configured Services**:
- `worker`: Documentation processing API
- `mcp`: Model Context Protocol server
- `web`: Web management interface
- `crawl4ai`: AI-optimized web crawler (optional)

---

## Auto-Restart Configuration

### Restart Policies
All services configured with `restart: unless-stopped`
- Automatically restart on failure
- Survive container daemon restarts
- Can be stopped manually

### Systemd Service
```bash
# Service file location
/etc/systemd/system/scrapegoat.service

# Enable/disable auto-start on server reboot
systemctl enable scrapegoat.service
systemctl disable scrapegoat.service

# Check status
systemctl status scrapegoat.service
```

---

## Monitoring and Health Checks

### Service Health Status
```bash
ssh root@docs.den.lan
cd /opt/scrapegoat-docker

# Check all containers
docker compose ps

# Check specific service health
docker inspect scrapegoat-worker --format='{{.State.Health.Status}}'
docker inspect scrapegoat-crawl4ai --format='{{.State.Health.Status}}'
```

### Resource Usage
```bash
# Real-time stats
docker stats --no-stream

# Check disk usage
df -h
docker volume inspect scrapegoat-data
```

### Log Monitoring
```bash
# Recent logs (all services)
docker compose logs --tail=100

# Follow logs in real-time
docker compose logs -f

# Filter for errors
docker compose logs --since 1h | grep -i "error\|warn\|fail"
```

---

## Security and Credentials

### Important Security Notes
- All passwords and API keys in this document are production secrets
- Keep this document secure and restrict access to authorized personnel only
- Do not commit this document to Git or public repositories
- Rotate credentials periodically (recommended: quarterly)
- Use secure channels for sharing credentials

### Credential Management
- Database password stored in `/opt/scrapegoat-docker/.env`
- API keys managed via environment variables
- All sensitive data encrypted in transit

### Access Control
- SSH access restricted to authorized administrators
- Database access restricted to scrapegoat_user account
- Network access limited to internal network (10.1.1.0/24)

---

## Troubleshooting Reference

### Quick Diagnostics
```bash
# Full service status
ssh root@docs.den.lan
cd /opt/scrapegoat-docker
docker compose ps
docker compose logs --since 10m

# Test database connectivity
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT 1;"

# Test API endpoints
curl -s http://docs.den.lan:8080/health | jq .
curl -s http://docs.den.lan:6280/health | jq .
curl -s http://docs.den.lan:80/ | head -20
```

### Common Issues
- **Service won't start**: Check Docker Compose logs
- **Database connection error**: Verify network connectivity to postgres.den.lan
- **High resource usage**: Check `docker stats` and review logs
- **Backup failures**: Verify PostgreSQL credentials and network connectivity

---

## Incident Response Contacts

**System Administrator**: [Contact Information]
**Database Administrator**: [Contact Information]
**Emergency Escalation**: [Escalation Procedure]
**On-Call Schedule**: [Schedule Details]

---

## Documentation

- **ACCESS.md** (this file): Access information and credentials
- **OPERATIONS.md**: Operational procedures and runbooks
- **PHASE5_REMEDIATION_COMPLETION_SUMMARY.md**: Final validation report
- **EXECUTIVE_SUMMARY.md**: High-level deployment overview

---

*Last Updated: 2025-11-10*
*Created by: Deployment Automation (Claude Code)*
*Status: PRODUCTION READY*
