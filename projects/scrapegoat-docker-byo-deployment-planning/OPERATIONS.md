# Scrapegoat Operations Guide

**Deployment**: docs.den.lan (10.1.1.27)
**Configuration**: Docker Compose BYO (Bring Your Own)
**Status**: PRODUCTION READY
**Last Updated**: 2025-11-10

---

## Quick Start Commands

```bash
# SSH to server
ssh root@docs.den.lan

# Navigate to deployment directory
cd /opt/scrapegoat-docker

# Check service status
docker compose ps

# View logs
docker compose logs -f
```

---

## Daily Operations

### Morning Service Check
```bash
ssh root@docs.den.lan
cd /opt/scrapegoat-docker

# Check all services running
docker compose ps

# Expected output: All services "Up" with health status
# worker: Up X hours (healthy)
# mcp: Up X hours
# web: Up X hours
# crawl4ai: Up X hours (healthy)
```

### View System Logs
```bash
# All services - last 50 lines
docker compose logs --tail=50

# Specific service
docker compose logs --tail=50 worker
docker compose logs --tail=50 mcp
docker compose logs --tail=50 web
docker compose logs --tail=50 crawl4ai

# Follow logs in real-time
docker compose logs -f

# Exit: Ctrl+C
```

### Check Resource Usage
```bash
# Real-time container statistics
docker stats --no-stream

# Check disk usage
df -h /

# Check Docker volume usage
docker volume inspect scrapegoat-data

# Check container resource limits
docker compose config | grep -A 5 resources
```

---

## Service Management

### Start Services
```bash
cd /opt/scrapegoat-docker

# Start all services (default: without Crawl4AI)
docker compose up -d

# Start with Crawl4AI enabled
docker compose --profile crawl4ai up -d

# Verify startup
docker compose ps
# Wait 15-30 seconds for health checks to complete
```

### Stop Services
```bash
cd /opt/scrapegoat-docker

# Graceful stop (30 second timeout)
docker compose stop

# Immediate stop (for emergency)
docker compose kill

# Complete shutdown
docker compose down
```

### Restart Services
```bash
cd /opt/scrapegoat-docker

# Restart all services
docker compose restart

# Restart specific service
docker compose restart worker
docker compose restart mcp
docker compose restart web

# Restart with fresh start
docker compose down
docker compose up -d
```

### Update Services (New Version)
```bash
cd /opt/scrapegoat-docker

# Pull latest images from registry
docker compose pull

# Stop current services
docker compose down

# Start with new images
docker compose up -d

# Verify new version running
docker compose ps
docker compose logs --tail=20
```

### Container Logs with Filtering
```bash
# Logs from last hour
docker compose logs --since 1h

# Logs since specific timestamp
docker compose logs --since 2025-11-10T07:00:00

# Filter for errors
docker compose logs --since 1h | grep -i error

# Filter for warnings
docker compose logs --since 1h | grep -i warn

# Combine filters
docker compose logs --since 1h | grep -i "error\|warn\|fail"

# View logs of exited container
docker compose logs crawl4ai
```

---

## Database Operations

### Connect to Database
```bash
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat

# At psql prompt:
# \dt                    - List all tables
# \du                    - List users
# SELECT * FROM documents LIMIT 5;  - Query documents
# \q                     - Exit
```

### Database Health Check
```bash
# Test connection
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT 1;"

# Expected: Returns "1" if successful
```

### Database Size
```bash
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT pg_size_pretty(pg_database_size('scrapegoat')) AS size;"
```

### Table Statistics
```bash
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      n_live_tup AS row_count
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  "
```

### Check for Locked Tables
```bash
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "
    SELECT * FROM pg_locks
    WHERE NOT granted;
  "
```

---

## Backup and Recovery

### Manual Backup
```bash
# Create backup now
ssh root@docs.den.lan
/opt/scrapegoat-docker/backup.sh

# Expected output:
# === Scrapegoat Backup Started: ...
# Backing up database...
# Backup completed successfully: X.X KB
# Configuration backup completed
# === Backup Completed: ...
```

### List Available Backups
```bash
ssh root@docs.den.lan
ls -lh /opt/scrapegoat-backups/

# Example output:
# scrapegoat_20251110_193032.sql.gz (6.7K) - Database
# scrapegoat_config_20251110_193032.tar.gz (2.1K) - Config
```

### Verify Backup Integrity
```bash
LATEST_BACKUP=$(ssh root@docs.den.lan "ls -t /opt/scrapegoat-backups/scrapegoat_*.sql.gz | head -1")
ssh root@docs.den.lan "gunzip -t ${LATEST_BACKUP} && echo 'Backup integrity: OK'"
```

### Restore Database (Full Procedure)
```bash
# Step 1: Stop services
ssh root@docs.den.lan
cd /opt/scrapegoat-docker
docker compose down

# Step 2: Restore database from backup
BACKUP_FILE="/opt/scrapegoat-backups/scrapegoat_20251110_193032.sql.gz"
gunzip -c "${BACKUP_FILE}" | \
  PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat

# Step 3: Verify restore
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT COUNT(*) as restored_documents FROM documents;"

# Step 4: Start services
docker compose up -d

# Step 5: Verify services healthy
sleep 30
docker compose ps
```

### Restore Configuration Only
```bash
BACKUP_FILE="/opt/scrapegoat-backups/scrapegoat_config_20251110_193032.tar.gz"
cd /opt/scrapegoat-docker
# Backup current config first
cp docker-compose.yml docker-compose.yml.backup
cp .env .env.backup

# Restore from backup
tar -xzf "${BACKUP_FILE}"

# Verify restored files
cat .env | head -5
cat docker-compose.yml | head -20
```

### Backup Retention Policy
```bash
# Backups older than 7 days are automatically deleted
# Backup script runs daily at 2:00 AM AEDT

# Check scheduled backup jobs
crontab -l | grep scrapegoat

# View backup logs
tail -50 /var/log/scrapegoat-backup.log
```

---

## Health Checks

### Verify All Services Healthy
```bash
ssh root@docs.den.lan
cd /opt/scrapegoat-docker

# Check container status
docker compose ps

# Expected:
# STATUS shows "Up X hours (healthy)" for health-check enabled services
# All containers should be running
```

### API Health Endpoints
```bash
# Worker API health
curl -s http://localhost:8080/health | jq .

# MCP Server health
curl -s http://localhost:6280/health | jq .

# Web interface
curl -s http://localhost:80/ | head -5

# Crawl4AI (if enabled)
curl -s http://localhost:8001/health | jq .
```

### Check Container Health Status
```bash
ssh root@docs.den.lan

# Worker service
docker inspect scrapegoat-worker --format='{{.State.Health.Status}}'

# Crawl4AI service
docker inspect scrapegoat-crawl4ai --format='{{.State.Health.Status}}'

# Expected: "healthy" or "none" (if no health check)
```

---

## Monitoring and Troubleshooting

### Check for Errors in Logs
```bash
# Last hour
docker compose logs --since 1h 2>&1 | grep -i "error\|exception"

# Last 24 hours
docker compose logs --since 24h 2>&1 | grep -i "error\|exception"

# Real-time error monitoring
watch -n 5 'docker compose logs --tail=20 2>&1 | grep -i error'
```

### Monitor Job Processing
```bash
# Follow worker logs in real-time
docker compose logs -f worker

# Watch for specific events
docker compose logs -f worker | grep -i "processing\|completed\|failed"
```

### Check Network Connectivity
```bash
# Test database connectivity
ping postgres.den.lan
telnet postgres.den.lan 5432

# Test embedding service
curl -s http://embed.den.lan/health | jq .

# Test from within container
docker exec scrapegoat-worker curl -s http://embed.den.lan/health
```

### Performance Diagnostics
```bash
# CPU and memory usage
docker stats --no-stream

# Disk I/O
iostat -x 1 5

# Network connections
netstat -tlnp | grep docker

# Open file descriptors
lsof -i -P -n | grep docker
```

---

## Troubleshooting Procedures

### Service Won't Start
```bash
# Check configuration syntax
docker compose config

# View startup logs
docker compose logs worker

# Check Docker daemon
systemctl status docker

# Verify network
docker network ls
docker network inspect bridge

# Restart Docker daemon
systemctl restart docker
docker compose up -d
```

### Database Connection Issues
```bash
# Test connection
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT 1;"

# Check network routing
route -n | grep postgres.den.lan
traceroute postgres.den.lan

# Check firewall
iptables -L -n | grep 5432

# Verify DNS
nslookup postgres.den.lan
dig postgres.den.lan
```

### High Resource Usage
```bash
# Identify problematic container
docker stats --no-stream

# Check process list inside container
docker exec scrapegoat-worker ps aux

# Check for memory leaks
docker inspect scrapegoat-worker | grep -A 10 MemoryStats

# Check disk usage
df -h /
du -sh /opt/scrapegoat-docker/*

# Clear Docker unused resources (CAUTION!)
# Remove stopped containers
docker container prune -f

# Remove dangling images
docker image prune -f

# Remove unused volumes (CAUTION - data loss!)
# docker volume prune -f
```

### Memory Limit Exceeded
```bash
# Check memory limits
docker compose config | grep -A 3 "memory:"

# Check current usage
docker stats scrapegoat-worker --no-stream

# Increase memory limit if needed
# Edit docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 4G  # Increase from 2G

docker compose up -d  # Restart to apply
```

### Restart Policy Not Working
```bash
# Check restart policy
docker inspect scrapegoat-worker --format='{{.HostConfig.RestartPolicy}}'

# Verify systemd service
systemctl status scrapegoat.service

# Check systemd logs
journalctl -u scrapegoat.service -n 50
```

---

## Emergency Procedures

### Complete Service Restart
```bash
cd /opt/scrapegoat-docker

# Stop all services gracefully
docker compose stop

# Remove all containers
docker compose down

# Verify nothing running
docker compose ps

# Start fresh
docker compose up -d

# Monitor startup
watch -n 2 'docker compose ps'
```

### Force Kill Stuck Container
```bash
# Identify container
docker ps | grep scrapegoat

# Forcefully stop
docker kill scrapegoat-worker

# Remove container
docker rm scrapegoat-worker

# Let docker-compose recreate it
docker compose up -d
```

### Rollback Configuration
```bash
# Restore from backup
cp docker-compose.yml.backup docker-compose.yml
cp .env.backup .env

# Restart services
docker compose down
docker compose up -d

# Verify
docker compose ps
```

### Rollback Database
```bash
# See "Restore Database" section above
# Identifies the last known good backup and restores from it
```

### Server Reboot Recovery
```bash
# Systemd service will auto-start Docker Compose:
systemctl status scrapegoat.service

# If not starting, manually start:
systemctl start scrapegoat.service

# Monitor startup
docker compose ps
```

---

## Maintenance Tasks

### Weekly Tasks
```bash
# Check backup status
ls -lh /opt/scrapegoat-backups/ | tail -10

# Review error logs
docker compose logs --since 7d | grep -i "error\|exception"

# Check database statistics
PGPASSWORD="NFQcRk1z1S68EMNEEdIGrWqPFWHCvTQLJDL3agMag" psql \
  -h postgres.den.lan \
  -U scrapegoat_user \
  -d scrapegoat \
  -c "SELECT pg_size_pretty(pg_database_size('scrapegoat'));"
```

### Monthly Tasks
```bash
# Review and rotate logs
docker compose logs --since 30d | wc -l

# Update Docker images to latest
docker compose pull

# Test restore procedure with test backup
# (in non-production environment)

# Review resource usage trends
docker stats --no-stream
```

### Quarterly Tasks
```bash
# Rotate credentials (if policy requires)
# Update database password
# Update API keys

# Review backup retention policy
# Verify backup integrity across multiple files
# Test full recovery procedure

# Update documentation
# Review and update this operations guide
```

---

## Incident Response Checklist

### Initial Response (First 5 minutes)
- [ ] Check service status: `docker compose ps`
- [ ] Check recent logs: `docker compose logs --tail=100`
- [ ] Verify database: `psql ... -c "SELECT 1;"`
- [ ] Check disk space: `df -h`
- [ ] Check resource usage: `docker stats --no-stream`

### Investigation (Next 15 minutes)
- [ ] Identify affected services
- [ ] Review error logs: `docker compose logs --since 30m | grep -i error`
- [ ] Check external service connectivity
- [ ] Verify network connectivity
- [ ] Check systemd logs if applicable

### Mitigation (Take action)
- [ ] Attempt service restart: `docker compose restart`
- [ ] If restart fails: `docker compose down && docker compose up -d`
- [ ] If database error: verify database connectivity and restore if needed
- [ ] If disk full: identify and remove unnecessary files

### Recovery
- [ ] Verify all services healthy: `docker compose ps`
- [ ] Test functionality through web interface
- [ ] Confirm API endpoints responding
- [ ] Monitor logs for recurring issues

### Post-Incident
- [ ] Document incident and resolution
- [ ] Create backup of current state
- [ ] Review logs to prevent recurrence
- [ ] Update runbooks if needed
- [ ] Notify stakeholders of resolution

---

## Escalation Path

**Level 1: Service Administrator**
- Check logs and status
- Attempt basic restarts
- Verify external dependencies

**Level 2: DevOps Engineer**
- Full system diagnostics
- Container and Docker troubleshooting
- Database investigation

**Level 3: Senior DevOps / Infrastructure**
- Server-level diagnostics
- Network troubleshooting
- Database administration

**Level 4: Emergency Management**
- Complete system replacement
- Disaster recovery activation
- Communication with stakeholders

---

## Contact Information

**System Administrator**: [Contact Information]
**DevOps Team**: [Contact Information]
**Database Administrator**: [Contact Information]
**On-Call Schedule**: [Schedule Information]
**Emergency Escalation**: [Emergency Number]

---

## Related Documentation

- **ACCESS.md**: Credentials and access information
- **PHASE5_REMEDIATION_COMPLETION_SUMMARY.md**: Final validation report
- **EXECUTIVE_SUMMARY.md**: High-level deployment overview

---

*Last Updated: 2025-11-10*
*Created by: Deployment Automation (Claude Code)*
*Version: 1.0 (PRODUCTION READY)*
