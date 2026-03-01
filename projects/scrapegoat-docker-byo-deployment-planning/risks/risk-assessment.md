# Risk Assessment and Mitigation Strategies

**Project**: Scrapegoat Docker Compose BYO Deployment
**Date**: 2025-11-10
**Risk Assessment Version**: 1.0

---

## Risk Summary

| Risk Level | Count | Status |
|------------|-------|--------|
| **Critical** | 2 | Mitigated with verification steps |
| **High** | 4 | Mitigated with preventive measures |
| **Medium** | 5 | Monitored with contingency plans |
| **Low** | 3 | Accepted with documentation |

---

## Critical Risks

### RISK-C1: Database Connection Failure

**Severity**: Critical
**Likelihood**: Medium
**Category**: Infrastructure

#### Description
Worker service unable to connect to PostgreSQL database on postgres.den.lan, causing deployment failure.

#### Impact
- Complete deployment failure
- Services unable to start
- No data persistence possible

#### Root Causes
1. Incorrect DATABASE_URL in .env file
2. Database not created or user not authorized
3. Network connectivity issues between docs.den.lan and postgres.den.lan
4. Firewall blocking port 5432
5. pgvector extension not enabled

#### Mitigation Strategy

**Preventive Actions**:
1. **Pre-deployment verification** (Phase 1):
   - Test PostgreSQL connectivity before deployment
   - Verify credentials work
   - Test from docs.den.lan specifically

2. **Database initialization** (Phase 2):
   - Follow exact sequence of user/database creation
   - Test connection after each step
   - Verify pgvector extension enabled

3. **Configuration validation** (Phase 3):
   - Double-check DATABASE_URL format
   - Ensure password matches generated password
   - Test connection string before starting services

**Detection**:
- Worker container health check will fail
- Logs will show database connection errors
- Command: `docker compose logs worker | grep -i database`

**Contingency Plan**:
```bash
# 1. Verify database exists
psql -h postgres.den.lan -U postgres -l | grep scrapegoat

# 2. Verify user can connect
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "SELECT 1;"

# 3. Check DATABASE_URL in .env
grep DATABASE_URL /opt/scrapegoat-docker/.env

# 4. Test network connectivity
ping postgres.den.lan
telnet postgres.den.lan 5432

# 5. Recreate database if needed (Phase 2 steps)
```

**Status**: Mitigated through comprehensive Phase 1 and Phase 2 verification steps.

---

### RISK-C2: Embedding Service Unavailable

**Severity**: Critical
**Likelihood**: Low
**Category**: External Dependency

#### Description
Embedding service on embed.den.lan is unreachable or not functioning, preventing vector embedding generation.

#### Impact
- Vector search functionality disabled
- Document indexing may fail or be incomplete
- Only full-text search available
- Degraded user experience

#### Root Causes
1. embed.den.lan server offline or unreachable
2. Embedding service not running
3. Network connectivity issues
4. Model not loaded in embedding service
5. Incorrect OPENAI_API_BASE configuration

#### Mitigation Strategy

**Preventive Actions**:
1. **Pre-deployment verification** (Phase 1):
   - Test embed.den.lan/models endpoint
   - Verify nomic-ai/nomic-embed-text-v1.5 model available
   - Test actual embedding generation
   - Confirm 768-dimension vectors returned

2. **Configuration** (Phase 3):
   - Set OPENAI_API_BASE=http://embed.den.lan/v1 (with /v1 suffix)
   - Set OPENAI_API_KEY=not-required
   - Set correct model name

**Detection**:
- Worker logs show embedding warnings
- Search functionality returns limited results
- Command: `docker compose logs worker | grep -i embedding`

**Contingency Plan**:
```bash
# 1. Verify embed.den.lan accessible
curl http://embed.den.lan/models

# 2. Check model availability
curl http://embed.den.lan/models | jq '.[] | select(.id=="nomic-ai/nomic-embed-text-v1.5")'

# 3. Test embedding generation
curl -X POST http://embed.den.lan/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input":["test"],"model":"nomic-ai/nomic-embed-text-v1.5"}'

# 4. Fallback: Use full-text search only
# Update .env to disable vector search if needed
```

**Alternative**: System falls back to full-text search (GIN indexes) if embeddings unavailable.

**Status**: Mitigated with pre-deployment verification and graceful fallback.

---

## High Risks

### RISK-H1: Port Conflicts

**Severity**: High
**Likelihood**: Medium
**Category**: Infrastructure

#### Description
Required ports (8080, 6280, 80, 8001) already in use by other services.

#### Impact
- Docker containers fail to start
- Services inaccessible
- Deployment blocked

#### Mitigation Strategy

**Preventive Actions**:
- Phase 1 includes comprehensive port availability check
- Automated cleanup of previous scrapegoat installations
- systemd service removal if exists

**Detection**:
```bash
# Check all required ports
for port in 8080 6280 80 8001; do lsof -i :$port; done
```

**Contingency Plan**:
```bash
# Identify process using port
lsof -i :{PORT}

# Stop service or kill process
systemctl stop {service_name}
# or
kill {PID}
```

**Status**: Mitigated with Phase 1 verification.

---

### RISK-H2: Docker Image Pull Failure

**Severity**: High
**Likelihood**: Low
**Category**: Technical

#### Description
Unable to pull git.fenrirsden.org/pub/scrapegoat:latest or crawl4ai images.

#### Impact
- Cannot start services
- Deployment blocked until images available

#### Mitigation Strategy

**Preventive Actions**:
- Verify internet connectivity before deployment
- Check GitHub Container Registry (ghcr.io) is accessible

**Detection**:
- `docker compose pull` fails with error

**Contingency Plan**:
```bash
# 1. Check internet connectivity
ping ghcr.io

# 2. Try manual pull
docker pull git.fenrirsden.org/pub/scrapegoat:latest

# 3. Alternative: Build locally
cd /home/mp/Workspace/scrapegoat
docker build -t git.fenrirsden.org/pub/scrapegoat:latest .

# 4. Update docker-compose.yml to use local build
```

**Status**: Low likelihood, fallback to local build available.

---

### RISK-H3: Insufficient Resources

**Severity**: High
**Likelihood**: Low
**Category**: Infrastructure

#### Description
docs.den.lan has insufficient CPU, memory, or disk space for Docker containers.

#### Impact
- Container crashes or OOM kills
- Poor performance
- Service instability

#### Resource Requirements
| Service | Memory | CPU | Disk |
|---------|--------|-----|------|
| Worker | 1-2GB | 1 core | - |
| MCP | 256-512MB | 0.5 core | - |
| Web | 256-512MB | 0.5 core | - |
| Crawl4AI | 1-2GB | 1 core | - |
| **Total** | **3-5GB** | **3 cores** | **10GB+** |

#### Mitigation Strategy

**Preventive Actions**:
```bash
# Check available resources before deployment
free -h  # Check memory
df -h    # Check disk space
nproc    # Check CPU cores
```

**Detection**:
- Monitor with: `docker stats`
- Check system logs: `dmesg | grep -i "out of memory"`

**Contingency Plan**:
```bash
# Option 1: Disable Crawl4AI if resources tight
# Don't use --profile crawl4ai

# Option 2: Adjust memory limits in docker-compose.yml
# Reduce worker memory limit from 2G to 1G

# Option 3: Add swap space (Linux)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

**Status**: docs.den.lan likely has sufficient resources. Monitoring recommended.

---

### RISK-H4: Database Migration Failure

**Severity**: High
**Likelihood**: Low
**Category**: Technical

#### Description
Database schema migrations fail to apply correctly during first worker startup.

#### Impact
- Missing tables or indexes
- Application errors
- Degraded functionality

#### Mitigation Strategy

**Preventive Actions**:
- Fresh database ensures clean migration
- pgvector extension enabled before migrations
- Worker health check ensures migrations complete

**Detection**:
```bash
# Check migration status
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat \
  -c "SELECT version FROM _schema_migrations ORDER BY version;"

# Check tables exist
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "\dt"
```

**Contingency Plan**:
```bash
# 1. Check worker logs
docker compose logs worker | grep -i migration

# 2. Manually run migrations if needed
docker exec scrapegoat-worker node dist/cli.js migrate

# 3. Worst case: Drop and recreate database
# Then restart services to trigger migrations
```

**Status**: Low likelihood with clean database. Health checks verify success.

---

## Medium Risks

### RISK-M1: Network Latency Between Services

**Severity**: Medium
**Likelihood**: Medium
**Category**: Performance

#### Description
High network latency between docs.den.lan and postgres.den.lan/embed.den.lan affects performance.

#### Impact
- Slower document indexing
- Delayed search responses
- Reduced throughput

#### Mitigation Strategy

**Acceptance**: Some latency expected with distributed architecture.

**Monitoring**:
```bash
# Test latency
ping -c 10 postgres.den.lan
ping -c 10 embed.den.lan

# Monitor response times in logs
docker compose logs worker | grep -i "response time"
```

**Optimization**:
- Connection pooling enabled by default
- Batch operations for embeddings
- Database indexes for query performance

**Status**: Accepted with monitoring. Not critical for functionality.

---

### RISK-M2: Crawl4AI Service Instability

**Severity**: Medium
**Likelihood**: Medium
**Category**: Technical

#### Description
Crawl4AI service (Playwright/Chromium) crashes or becomes unresponsive.

#### Impact
- AI-optimized web scraping unavailable
- Fallback to standard HTML fetcher
- Reduced content quality

#### Mitigation Strategy

**Preventive Actions**:
- Crawl4AI is optional (CRAWL4AI_ENABLED flag)
- Worker has fallback HTML fetcher
- Separate container prevents affecting other services

**Detection**:
```bash
# Check Crawl4AI health
curl http://localhost:8001/health

# Monitor logs
docker compose logs crawl4ai
```

**Contingency Plan**:
```bash
# Restart Crawl4AI service
docker compose restart crawl4ai

# Disable if persistently problematic
# Set CRAWL4AI_ENABLED=false in .env
# Restart worker
```

**Status**: Optional service, graceful degradation available.

---

### RISK-M3: Log Disk Space Exhaustion

**Severity**: Medium
**Likelihood**: Low
**Category**: Operations

#### Description
Docker container logs consume excessive disk space over time.

#### Impact
- Disk full errors
- Service failures
- Manual intervention required

#### Mitigation Strategy

**Preventive Actions**:
- Log rotation configured in Phase 6
- Docker default log limits (10MB per file, 3 rotations)

**Monitoring**:
```bash
# Check log sizes
du -sh /var/lib/docker/containers/*/*.log

# Check disk usage
df -h /var/lib/docker
```

**Contingency Plan**:
```bash
# Manual log cleanup if needed
truncate -s 0 /var/lib/docker/containers/*/*.log

# Adjust log rotation settings
# Edit /etc/logrotate.d/scrapegoat-docker
```

**Status**: Mitigated with log rotation configuration.

---

### RISK-M4: pgvector Version Incompatibility

**Severity**: Medium
**Likelihood**: Low
**Category**: Technical

#### Description
pgvector version on postgres.den.lan incompatible with Scrapegoat requirements.

#### Impact
- Vector operations may fail
- HNSW index creation issues
- Degraded search quality

#### Requirements
- Minimum: pgvector 0.5.0
- Recommended: pgvector 0.8.0+

#### Mitigation Strategy

**Preventive Actions**:
- Phase 1 verification checks pgvector version
- Phase 2 confirms extension works

**Detection**:
```bash
# Check version
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat \
  -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
```

**Contingency Plan**:
```bash
# Upgrade pgvector if needed (on postgres.den.lan)
# See /home/mp/Workspace/scrapegoat/docs/POSTGRESQL_SETUP.md

# Or disable vector search and use full-text only
```

**Status**: Pre-verification catches this issue early.

---

### RISK-M5: Data Volume Corruption

**Severity**: Medium
**Likelihood**: Very Low
**Category**: Data Integrity

#### Description
Docker volume scrapegoat-data becomes corrupted, losing application data.

#### Impact
- Loss of application metadata
- Potential re-indexing required
- No loss of database data (stored on postgres.den.lan)

#### Mitigation Strategy

**Preventive Actions**:
- Use named Docker volume for persistence
- Regular backups of PostgreSQL database
- Application data is mostly cached/temporary

**Detection**:
```bash
# Inspect volume
docker volume inspect scrapegoat-data

# Check for errors in logs
docker compose logs | grep -i "error.*data"
```

**Contingency Plan**:
```bash
# Recreate volume
docker compose down
docker volume rm scrapegoat-data
docker compose up -d

# Data will be regenerated from database
```

**Status**: Low impact, database is source of truth.

---

## Low Risks

### RISK-L1: Embedding Model Change

**Severity**: Low
**Likelihood**: Low
**Category**: Configuration

#### Description
embed.den.lan changes embedding model without notification.

#### Impact
- Inconsistent embeddings
- Search quality degradation
- Need to re-index documents

#### Mitigation Strategy

**Acceptance**: Model changes are intentional administrative actions.

**Detection**: Monitor search quality, embedding dimensions.

**Recovery**: Re-index all documents if model changes.

**Status**: Accepted operational risk.

---

### RISK-L2: Port Number Conflicts in Future

**Severity**: Low
**Likelihood**: Low
**Category**: Operations

#### Description
Future services need ports currently used by Scrapegoat.

#### Impact
- Need to reconfigure and restart services
- Brief service interruption

#### Mitigation Strategy

**Preventive Actions**:
- Document all used ports clearly
- Standard port numbers for easier management

**Resolution**:
- Update port numbers in .env
- Restart services: `docker compose up -d`

**Status**: Easy to resolve if occurs.

---

### RISK-L3: Docker Compose Version Incompatibility

**Severity**: Low
**Likelihood**: Very Low
**Category**: Technical

#### Description
Docker Compose version on docs.den.lan doesn't support required features.

#### Impact
- Deployment may fail
- Missing features

#### Requirements
- Minimum: Docker Compose v2.0
- Recommended: v2.20+

#### Mitigation Strategy

**Preventive Actions**:
- Phase 1 checks Docker Compose version
- Update Docker Compose if needed

**Status**: Modern Docker installations include compatible version.

---

## Risk Monitoring Plan

### Pre-Deployment
- [ ] All Critical and High risks reviewed
- [ ] Mitigation strategies understood
- [ ] Contingency plans available
- [ ] Phase 1 verification catches 80% of risks

### During Deployment
- [ ] Monitor each phase for warning signs
- [ ] Stop and troubleshoot if issues arise
- [ ] Don't skip validation steps

### Post-Deployment (First 24 Hours)
- [ ] Monitor logs continuously
- [ ] Check resource usage hourly
- [ ] Test all functionality
- [ ] Verify database connectivity remains stable

### Ongoing (Weekly)
- [ ] Review logs for warnings
- [ ] Check disk space
- [ ] Verify all services healthy
- [ ] Test backup procedures

---

## Rollback Plan

### Quick Rollback (< 5 minutes)

```bash
# Stop all services
cd /opt/scrapegoat-docker
docker compose down

# Remove containers and volumes
docker compose down -v

# Database cleanup (optional - only if database corrupted)
# ssh root@postgres.den.lan
# sudo -u postgres psql -c "DROP DATABASE scrapegoat;"
```

### Full Rollback to Previous State

```bash
# If previous systemd installation needs to be restored
# 1. Remove Docker deployment
cd /opt/scrapegoat-docker
docker compose down -v
rm -rf /opt/scrapegoat-docker

# 2. Restore previous installation
# (Follow previous deployment documentation)
```

### Data Recovery

```bash
# Database backup restoration
gunzip -c /opt/scrapegoat-backups/scrapegoat_YYYYMMDD_HHMMSS.sql.gz | \
  psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat
```

---

## Risk Acceptance Sign-Off

All identified risks have been:
- ✅ Assessed for severity and likelihood
- ✅ Assigned mitigation strategies
- ✅ Integrated into deployment phases
- ✅ Documented with contingency plans

**Residual Risk Level**: **LOW** - Acceptable for deployment

**Risk Review Date**: 2025-11-10
**Next Review**: Post-deployment (after 48 hours of operation)

---

*For deployment execution, see: [deployment-phases.md](../planning/deployment-phases.md)*

*Last Updated: 2025-11-10*
