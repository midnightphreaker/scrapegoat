# Architecture Decision Records (ADRs)

## ADR-001: Complete SQLite Removal
**Date**: 2025-11-08
**Status**: Accepted

### Context
Original scrapegoat uses SQLite + sqlite-vec. We're creating a fork for PostgreSQL + pgvector.

### Decision
**Complete removal of SQLite code and dependencies. No dual-database support, no migration tooling.**

### Rationale
1. **Simplified Codebase**: Single database implementation easier to maintain
2. **Clear Positioning**: Fork serves different user segment (enterprise vs. embedded)
3. **No Abstraction Overhead**: Direct PostgreSQL implementation more performant
4. **Focused Development**: All optimization efforts benefit single database
5. **Clean Break**: Users make conscious choice between original and fork

### Consequences
**Positive**:
- Simpler architecture (no abstraction layer)
- Better performance (no abstraction overhead)
- Cleaner codebase
- Focused feature set

**Negative**:
- No migration path from original
- Higher barrier to entry (PostgreSQL setup required)
- Not drop-in replacement

### Alternatives Considered
1. **Dual-database support**: Rejected due to complexity and maintenance burden
2. **Migration tooling**: Rejected to reduce scope and maintain focus

---

## ADR-002: User-Provided PostgreSQL
**Date**: 2025-11-08
**Status**: Accepted

### Context
Need to decide if we bundle PostgreSQL or require users to provide it.

### Decision
**PostgreSQL deployment is OUT OF SCOPE. Users provide their own PostgreSQL instance. Application initializes schema and extensions.**

### Rationale
1. **Production Reality**: Enterprise users have existing PostgreSQL infrastructure
2. **Managed Services**: Users prefer AWS RDS, GCP Cloud SQL, Azure Database
3. **Reduced Complexity**: Don't manage database lifecycle
4. **Flexibility**: Users choose PostgreSQL configuration, version, resources
5. **Security**: Users control database access, backups, replication

### Consequences
**Positive**:
- Integrates with existing infrastructure
- Supports managed database services
- Users control database configuration
- Smaller application footprint
- No database orchestration complexity

**Negative**:
- Higher setup barrier (PostgreSQL required)
- Users must manage database separately
- Potential pgvector extension installation issues

### Implementation
- Application validates connection at startup
- Application creates pgvector extension if missing (requires permissions)
- Application runs schema migrations automatically
- Clear error messages if prerequisites missing

---

## ADR-003: pgvector HNSW as Default Index
**Date**: 2025-11-08
**Status**: Accepted

### Context
pgvector supports multiple index types: HNSW, IVFFlat, or no index (exact search).

### Decision
**Use HNSW as default vector index type. Provide IVFFlat as documented alternative.**

### Rationale
1. **Performance**: HNSW provides 5-20x faster queries than IVFFlat
2. **Recall**: HNSW achieves >95% recall with appropriate parameters
3. **Production-Ready**: HNSW mature and battle-tested in production
4. **Scalability**: Performs well at large scale (1M+ vectors)
5. **Fork Positioning**: Enterprise users prioritize query performance

### Consequences
**Positive**:
- Best query performance
- Excellent recall
- Scalable to millions of vectors
- Industry-standard approach

**Negative**:
- Slower index build time
- Higher memory usage
- May be overkill for small datasets (<10K docs)

### Configuration
```sql
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Alternatives Considered
1. **IVFFlat default**: Faster build but slower queries - rejected for enterprise focus
2. **Exact search**: Too slow for production - rejected
3. **Dynamic selection**: Too complex - keep simple, document alternatives

---

## ADR-004: node-postgres (pg) as Client Library
**Date**: 2025-11-08
**Status**: Accepted

### Context
Need PostgreSQL client library for Node.js. Main options: node-postgres (pg), postgres.js.

### Decision
**Use node-postgres (pg) as PostgreSQL client library.**

### Rationale
1. **Industry Standard**: 13+ years, battle-tested, de facto standard
2. **Stability**: Extremely stable, rare breaking changes
3. **Ecosystem**: Extensive third-party integrations
4. **Documentation**: Comprehensive docs and community resources
5. **Enterprise Confidence**: Proven in production at scale

### Consequences
**Positive**:
- Reliable, proven stability
- Excellent documentation
- Large community
- Enterprise-friendly

**Negative**:
- Slightly more verbose API than postgres.js
- Callback-based legacy (though promises supported)

### Alternatives Considered
1. **postgres.js**: Modern API, faster benchmarks - rejected for lower adoption and maturity
2. **TypeORM/Prisma**: Too heavy, not needed - rejected for simplicity

---

## ADR-005: Custom SQL Migration System
**Date**: 2025-11-08
**Status**: Accepted

### Context
Need database schema migration strategy.

### Decision
**Implement custom SQL migration system with version tracking in database.**

### Rationale
1. **Simplicity**: No external dependencies, pure SQL
2. **Control**: Full control over migration execution
3. **Transparency**: Easy to review migrations in version control
4. **PostgreSQL-Specific**: Can use PostgreSQL-specific features without ORM constraints
5. **Idempotent**: Migrations include existence checks (IF NOT EXISTS)

### Consequences
**Positive**:
- Simple implementation
- No dependencies
- Full SQL control
- Easy to understand

**Negative**:
- Manual migration writing
- No automatic rollback (manual rollback migrations needed)
- Basic compared to sophisticated migration tools

### Implementation
```
db/postgresql/migrations/
├── 001_initial_schema.sql
├── 002_gin_indexes.sql
├── 003_hnsw_indexes.sql
```

Migration tracking table:
```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  version INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Alternatives Considered
1. **Knex.js**: Too heavy - rejected
2. **TypeORM migrations**: Couples to ORM - rejected
3. **Flyway/Liquibase**: Java-based, overkill - rejected

---

## ADR-006: Single Application Container
**Date**: 2025-11-08
**Status**: Accepted

### Context
Deployment architecture: single container vs. microservices.

### Decision
**Default deployment: single container with all services (MCP, Web, Worker). Document multi-container for scaling.**

### Rationale
1. **Simplicity**: Easier to deploy and manage
2. **Sufficient for Most**: Single container handles 50+ users
3. **Lower Overhead**: No inter-service communication
4. **Standard Pattern**: Original project uses unified server
5. **Easy Scaling**: Can scale horizontally (multiple identical containers)

### Consequences
**Positive**:
- Simple deployment
- Lower latency (no network hops)
- Easier to debug
- Resource efficient

**Negative**:
- Can't scale components independently
- All services restart together
- Mixed concerns in single process

### Scaling Path
Document multi-container deployment for:
- High job volume (separate worker containers)
- High query volume (separate MCP/Web containers)
- Kubernetes deployments

### Alternatives Considered
1. **Microservices by default**: Over-engineering for typical use - rejected
2. **Separate web/API/worker**: More complexity without proportional benefit - rejected

---

## ADR-007: Automatic Database Initialization
**Date**: 2025-11-08
**Status**: Accepted

### Context
How to handle initial database setup and schema changes.

### Decision
**Automatic database initialization on application startup: extension creation, schema migrations, index creation.**

### Rationale
1. **Zero-Config Experience**: Application "just works" with DATABASE_URL
2. **Safe Idempotency**: Migrations track what's applied, safe to re-run
3. **Version Control**: Migrations in code ensure consistency
4. **No Manual Steps**: Reduces deployment errors
5. **Fail Fast**: Clear errors if prerequisites missing

### Consequences
**Positive**:
- Simple deployment
- No manual SQL scripts to run
- Consistent schema across environments
- Easy updates

**Negative**:
- Requires database permissions (CREATE EXTENSION, CREATE TABLE)
- Startup delay on first run (creating indexes)
- Migration failures stop application start

### Implementation
Startup sequence:
1. Verify connection
2. Create pgvector extension (if needed)
3. Create migrations table (if needed)
4. Run pending migrations sequentially
5. Validate schema
6. Start serving requests

### Error Handling
- Clear error if pgvector installation fails (missing permissions or extension)
- Migration failures log which migration failed
- Rollback on error (transactions)

### Alternatives Considered
1. **Manual schema setup**: More error-prone - rejected
2. **External migration tool**: Added complexity - rejected
3. **No migrations**: Makes updates difficult - rejected

---

## ADR-008: Preserve Original MCP Tools Interface
**Date**: 2025-11-08
**Status**: Accepted

### Context
MCP tools are the primary interface for AI assistants.

### Decision
**Maintain identical MCP tool interface to original project. Only change: internal implementation uses PostgreSQL.**

### Rationale
1. **Drop-in Compatibility**: Existing MCP clients work without changes
2. **User Expectations**: Users familiar with original tools
3. **Documentation Reuse**: Original tool docs mostly applicable
4. **Migration Path**: Users can switch implementations easily

### Consequences
**Positive**:
- Familiar interface for existing users
- Compatible with existing client configurations
- Can reference original documentation
- Easier evaluation and comparison

**Negative**:
- Constrained by original interface design
- Can't add breaking changes without version bump

### Tools to Maintain
- `search_docs`: Semantic search
- `scrape_docs`: Queue scraping job
- `list_libraries`: List indexed libraries
- `find_version`: Resolve version patterns
- `remove_library`: Delete library
- `list_jobs`: View job queue
- `cancel_job`: Cancel job
- `get_job_info`: Job details
- `fetch_url`: URL to markdown

---

*Last Updated: 2025-11-08*
