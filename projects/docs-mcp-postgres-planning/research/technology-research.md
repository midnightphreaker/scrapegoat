# Technology Research

## Database: PostgreSQL + pgvector

### PostgreSQL
**Version**: 14, 15, 16
**License**: PostgreSQL License (permissive)
**Maturity**: 35+ years, extremely mature

**Pros**:
- Industry-standard relational database
- Excellent concurrent access support
- ACID compliance, robust transactions
- Advanced indexing (B-tree, GIN, GIST, HNSW)
- Full-text search (tsvector/tsquery) built-in
- JSON/JSONB support for metadata
- Proven scalability (millions of rows)
- Extensive tooling ecosystem
- Managed services available (AWS RDS, GCP Cloud SQL, Azure)
- Strong community and documentation

**Cons**:
- Requires separate server process (not embedded)
- More complex setup than SQLite
- Requires infrastructure/DevOps knowledge
- Higher resource requirements
- Connection management complexity

**Decision**: Chosen for production-grade features, scalability, and concurrent access

### pgvector Extension
**Version**: 0.5.0+
**License**: PostgreSQL License
**Maturity**: 2+ years, rapidly maturing

**Features**:
- Native vector storage as `VECTOR(dimensions)` type
- Multiple distance functions: cosine (<=>), L2 (<->), inner product (<#>)
- HNSW index support for fast approximate nearest neighbor search
- IVFFlat index for memory-constrained environments
- Exact search support (without indexes)
- Integration with PostgreSQL query planner
- SIMD optimization for vector operations

**Performance Characteristics**:
- HNSW: High query performance (5-10x faster than IVFFlat), slower index build
- IVFFlat: Moderate query performance, faster index build, lower memory
- Exact: Slow but accurate, no index needed

**HNSW Parameters**:
- `m`: Max connections per layer (default: 16, higher = better recall, more memory)
- `ef_construction`: Index build quality (default: 64, higher = better index, slower build)
- `ef_search`: Query time quality (runtime parameter, higher = better recall, slower queries)

**Comparison to Alternatives**:
- **vs Pinecone/Weaviate**: Integrated with relational DB, no separate service, lower cost
- **vs Qdrant/Milvus**: Simpler deployment, leverages existing PostgreSQL knowledge
- **vs sqlite-vec**: Better performance, more mature indexing, better concurrent access

**Decision**: Chosen for performance, PostgreSQL integration, and production readiness

## PostgreSQL Client Libraries

### Option 1: node-postgres (pg)
**Version**: 8.11+
**License**: MIT
**Maturity**: 13+ years

**Pros**:
- Industry standard for Node.js
- Battle-tested, extremely stable
- Connection pooling built-in
- Prepared statements
- Transaction support
- Streaming support for large results
- Well-documented
- Active maintenance

**Cons**:
- Callback-based API (promisify required, but supports promises)
- Slightly verbose API

**Code Example**:
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
```

**Decision**: Chosen (industry standard, stable, feature-complete)

### Option 2: postgres (postgres.js)
**Version**: 3.4+
**License**: Unlicense / MIT
**Maturity**: 4+ years

**Pros**:
- Modern async/await API
- Faster than node-postgres in some benchmarks
- Tagged template literals for queries
- Built-in connection pooling
- Automatic type conversion
- Clean, intuitive API

**Cons**:
- Newer, less battle-tested than pg
- Smaller community
- Less documentation
- Fewer third-party integrations

**Code Example**:
```typescript
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

const result = await sql`SELECT * FROM documents WHERE id = ${id}`;
```

**Alternative**: Could be considered for cleaner API, but pg is safer choice

### Decision: node-postgres (pg)
**Rationale**: Industry standard, proven reliability, extensive ecosystem, better for enterprise users

## Vector Search Performance

### Indexing Strategies

#### HNSW (Hierarchical Navigable Small World)
**Best For**: Production deployments prioritizing query performance

**Characteristics**:
- Query performance: Excellent (5-20x faster than IVFFlat)
- Index build time: Slow (but parallelizable)
- Memory usage: High (stores graph structure)
- Recall: Excellent (>95% at ef_search=64)

**Configuration**:
```sql
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Decision**: Default for production deployments

#### IVFFlat (Inverted File with Flat Vectors)
**Best For**: Memory-constrained environments, faster index build

**Characteristics**:
- Query performance: Good (acceptable for most use cases)
- Index build time: Fast
- Memory usage: Moderate
- Recall: Good (>90% with appropriate lists parameter)

**Configuration**:
```sql
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- rows / 1000 as starting point
```

**Alternative**: Useful for development or constrained resources

### Performance Benchmarks (Estimated)

| Dataset Size | Index Type | Build Time | Query Time (p95) | Recall |
|--------------|------------|------------|------------------|--------|
| 10K vectors  | HNSW       | 30s        | 5ms              | 98%    |
| 10K vectors  | IVFFlat    | 5s         | 15ms             | 95%    |
| 100K vectors | HNSW       | 5min       | 20ms             | 97%    |
| 100K vectors | IVFFlat    | 30s        | 80ms             | 92%    |
| 1M vectors   | HNSW       | 45min      | 100ms            | 96%    |
| 1M vectors   | IVFFlat    | 5min       | 400ms            | 90%    |

**Decision**: HNSW as default, IVFFlat as fallback option

## Full-Text Search

### PostgreSQL tsvector/tsquery
**Built-in**: Yes
**Maturity**: 20+ years

**Features**:
- Stemming (reducing words to root form)
- Stop words removal
- Multiple language support
- Phrase matching
- Prefix matching
- Ranking functions (ts_rank, ts_rank_cd)
- GIN index support for performance

**Configuration**:
```sql
-- Column with tsvector
ALTER TABLE documents ADD COLUMN content_tsv tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- GIN index
CREATE INDEX ON documents USING gin(content_tsv);

-- Query
SELECT * FROM documents
WHERE content_tsv @@ to_tsquery('english', 'react & hooks');
```

**Performance**:
- Query time: <50ms for 100K documents (with GIN index)
- Index size: ~30-50% of text data size
- Memory efficient

**Decision**: Use built-in FTS (no external dependencies needed)

## Embedding Providers (Unchanged from Original)

### OpenAI
- **Model**: text-embedding-3-small (1536 dims), text-embedding-3-large (3072 dims)
- **Cost**: $0.02/$0.13 per 1M tokens
- **Performance**: Fast, high quality
- **Decision**: Default recommendation

### Google Gemini/Vertex AI
- **Model**: text-embedding-004 (768 dims)
- **Cost**: Competitive
- **Performance**: Good quality
- **Decision**: Good alternative

### Local Options (Ollama, LM Studio)
- **Models**: nomic-embed-text, mxbai-embed-large
- **Cost**: Free (local compute)
- **Performance**: Varies by hardware
- **Decision**: Development and privacy-focused deployments

**No changes needed**: Embedding generation logic remains the same

## Scraping and Processing (Unchanged from Original)

### Playwright
- **Version**: 1.52+
- **Decision**: Keep (works well, no changes needed)

### Cheerio
- **Version**: 1.1+
- **Decision**: Keep (HTML parsing)

### Turndown
- **Version**: 7.2+
- **Decision**: Keep (HTML to Markdown)

### Tree-sitter
- **Version**: 0.21+
- **Decision**: Keep (code parsing)

## Connection Pooling

### node-postgres Pool
**Built-in**: Yes

**Configuration**:
```typescript
const pool = new Pool({
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail after 5s if no connection
});
```

**Best Practices**:
- Pool size = (CPU cores * 2) + effective_spindle_count
- For most deployments: 10-20 connections sufficient
- Monitor pool utilization, adjust based on metrics

**Alternative: PgBouncer**
- External connection pooler
- Useful for 100+ application instances
- Not needed for initial deployment

**Decision**: Start with built-in pooling, document PgBouncer for scale

## Migration Framework

### Custom Migration System
**Approach**: SQL migration files with version tracking

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  version INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Migration Files**:
```
db/postgresql/migrations/
├── 001_initial_schema.sql
├── 002_add_gin_indexes.sql
├── 003_add_hnsw_indexes.sql
└── 004_add_telemetry.sql
```

**Advantages**:
- Simple, no external dependencies
- Full SQL control
- Easy to review in version control
- Idempotent (can re-run safely)

**Alternative**: Knex.js, TypeORM migrations
- More features but added complexity
- Not needed for this use case

**Decision**: Custom SQL migrations (simpler, sufficient)

## Deployment

### Docker
**Base Image**: node:22-alpine
**PostgreSQL Image**: pgvector/pgvector:pg16

**Advantages**:
- Lightweight (Alpine)
- Official pgvector support
- Single docker-compose file deployment

**Decision**: Primary deployment method

### Docker Compose
**Services**:
- PostgreSQL (with pgvector)
- Application (MCP server + web + worker)

**Alternative**: Separate services for scaling
- Worker service (separate container)
- MCP server service
- Web UI service

**Decision**: Single application container initially, document multi-container for scale

---

*Last Updated: 2025-11-08*
