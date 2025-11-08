# Deployment Phases: Scrapegoat Production Deployment

## Phase 1: Database Setup (CRITICAL PATH)
**Timeline**: 15-30 minutes
**Goal**: Create and configure PostgreSQL database for Scrapegoat

### Tasks
- [ ] SSH to postgres.den.lan (10.1.1.15)
- [ ] Create database: scrapegoat
- [ ] Create dedicated user: scrapegoat_user with secure password
- [ ] Grant appropriate permissions (not superuser)
- [ ] Enable pgvector extension
- [ ] Test connection from docs.den.lan
- [ ] Document DATABASE_URL connection string

### Success Criteria
- Database created and accessible
- User has appropriate permissions (INSERT, UPDATE, DELETE, SELECT on all tables)
- pgvector extension enabled
- Connection tested successfully

### Deliverables
- Database: scrapegoat
- User credentials: scrapegoat_user with password
- Connection string for .env file

---

## Phase 2: Application Server Preparation
**Timeline**: 30-45 minutes
**Goal**: Prepare docs.den.lan with all required software

### Tasks
- [ ] SSH to docs.den.lan (10.1.1.27)
- [ ] Update system packages (apt update && apt upgrade)
- [ ] Install Node.js 20.x LTS
- [ ] Install npm and build-essential
- [ ] Install Git
- [ ] Install nginx for reverse proxy
- [ ] Create deployment user (scrapegoat) - optional, can run as root in LXC
- [ ] Create application directory: /opt/scrapegoat
- [ ] Configure firewall (if needed) to allow port 80

### Success Criteria
- Node.js v20.x installed
- npm available
- Git installed
- nginx installed and running
- Application directory created with proper permissions

### Deliverables
- Prepared server ready for application deployment
- nginx installed and ready to configure

---

## Phase 3: Application Deployment
**Timeline**: 20-30 minutes
**Goal**: Clone, build, and configure Scrapegoat application

### Tasks
- [ ] Clone repository from gitlab.den.lan/pub/scrapegoat.git
- [ ] Checkout postgres-fork branch
- [ ] Run npm install
- [ ] Run npm run build
- [ ] Create .env file with production configuration
- [ ] Run database migrations (npm run migrate)
- [ ] Verify build artifacts in dist/ directory

### Environment Configuration (.env)
```bash
DATABASE_URL=postgresql://scrapegoat_user:PASSWORD@postgres.den.lan:5432/scrapegoat
INFINITY_API_URL=http://embed.den.lan
DOCS_MCP_EMBEDDING_MODEL=infinity:nomic-ai/nomic-embed-text-v1.5
NODE_ENV=production
PORT=6280
HOST=0.0.0.0
LOG_LEVEL=info
```

### Success Criteria
- Repository cloned successfully
- Dependencies installed without errors
- Application built successfully
- Database migrations completed
- .env file configured correctly

### Deliverables
- Built application in /opt/scrapegoat
- Configured .env file
- Initialized database schema

---

## Phase 4: Service Configuration
**Timeline**: 15-20 minutes
**Goal**: Set up systemd service for automatic startup and management

### Tasks
- [ ] Create systemd service file: /etc/systemd/system/scrapegoat.service
- [ ] Configure service to run on boot
- [ ] Set up restart policies
- [ ] Configure logging
- [ ] Enable service
- [ ] Start service
- [ ] Verify service is running

### Systemd Service Template
```ini
[Unit]
Description=Scrapegoat MCP Documentation Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/scrapegoat
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/scrapegoat/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scrapegoat

[Install]
WantedBy=multi-user.target
```

### Success Criteria
- Service file created correctly
- Service starts without errors
- Service accessible on port 6280
- Service configured to start on boot

### Deliverables
- systemd service: scrapegoat.service
- Running application on port 6280

---

## Phase 5: Reverse Proxy Configuration
**Timeline**: 15-20 minutes
**Goal**: Configure nginx to serve Scrapegoat on port 80

### Tasks
- [ ] Create nginx site configuration
- [ ] Configure reverse proxy to port 6280
- [ ] Enable site configuration
- [ ] Test nginx configuration
- [ ] Reload nginx
- [ ] Verify web UI accessible on port 80

### Nginx Configuration Template
```nginx
server {
    listen 80;
    server_name docs.den.lan;

    location / {
        proxy_pass http://127.0.0.1:6280;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Success Criteria
- nginx configuration valid
- Web UI accessible at http://docs.den.lan/
- WebSocket connections working (if applicable)
- No certificate errors (HTTP only for now)

### Deliverables
- nginx site configuration
- Accessible web UI on port 80

---

## Phase 6: Verification and Testing
**Timeline**: 20-30 minutes
**Goal**: Comprehensive testing of all functionality

### Tasks
- [ ] Test web UI access from browser
- [ ] Test MCP server functionality
- [ ] Verify database connectivity
- [ ] Verify embedding service integration
- [ ] Test search functionality
- [ ] Test document ingestion
- [ ] Verify service restart behavior
- [ ] Check logs for errors
- [ ] Performance baseline test

### Success Criteria
- Web UI loads correctly
- Search returns results
- Document ingestion works
- No errors in logs
- Service survives restart
- Database queries working

### Deliverables
- Verified working deployment
- Baseline performance metrics
- Test results documented

---

## Phase 7: Documentation and Handoff
**Timeline**: 15-20 minutes
**Goal**: Document deployment for operations and maintenance

### Tasks
- [ ] Document all credentials (secure location)
- [ ] Document service management commands
- [ ] Document backup procedures
- [ ] Document monitoring setup
- [ ] Create operations runbook
- [ ] Update project README with deployment info

### Deliverables
- Operations guide
- Credential documentation
- Runbook for common tasks

---

## Total Estimated Time: 2-3 hours

## Critical Path
1. Database Setup (Phase 1) - MUST complete first
2. Server Preparation (Phase 2) - Required for deployment
3. Application Deployment (Phase 3) - Core deployment
4. Service Configuration (Phase 4) - For production stability
5. Reverse Proxy (Phase 5) - For port 80 access
6. Verification (Phase 6) - Ensure everything works

## Risk Mitigation
- Database backup before starting (if existing data)
- Keep old nginx config as backup
- Document all commands for rollback
- Test each phase before proceeding
- Keep systemd service logs for debugging

---
*Last Updated: 2025-11-08*
