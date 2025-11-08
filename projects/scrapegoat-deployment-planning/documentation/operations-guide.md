# Scrapegoat Operations Guide

## Table of Contents
1. [Service Management](#service-management)
2. [Monitoring](#monitoring)
3. [Backup and Recovery](#backup-and-recovery)
4. [Updates and Maintenance](#updates-and-maintenance)
5. [Troubleshooting](#troubleshooting)
6. [Performance Tuning](#performance-tuning)

---

## Service Management

### Starting and Stopping

```bash
# Start the service
ssh root@docs.den.lan "systemctl start scrapegoat"

# Stop the service
ssh root@docs.den.lan "systemctl stop scrapegoat"

# Restart the service
ssh root@docs.den.lan "systemctl restart scrapegoat"

# Reload configuration (graceful restart)
ssh root@docs.den.lan "systemctl reload scrapegoat"
```

### Service Status

```bash
# Check service status
ssh root@docs.den.lan "systemctl status scrapegoat"

# Check if service is enabled for boot
ssh root@docs.den.lan "systemctl is-enabled scrapegoat"

# Check if service is currently active
ssh root@docs.den.lan "systemctl is-active scrapegoat"
```

### Enable/Disable Auto-Start

```bash
# Enable auto-start on boot
ssh root@docs.den.lan "systemctl enable scrapegoat"

# Disable auto-start on boot
ssh root@docs.den.lan "systemctl disable scrapegoat"
```

---

## Monitoring

### Real-Time Logs

```bash
# Follow logs in real-time
ssh root@docs.den.lan "journalctl -u scrapegoat -f"

# Follow logs with timestamps
ssh root@docs.den.lan "journalctl -u scrapegoat -f --output=short-iso"
```

### Historical Logs

```bash
# Last 100 lines
ssh root@docs.den.lan "journalctl -u scrapegoat -n 100"

# Logs from last hour
ssh root@docs.den.lan "journalctl -u scrapegoat --since '1 hour ago'"

# Logs from specific time range
ssh root@docs.den.lan "journalctl -u scrapegoat --since '2025-11-08 10:00' --until '2025-11-08 12:00'"

# Only errors and warnings
ssh root@docs.den.lan "journalctl -u scrapegoat -p err"
```

### Resource Usage

```bash
# Check memory and CPU usage
ssh root@docs.den.lan "systemctl status scrapegoat | grep -E 'Memory|CPU'"

# Detailed process information
ssh root@docs.den.lan "ps aux | grep scrapegoat | grep -v grep"

# Check port usage
ssh root@docs.den.lan "ss -tlnp | grep 6280"
```

### Health Checks

```bash
# Test web interface
curl -I http://docs.den.lan/

# Test API endpoint
curl http://docs.den.lan/web/libraries

# Check database connectivity
ssh root@docs.den.lan "cd /opt/scrapegoat && node -e \"
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1').then(() => {
  console.log('✅ Database connection OK');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database error:', err.message);
  process.exit(1);
});
\""
```

---

## Backup and Recovery

### Database Backup

```bash
# Create database backup
ssh root@postgres.den.lan "sudo -u postgres pg_dump scrapegoat > /tmp/scrapegoat_backup_$(date +%Y%m%d_%H%M%S).sql"

# Create compressed backup
ssh root@postgres.den.lan "sudo -u postgres pg_dump scrapegoat | gzip > /tmp/scrapegoat_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Backup to local machine
ssh root@postgres.den.lan "sudo -u postgres pg_dump scrapegoat" | gzip > "scrapegoat_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Database Restore

```bash
# Stop the application first
ssh root@docs.den.lan "systemctl stop scrapegoat"

# Restore from backup (on postgres server)
ssh root@postgres.den.lan "sudo -u postgres psql scrapegoat < /tmp/scrapegoat_backup_YYYYMMDD_HHMMSS.sql"

# Restore from compressed backup
ssh root@postgres.den.lan "zcat /tmp/scrapegoat_backup_YYYYMMDD_HHMMSS.sql.gz | sudo -u postgres psql scrapegoat"

# Restart the application
ssh root@docs.den.lan "systemctl start scrapegoat"
```

### Application Backup

```bash
# Backup application directory (excluding node_modules)
ssh root@docs.den.lan "tar --exclude='node_modules' --exclude='dist' -czf /tmp/scrapegoat_app_$(date +%Y%m%d).tar.gz -C /opt scrapegoat"

# Copy backup to local machine
scp root@docs.den.lan:/tmp/scrapegoat_app_$(date +%Y%m%d).tar.gz ./
```

### Configuration Backup

```bash
# Backup all configuration files
ssh root@docs.den.lan "tar -czf /tmp/scrapegoat_config_$(date +%Y%m%d).tar.gz \
  /opt/scrapegoat/.env \
  /etc/systemd/system/scrapegoat.service \
  /etc/nginx/sites-available/scrapegoat"

# Copy to local machine
scp root@docs.den.lan:/tmp/scrapegoat_config_$(date +%Y%m%d).tar.gz ./
```

---

## Updates and Maintenance

### Updating the Application

```bash
# 1. Backup current version
ssh root@docs.den.lan "cd /opt/scrapegoat && tar -czf /tmp/scrapegoat_pre_update_$(date +%Y%m%d).tar.gz ."

# 2. Stop the service
ssh root@docs.den.lan "systemctl stop scrapegoat"

# 3. Pull latest code (if using git)
ssh root@docs.den.lan "cd /opt/scrapegoat && git pull origin postgres-fork"

# 4. Install dependencies
ssh root@docs.den.lan "cd /opt/scrapegoat && npm install"

# 5. Build application
ssh root@docs.den.lan "cd /opt/scrapegoat && npm run build"

# 6. Check for new migrations
ssh root@docs.den.lan "ls -la /opt/scrapegoat/db/migrations/"

# 7. Run any new migrations (if needed)
# ssh root@postgres.den.lan "sudo -u postgres psql -d scrapegoat -f /path/to/new/migration.sql"

# 8. Start the service
ssh root@docs.den.lan "systemctl start scrapegoat"

# 9. Verify
curl -I http://docs.den.lan/
ssh root@docs.den.lan "journalctl -u scrapegoat -n 50"
```

### Updating Node.js

```bash
# Check current version
ssh root@docs.den.lan "node --version"

# Update Node.js to latest LTS
ssh root@docs.den.lan "curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && apt install -y nodejs"

# Rebuild application with new Node version
ssh root@docs.den.lan "cd /opt/scrapegoat && npm rebuild && npm run build"

# Restart service
ssh root@docs.den.lan "systemctl restart scrapegoat"
```

### Updating nginx

```bash
# Update nginx
ssh root@docs.den.lan "apt update && apt upgrade -y nginx"

# Verify configuration still valid
ssh root@docs.den.lan "nginx -t"

# Reload nginx
ssh root@docs.den.lan "systemctl reload nginx"
```

---

## Troubleshooting

### Service Won't Start

**Check logs for errors:**
```bash
ssh root@docs.den.lan "journalctl -u scrapegoat -n 100 --no-pager"
```

**Common issues:**

1. **Port already in use:**
```bash
# Find process using port 6280
ssh root@docs.den.lan "lsof -i :6280"

# Kill the process (replace PID)
ssh root@docs.den.lan "kill -9 <PID>"

# Restart service
ssh root@docs.den.lan "systemctl restart scrapegoat"
```

2. **Database connection failure:**
```bash
# Test database connectivity
ssh root@docs.den.lan "psql postgresql://scrapegoat_user:REDL62IPcLF4u9bYA0AqXNSgFxfxUy7d@postgres.den.lan:5432/scrapegoat -c 'SELECT 1;'"

# Check PostgreSQL is running
ssh root@postgres.den.lan "systemctl status postgresql"

# Check network connectivity
ping postgres.den.lan
```

3. **Missing environment variables:**
```bash
# Verify .env file exists
ssh root@docs.den.lan "cat /opt/scrapegoat/.env"

# Check systemd can read it
ssh root@docs.den.lan "systemctl show scrapegoat | grep Environment"
```

### Web Interface Not Loading

**Check nginx:**
```bash
# Nginx status
ssh root@docs.den.lan "systemctl status nginx"

# Test nginx config
ssh root@docs.den.lan "nginx -t"

# Check nginx error logs
ssh root@docs.den.lan "tail -50 /var/log/nginx/error.log"
```

**Check application is running:**
```bash
# Direct connection to app (bypass nginx)
curl http://docs.den.lan:6280/

# If this works but http://docs.den.lan/ doesn't, it's an nginx issue
```

**Check firewall:**
```bash
ssh root@docs.den.lan "iptables -L -n | grep 80"
```

### High Memory Usage

```bash
# Check current memory usage
ssh root@docs.den.lan "free -h"

# Check scrapegoat memory usage
ssh root@docs.den.lan "ps aux | grep scrapegoat | grep -v grep"

# Restart to clear memory (if needed)
ssh root@docs.den.lan "systemctl restart scrapegoat"
```

### Slow Performance

**Check database:**
```bash
# Check active connections
ssh root@postgres.den.lan "sudo -u postgres psql -d scrapegoat -c 'SELECT count(*) FROM pg_stat_activity;'"

# Check long-running queries
ssh root@postgres.den.lan "sudo -u postgres psql -d scrapegoat -c \"SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;\""

# Check database size
ssh root@postgres.den.lan "sudo -u postgres psql -d scrapegoat -c '\l+'"
```

**Check application logs for slow operations:**
```bash
ssh root@docs.den.lan "journalctl -u scrapegoat -n 200 | grep -E 'slow|timeout|error'"
```

### Database Issues

**Vacuum and analyze:**
```bash
ssh root@postgres.den.lan "sudo -u postgres psql -d scrapegoat -c 'VACUUM ANALYZE;'"
```

**Reindex:**
```bash
ssh root@postgres.den.lan "sudo -u postgres psql -d scrapegoat -c 'REINDEX DATABASE scrapegoat;'"
```

**Check table sizes:**
```bash
ssh root@postgres.den.lan "sudo -u postgres psql -d scrapegoat -c \"
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
\""
```

---

## Performance Tuning

### Application Tuning

**Adjust connection pool size** (in .env):
```bash
# Edit .env
ssh root@docs.den.lan "nano /opt/scrapegoat/.env"

# Add or modify:
# DATABASE_POOL_MIN=2
# DATABASE_POOL_MAX=10

# Restart service
ssh root@docs.den.lan "systemctl restart scrapegoat"
```

### Database Tuning

**PostgreSQL configuration:**
```bash
# Edit postgresql.conf
ssh root@postgres.den.lan "nano /etc/postgresql/18/main/postgresql.conf"

# Recommended settings for production:
# shared_buffers = 256MB          # 25% of RAM
# effective_cache_size = 1GB      # 50-75% of RAM
# maintenance_work_mem = 64MB
# checkpoint_completion_target = 0.9
# wal_buffers = 16MB
# default_statistics_target = 100
# random_page_cost = 1.1          # For SSD
# effective_io_concurrency = 200  # For SSD

# Restart PostgreSQL
ssh root@postgres.den.lan "systemctl restart postgresql"
```

### Nginx Tuning

```bash
# Edit nginx.conf
ssh root@docs.den.lan "nano /etc/nginx/nginx.conf"

# Increase worker connections
# worker_connections 1024;

# Enable gzip compression
# gzip on;
# gzip_vary on;
# gzip_proxied any;
# gzip_comp_level 6;
# gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;

# Reload nginx
ssh root@docs.den.lan "systemctl reload nginx"
```

---

## Maintenance Schedule

### Daily
- [ ] Check service status
- [ ] Review error logs
- [ ] Monitor disk space

### Weekly
- [ ] Review application logs for patterns
- [ ] Check database size growth
- [ ] Verify backups are being created

### Monthly
- [ ] Test backup restoration
- [ ] Review and clean old logs
- [ ] Check for application updates
- [ ] Database vacuum and analyze
- [ ] Review resource usage trends

### Quarterly
- [ ] Security audit
- [ ] Performance review
- [ ] Update dependencies
- [ ] Review and update documentation

---

## Quick Reference

### Important Files
- Application: `/opt/scrapegoat/`
- Environment: `/opt/scrapegoat/.env`
- Service: `/etc/systemd/system/scrapegoat.service`
- Nginx config: `/etc/nginx/sites-available/scrapegoat`
- Logs: `journalctl -u scrapegoat`

### Important Commands
```bash
# Restart everything
ssh root@docs.den.lan "systemctl restart scrapegoat nginx"

# Check status
ssh root@docs.den.lan "systemctl status scrapegoat nginx"

# View logs
ssh root@docs.den.lan "journalctl -u scrapegoat -f"

# Test application
curl -I http://docs.den.lan/
```

### Emergency Contacts
- Application Server: docs.den.lan (10.1.1.27)
- Database Server: postgres.den.lan (10.1.1.15)
- Embedding Server: embed.den.lan (10.1.1.61)

---

**For additional support, refer to the main project documentation or contact the development team.**
