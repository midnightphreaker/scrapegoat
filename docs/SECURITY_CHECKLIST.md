# Security Checklist

**Production Security Hardening for Scrapegoat PostgreSQL Deployment**

This checklist ensures your Scrapegoat deployment meets security best practices for production use. Complete all applicable items before deploying to production.

---

## Table of Contents

1. [Database Security](#database-security)
2. [SQL Injection Protection](#sql-injection-protection)
3. [Embedding API Security](#embedding-api-security)
4. [Access Control](#access-control)
5. [Data Protection](#data-protection)
6. [Dependency Audit](#dependency-audit)
7. [Network Security](#network-security)
8. [Monitoring and Logging](#monitoring-and-logging)

---

## Database Security

### PostgreSQL Authentication

- [ ] **Create dedicated database user** (not `postgres` superuser)
  ```sql
  CREATE USER scrapegoat WITH PASSWORD 'STRONG_PASSWORD_HERE';
  CREATE DATABASE scrapegoat OWNER scrapegoat;
  ```

- [ ] **Use strong passwords** (minimum 16 characters, random, stored securely)
  - Use password manager or secrets management system
  - Never hardcode passwords in code or config files
  - Rotate passwords regularly (every 90 days minimum)

- [ ] **Restrict database user privileges** (principle of least privilege)
  ```sql
  GRANT CONNECT ON DATABASE scrapegoat TO scrapegoat;
  GRANT USAGE, CREATE ON SCHEMA public TO scrapegoat;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scrapegoat;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scrapegoat;
  ```

- [ ] **Revoke public schema privileges**
  ```sql
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  REVOKE ALL ON DATABASE scrapegoat FROM PUBLIC;
  ```

### PostgreSQL Connection Security

- [ ] **Enable SSL/TLS for all connections**
  ```bash
  # postgresql.conf
  ssl = on
  ssl_cert_file = '/path/to/server.crt'
  ssl_key_file = '/path/to/server.key'
  ssl_ca_file = '/path/to/root.crt'
  ssl_min_protocol_version = 'TLSv1.2'
  ```

- [ ] **Configure pg_hba.conf for SSL-only connections**
  ```bash
  # pg_hba.conf - require SSL for remote connections
  hostssl scrapegoat scrapegoat 0.0.0.0/0 md5
  hostssl scrapegoat scrapegoat ::/0 md5

  # Deny non-SSL connections
  hostnossl all all 0.0.0.0/0 reject
  hostnossl all all ::/0 reject
  ```

- [ ] **Verify SSL connection**
  ```bash
  psql "postgresql://scrapegoat:password@hostname:5432/scrapegoat?sslmode=require" -c "SELECT version();"
  ```

- [ ] **Use connection pooling with limits** (`DATABASE_URL` parameters)
  ```
  postgresql://user:pass@host:5432/db?
    sslmode=require&
    application_name=scrapegoat&
    connect_timeout=10&
    statement_timeout=30000
  ```

### PostgreSQL Server Hardening

- [ ] **Disable remote root login**
  ```bash
  # pg_hba.conf
  local   all   postgres   peer
  ```

- [ ] **Configure firewall rules** (only allow application servers)
  ```bash
  # UFW example
  sudo ufw allow from <APP_SERVER_IP> to any port 5432
  sudo ufw deny 5432
  ```

- [ ] **Enable PostgreSQL audit logging**
  ```bash
  # postgresql.conf
  logging_collector = on
  log_connections = on
  log_disconnections = on
  log_duration = on
  log_statement = 'ddl'
  log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
  ```

- [ ] **Set resource limits**
  ```bash
  # postgresql.conf
  max_connections = 100
  shared_buffers = 256MB
  work_mem = 16MB
  maintenance_work_mem = 64MB
  ```

### pgvector Extension Security

- [ ] **Verify pgvector extension installation**
  ```sql
  SELECT * FROM pg_available_extensions WHERE name = 'vector';
  ```

- [ ] **Restrict extension creation privileges**
  ```sql
  REVOKE CREATE ON SCHEMA public FROM scrapegoat;
  -- Extensions should be created by superuser only
  ```

---

## SQL Injection Protection

### Query Parameterization

- [x] **All queries use parameterized statements** (verified in codebase)
  - ✅ DocumentStore uses `pg` library with parameterized queries
  - ✅ No string concatenation in SQL queries
  - ✅ All user input passed as query parameters

- [ ] **Audit custom SQL queries**
  ```bash
  # Search for potential SQL injection risks
  grep -r "query(\`" src/
  grep -r "query('" src/
  grep -r '\${' src/ | grep -i "query\|sql"
  ```

### Input Validation

- [x] **Library and version names validated** (case-insensitive, normalized)
  - ✅ `normalizeVersion()` function sanitizes input
  - ✅ Library names converted to lowercase
  - ✅ No special SQL characters allowed

- [ ] **Validate all user input**
  - Library names: alphanumeric, hyphens, underscores only
  - Version strings: semver format validation
  - URLs: proper URL parsing and validation
  - Search queries: length limits enforced

### Query Safety

- [x] **Use prepared statements** (all pg queries use parameters)
- [x] **Escape special characters** (handled by pg library)
- [x] **Use `plainto_tsquery()` for full-text search** (safe plain text queries)
  - ✅ Never use `to_tsquery()` with user input directly
  - ✅ `plainto_tsquery()` sanitizes input automatically

---

## Embedding API Security

### API Key Management

- [ ] **Store API keys securely**
  - Use environment variables (never commit to git)
  - Use secrets management system (AWS Secrets Manager, HashiCorp Vault, etc.)
  - Restrict access to environment variables

- [ ] **Rotate API keys regularly**
  - OpenAI API keys: rotate every 90 days
  - Google/AWS credentials: follow provider guidelines
  - Document rotation procedures

- [ ] **Use separate keys for dev/staging/production**
  - Never share keys between environments
  - Use separate billing accounts when possible

### API Key Protection

- [ ] **Never log API keys**
  ```typescript
  // Bad
  logger.debug(`Using API key: ${process.env.OPENAI_API_KEY}`);

  // Good
  logger.debug(`Using API key: ${process.env.OPENAI_API_KEY?.slice(0, 8)}...`);
  ```

- [ ] **Redact keys in connection strings**
  - ✅ DocumentManagementService already redacts passwords
  - Apply same pattern to API keys in logs

- [ ] **Use restrictive file permissions for .env files**
  ```bash
  chmod 600 .env
  chown app_user:app_user .env
  ```

### Rate Limiting

- [ ] **Implement rate limiting for embedding requests**
  - OpenAI: 3,000 RPM for text-embedding-3-small
  - Configure `MAX_CONCURRENCY` appropriately
  - Implement exponential backoff for retries

- [ ] **Monitor API usage and costs**
  - Set up billing alerts
  - Track embedding token usage
  - Log failed API requests

---

## Access Control

### Authentication (Optional OAuth2/OIDC)

- [ ] **Enable authentication for production**
  ```bash
  DOCS_MCP_AUTH_ENABLED=true
  DOCS_MCP_AUTH_ISSUER_URL=https://your-idp.example.com
  DOCS_MCP_AUTH_AUDIENCE=https://your-api.example.com
  ```

- [ ] **Validate JWT tokens properly**
  - Verify signature
  - Check expiration
  - Validate issuer and audience
  - Check required scopes

- [ ] **Use HTTPS for all authenticated endpoints**
  - Never send tokens over HTTP
  - Enable HSTS headers
  - Use secure cookies

### Authorization

- [ ] **Implement role-based access control (RBAC)**
  - Read-only users: can search and view documentation
  - Contributors: can scrape and index new documentation
  - Admins: can remove documentation and manage jobs

- [ ] **Validate permissions on every request**
  - Check user roles before executing operations
  - Log authorization failures
  - Return appropriate HTTP status codes (401/403)

### API Security

- [ ] **Use API keys or tokens for programmatic access**
  - Generate unique keys per client
  - Allow key rotation without service interruption
  - Track key usage per client

- [ ] **Implement request rate limiting**
  ```typescript
  // Example: 100 requests per minute per IP
  const rateLimiter = new RateLimiter({
    windowMs: 60 * 1000,
    max: 100
  });
  ```

---

## Data Protection

### Data at Rest

- [ ] **Enable PostgreSQL data encryption**
  - Use encrypted filesystems (LUKS, dm-crypt)
  - Or use managed database with encryption at rest
  - Encrypt backups

- [ ] **Secure backup storage**
  - Encrypt backups before uploading
  - Use separate credentials for backup access
  - Store backups in different geographic location
  - Test restore procedures regularly

### Data in Transit

- [ ] **Use TLS for all connections**
  - PostgreSQL: `sslmode=require` minimum
  - HTTP API: HTTPS only
  - Embedding APIs: HTTPS (enforced by providers)

- [ ] **Validate TLS certificates**
  ```bash
  # DATABASE_URL with certificate validation
  postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/path/to/ca.crt
  ```

### Data Retention

- [ ] **Implement data retention policies**
  - Define retention period for scraped documentation
  - Automate cleanup of old versions
  - Comply with data protection regulations (GDPR, etc.)

- [ ] **Sanitize deleted data**
  - Use `VACUUM FULL` to reclaim space
  - Consider `shred` for sensitive data files
  - Verify data is unrecoverable

### Sensitive Data Handling

- [ ] **Avoid indexing sensitive documentation**
  - Review content before indexing
  - Implement content filtering for PII
  - Audit indexed content regularly

- [ ] **Redact sensitive information in logs**
  - API keys
  - Passwords
  - User emails
  - Authentication tokens

---

## Dependency Audit

### Regular Audits

- [ ] **Run npm audit regularly**
  ```bash
  npm audit
  npm audit fix
  ```

- [ ] **Check for critical vulnerabilities**
  ```bash
  npm audit --audit-level=critical
  ```

- [ ] **Update dependencies monthly**
  ```bash
  npm outdated
  npm update
  ```

### Dependency Security

- [ ] **Use lock files** (package-lock.json committed)
  - Ensures reproducible builds
  - Prevents supply chain attacks
  - Review lock file changes in PRs

- [ ] **Verify package integrity**
  ```bash
  npm ci  # Use in production instead of npm install
  ```

- [ ] **Review new dependencies before adding**
  - Check npm package reputation
  - Review maintainer history
  - Scan for known vulnerabilities
  - Check license compatibility

### Automated Security Scanning

- [ ] **Set up Dependabot or Renovate**
  - Automatic dependency updates
  - Security vulnerability alerts
  - Automated PR creation

- [ ] **Enable GitHub security advisories**
  - Subscribe to security notifications
  - Review advisories for all dependencies

---

## Network Security

### Firewall Configuration

- [ ] **Configure network firewall**
  - Allow only required ports (5432 for PostgreSQL, 6280 for app)
  - Block all other inbound traffic
  - Use security groups / network ACLs

- [ ] **Use private networks for database**
  - Deploy PostgreSQL in private subnet
  - Application servers in public subnet
  - Use VPN or bastion host for admin access

### DDoS Protection

- [ ] **Implement rate limiting** (see Access Control section)

- [ ] **Use CDN / reverse proxy**
  - Cloudflare, AWS CloudFront, or nginx
  - DDoS mitigation
  - SSL termination

### Container Security (Docker Deployments)

- [ ] **Use official base images**
  - Use `node:22-alpine` or similar
  - Scan images for vulnerabilities
  - Keep images updated

- [ ] **Run containers as non-root**
  ```dockerfile
  USER node
  ```

- [ ] **Limit container resources**
  ```yaml
  # docker-compose.yml
  services:
    app:
      mem_limit: 512m
      cpus: 0.5
  ```

---

## Monitoring and Logging

### Application Monitoring

- [ ] **Monitor application health**
  - Response times
  - Error rates
  - Resource usage (CPU, memory)
  - Database connection pool usage

- [ ] **Set up alerts**
  - High error rate (>5% of requests)
  - Slow queries (>1s)
  - Database connection failures
  - Embedding API failures

### Security Monitoring

- [ ] **Monitor authentication failures**
  - Track failed login attempts
  - Alert on brute force attacks
  - Log IP addresses of failed attempts

- [ ] **Monitor database access**
  - Track unusual query patterns
  - Alert on DDL changes (DROP, ALTER)
  - Monitor connection sources

- [ ] **Log security events**
  - Authentication attempts
  - Authorization failures
  - Configuration changes
  - Data access by admins

### Log Management

- [ ] **Centralize logs**
  - Use log aggregation system (ELK, Splunk, CloudWatch)
  - Retain logs for compliance period
  - Encrypt logs in transit and at rest

- [ ] **Implement log rotation**
  ```bash
  # Example logrotate config
  /var/log/scrapegoat/*.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
  }
  ```

- [ ] **Sanitize logs** (remove sensitive data)
  - API keys
  - Passwords
  - Personal information

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Complete all applicable security checklist items
- [ ] Run security audit tools
- [ ] Perform penetration testing
- [ ] Review code for security issues
- [ ] Update all dependencies
- [ ] Test backup and restore procedures

### Deployment

- [ ] Use environment-specific configurations
- [ ] Deploy to isolated production environment
- [ ] Verify SSL/TLS certificates
- [ ] Test all security controls
- [ ] Monitor deployment for errors

### Post-Deployment

- [ ] Verify all services are running
- [ ] Test authentication and authorization
- [ ] Verify database connectivity
- [ ] Test backup procedures
- [ ] Monitor logs for security events
- [ ] Document deployment configuration

---

## Incident Response

### Preparation

- [ ] **Create incident response plan**
  - Define roles and responsibilities
  - Document escalation procedures
  - Maintain contact list

- [ ] **Prepare incident response tools**
  - Database backup/restore scripts
  - Log analysis tools
  - Communication channels

### Detection

- [ ] **Monitor security alerts**
  - Set up 24/7 monitoring
  - Define alert thresholds
  - Test alerting system

### Response

- [ ] **Document incident response procedures**
  1. Identify and contain incident
  2. Assess impact and severity
  3. Eradicate threat
  4. Recover systems
  5. Document lessons learned

---

## Compliance

### Data Protection

- [ ] **GDPR compliance** (if handling EU data)
  - Right to access
  - Right to deletion
  - Data portability
  - Privacy policy

- [ ] **CCPA compliance** (if handling CA data)
  - Similar to GDPR requirements

### Industry Standards

- [ ] **SOC 2 compliance** (if applicable)
  - Security controls
  - Availability
  - Processing integrity
  - Confidentiality
  - Privacy

---

## Security Review Schedule

- [ ] **Monthly**: npm audit, dependency updates
- [ ] **Quarterly**: Security checklist review, password rotation
- [ ] **Annually**: Penetration testing, compliance audit
- [ ] **After incidents**: Review and update security controls

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [CIS PostgreSQL Benchmark](https://www.cisecurity.org/benchmark/postgresql)

---

**Last Updated**: 2025-11-08
**Version**: 1.0.0
