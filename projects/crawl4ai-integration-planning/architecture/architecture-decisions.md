# Architecture Decision Records (ADRs)

## ADR-001: Microservice Architecture for Crawl4AI Integration

**Date**: 2025-11-08
**Status**: Accepted

### Context

Crawl4AI is a Python library, but Scrapegoat is a TypeScript/Node.js application. We need to decide how to integrate these two technologies.

**Options Considered**:
1. Python subprocess (spawn process per request or long-running)
2. HTTP-based microservice (Python FastAPI)
3. Docker container with REST API
4. Rewrite Crawl4AI in TypeScript (not practical)
5. Node.js bindings to Python (complex, fragile)

### Decision

We will use **Option 2: HTTP-based microservice** with Python FastAPI, deployed as a Docker container.

### Rationale

**Why Microservice**:
1. **Optional Dependency**: Service can be disabled without affecting core Scrapegoat functionality
2. **Clean Separation**: Clear boundary between TypeScript and Python code
3. **Independent Scaling**: Can scale Python service separately
4. **Development Independence**: Python and TypeScript teams can work separately
5. **Failure Isolation**: Python service crashes don't crash Node.js
6. **Technology Agnostic**: HTTP API is language-independent

**Why HTTP over subprocess**:
1. **Simpler lifecycle**: No process management complexity
2. **Better error handling**: HTTP status codes and structured errors
3. **Easier testing**: Can mock HTTP endpoints easily
4. **Better monitoring**: Standard HTTP metrics and health checks
5. **Familiar patterns**: REST API is well-understood

**Why FastAPI specifically**:
1. **Modern Python**: Async support matches Crawl4AI
2. **Auto documentation**: OpenAPI/Swagger built-in
3. **Type safety**: Pydantic models for request/response
4. **Performance**: Fast async framework
5. **Easy to deploy**: Simple Docker containerization

### Consequences

**Positive**:
- Clean architecture with clear boundaries
- Easy to disable or remove if needed
- Good developer experience (familiar patterns)
- Testable with standard HTTP tools
- Scalable and monitorable

**Negative**:
- Network overhead (though minimal for localhost)
- Additional service to deploy and monitor
- Complexity of polyglot architecture
- Requires Docker/container orchestration

**Mitigation**:
- Use connection pooling to minimize HTTP overhead
- Implement circuit breaker for resilience
- Clear documentation for deployment
- Graceful degradation if service unavailable

### Alternatives Considered

**Subprocess Approach**:
- Pros: No HTTP overhead, simpler deployment
- Cons: Process lifecycle complexity, harder error handling
- Rejected: Complexity outweighs benefits

**TypeScript Rewrite**:
- Pros: Pure TypeScript stack
- Cons: Massive effort, maintaining parity with Crawl4AI
- Rejected: Not feasible in reasonable timeline

### Related Decisions

- ADR-002: Communication protocol (HTTP/REST)
- ADR-003: Deployment strategy (Docker Compose)

---

## ADR-002: REST API Communication Protocol

**Date**: 2025-11-08
**Status**: Accepted

### Context

The Node.js application needs to communicate with the Python microservice. We need to define the communication protocol.

**Options Considered**:
1. REST API (JSON over HTTP)
2. gRPC (Protocol Buffers)
3. GraphQL
4. JSON-RPC
5. Message Queue (RabbitMQ, Redis)

### Decision

We will use **REST API with JSON** over HTTP.

### Rationale

**Why REST**:
1. **Simplicity**: Straightforward request/response model
2. **Tooling**: Excellent debugging tools (curl, Postman, browser)
3. **Familiarity**: Team knows REST well
4. **HTTP ecosystem**: Leverage standard HTTP features (caching, proxies)
5. **No new dependencies**: Standard HTTP libraries

**Why JSON**:
1. **Human readable**: Easy to debug
2. **Native support**: Both Node.js and Python have excellent JSON support
3. **Flexible**: Schema evolution without breaking changes
4. **Tooling**: Great editor support

**API Design Principles**:
- Simple endpoints: `/crawl`, `/health`
- Structured errors with HTTP status codes
- Request/response validation with schemas
- Idempotent operations where possible

### Consequences

**Positive**:
- Easy to implement and test
- Great debugging experience
- No learning curve for team
- Wide tool support

**Negative**:
- Slightly larger payloads than binary protocols
- No built-in streaming (not needed for our use case)
- No strong typing across language boundary

**Mitigation**:
- TypeScript interfaces mirror Python Pydantic models
- API versioning strategy for future changes
- Request/response validation on both sides

### Alternatives Considered

**gRPC**:
- Pros: Type safety, performance, streaming
- Cons: Complexity, debugging difficulty, overkill for simple API
- Rejected: Too complex for our needs

**Message Queue**:
- Pros: Async, decoupled, scalable
- Cons: Complexity, requires additional infrastructure
- Rejected: Synchronous request/response is simpler and sufficient

### Related Decisions

- ADR-001: Microservice architecture
- ADR-004: Error handling strategy

---

## ADR-003: Docker Compose Deployment Strategy

**Date**: 2025-11-08
**Status**: Accepted

### Context

We need to deploy the Python microservice alongside existing Scrapegoat infrastructure (PostgreSQL, Infinity server).

**Options Considered**:
1. Docker Compose (orchestrate all services)
2. Kubernetes (full orchestration)
3. Manual deployment (systemd services)
4. Separate deployment (Python service on different machine)

### Decision

We will use **Docker Compose** to orchestrate all services including the new Crawl4AI service.

### Rationale

**Why Docker Compose**:
1. **Already in use**: Scrapegoat already uses Docker for PostgreSQL and Infinity
2. **Simple**: Easy to understand and maintain
3. **Local development**: Same setup for dev and production
4. **Service dependencies**: Can express dependencies between services
5. **Environment management**: Easy environment variable configuration

**Deployment Architecture**:
```yaml
services:
  scrapegoat:      # Node.js application
  postgres:        # PostgreSQL database
  infinity:        # Embedding server
  crawl4ai:        # NEW: Python service
```

**Key Design Decisions**:
- crawl4ai service is optional (can be disabled)
- Internal Docker network for service-to-service communication
- Health checks for all services
- Restart policies for reliability
- Volume mounts for persistent data

### Consequences

**Positive**:
- Consistent with existing deployment
- Easy to add/remove service
- Good local development experience
- Simple to understand and maintain

**Negative**:
- Docker Compose limitations for production scale
- All services on one machine (for now)
- Not cloud-native (Kubernetes would be)

**Mitigation**:
- Document migration path to Kubernetes if needed
- Design service to be stateless and scalable
- Use standard container practices

### Alternatives Considered

**Kubernetes**:
- Pros: Production-grade, scalable, cloud-native
- Cons: Overkill for current scale, complexity
- Rejected: YAGNI - can migrate later if needed

**Manual Deployment**:
- Pros: No Docker dependency
- Cons: Inconsistent environments, manual management
- Rejected: Docker is already required

### Related Decisions

- ADR-001: Microservice architecture
- ADR-008: Optional service design

---

## ADR-004: Error Handling and Circuit Breaker Pattern

**Date**: 2025-11-08
**Status**: Accepted

### Context

The Python microservice can fail (crashes, network issues, timeouts). We need a strategy to handle failures gracefully.

**Options Considered**:
1. Simple retry logic
2. Circuit breaker pattern
3. Fail fast (no retry)
4. Always fallback to Playwright

### Decision

We will implement **circuit breaker pattern** with configurable retry logic and fallback to Playwright.

### Rationale

**Circuit Breaker Benefits**:
1. **Prevent cascading failures**: Stop trying when service is down
2. **Fast failure**: Don't wait for timeout on every request
3. **Auto-recovery**: Periodically test if service is back up
4. **System stability**: Protect both services from overload

**Implementation Strategy**:
```
States:
- CLOSED: Normal operation, requests go through
- OPEN: Service is down, fail fast
- HALF_OPEN: Testing if service recovered

Thresholds:
- Open circuit after 3 consecutive failures
- Half-open after 30 seconds
- Close after 2 successful requests in half-open
```

**Retry Logic**:
- 2 retries with exponential backoff (100ms, 200ms)
- Only retry on network errors, not on 4xx responses
- Respect timeout configuration

**Fallback Strategy**:
- If circuit is open, fall back to Playwright mode
- Log warning for monitoring
- User gets content (from fallback) not error

### Consequences

**Positive**:
- System remains stable when Python service fails
- Better user experience (fallback provides content)
- Prevents wasting resources on doomed requests
- Clear failure modes

**Negative**:
- Additional complexity in client code
- May fallback unnecessarily if threshold too low
- Need good monitoring to detect circuit opens

**Mitigation**:
- Use battle-tested library (opossum for Node.js)
- Make thresholds configurable
- Log circuit state changes
- Metrics on circuit breaker state

### Alternatives Considered

**Simple Retry**:
- Pros: Simpler implementation
- Cons: Keeps trying when service is down
- Rejected: Doesn't handle sustained failures well

**Fail Fast**:
- Pros: Simplest, clear errors
- Cons: Poor user experience
- Rejected: Want graceful degradation

### Related Decisions

- ADR-001: Microservice architecture
- ADR-007: Graceful degradation strategy

---

## ADR-005: Crawl4AI as Fetcher Strategy (Not New Pipeline)

**Date**: 2025-11-08
**Status**: Accepted

### Context

We need to decide where Crawl4AI fits in the existing Scrapegoat architecture: as a fetcher strategy or as a complete new pipeline.

**Options Considered**:
1. Crawl4AI as fetcher (returns markdown to existing pipeline)
2. Crawl4AI as complete pipeline (handles fetch + processing)
3. Hybrid (Crawl4AI has option for either mode)

### Decision

Crawl4AI will be a **fetcher strategy** that returns markdown content to the existing MarkdownPipeline.

### Rationale

**Why Fetcher Strategy**:
1. **Reuse existing pipelines**: Chunking, embedding, storage already work
2. **Consistency**: Same data flow as Fetch/Playwright modes
3. **Simplicity**: Don't duplicate pipeline logic
4. **Testing**: Leverage existing pipeline tests
5. **Maintenance**: One pipeline to maintain, not multiple

**Integration Point**:
```
URL → Crawl4AIFetcher → Markdown → MarkdownPipeline → Chunks → Embeddings → PostgreSQL
```

vs existing:
```
URL → PlaywrightFetcher → HTML → HtmlPipeline → Markdown → Chunks → ...
```

**Key Insight**: Crawl4AI already produces high-quality markdown, which is what we want. No need to process HTML when we get markdown directly.

### Consequences

**Positive**:
- Clean separation of concerns
- Leverage existing, tested pipeline code
- Easier to maintain
- Consistent behavior across modes

**Negative**:
- Can't leverage Crawl4AI's semantic chunking (for now)
- May miss some Crawl4AI-specific features
- Markdown-only output (no raw HTML)

**Future Enhancements**:
- Could add Crawl4AI-specific pipeline later if needed
- Could expose semantic chunking as an option
- Could add structured extraction as separate mode

### Alternatives Considered

**Complete Pipeline**:
- Pros: Full control, use all Crawl4AI features
- Cons: Duplicate logic, harder to maintain
- Rejected: Unnecessary complexity for MVP

### Related Decisions

- ADR-001: Microservice architecture
- ADR-006: ScrapeMode enum extension

---

## ADR-006: ScrapeMode Enum Extension

**Date**: 2025-11-08
**Status**: Accepted

### Context

We need to add Crawl4AI as a new scraping mode. What should we call it and how should it relate to existing modes?

**Options Considered**:
1. `ScrapeMode.Crawl4AI` (explicit technology name)
2. `ScrapeMode.Advanced` (feature-based name)
3. `ScrapeMode.AI` (capability-based name)
4. `ScrapeMode.Premium` (tier-based name)
5. Update `ScrapeMode.Auto` to use Crawl4AI

### Decision

Add `ScrapeMode.Crawl4AI` as explicit mode. Keep `Auto` unchanged for now (may update in future).

### Rationale

**Why Explicit Name**:
1. **Clarity**: Users know exactly what they're getting
2. **Transparency**: Clear which technology is being used
3. **Debugging**: Easier to troubleshoot mode-specific issues
4. **Documentation**: Clear reference in docs

**Why Not Change Auto**:
1. **Risk**: Changing Auto changes behavior for existing users
2. **Testing**: Need time to validate Crawl4AI stability
3. **Gradual rollout**: Let users opt-in first
4. **Future option**: Can make Auto smarter later

**Enum Structure**:
```typescript
enum ScrapeMode {
  Fetch = 'fetch',       // Existing: Simple HTTP + DOM
  Playwright = 'playwright', // Existing: Headless browser
  Crawl4AI = 'crawl4ai',    // NEW: AI-optimized crawler
  Auto = 'auto'          // Existing: Smart selection (currently → Playwright)
}
```

### Consequences

**Positive**:
- No confusion about what mode does
- Backward compatible (Auto unchanged)
- Clear in logs and metrics
- Easy to add more modes later

**Negative**:
- Mode name ties us to Crawl4AI implementation
- If we switch to different tech, name is misleading
- Users have to know about Crawl4AI

**Future Considerations**:
- Could alias `Advanced` → `Crawl4AI` later
- Could make `Auto` intelligent (try Crawl4AI, fallback Playwright)
- Could add `ScrapeMode.Best` that always picks optimal

### Alternatives Considered

**ScrapeMode.Advanced**:
- Pros: Implementation agnostic
- Cons: Unclear what "advanced" means
- Rejected: Too vague

**Update Auto Mode**:
- Pros: Users get better quality automatically
- Cons: Breaking change, risky
- Rejected: Too risky for initial release

### Related Decisions

- ADR-005: Crawl4AI as fetcher strategy
- ADR-007: Graceful degradation strategy

---

## ADR-007: Graceful Degradation Strategy

**Date**: 2025-11-08
**Status**: Accepted

### Context

When users select `ScrapeMode.Crawl4AI` but the service is unavailable, what should happen?

**Options Considered**:
1. Fail with error (fail fast)
2. Always fallback to Playwright (transparent fallback)
3. Configurable fallback (let user decide)
4. Queue request until service available

### Decision

Use **configurable fallback** with sensible defaults:
- Explicit `Crawl4AI` mode: Error by default, optional fallback
- `Auto` mode (future): Transparent fallback to Playwright

### Rationale

**Why Configurable**:
1. **Different needs**: Some users want guarantees, others want resilience
2. **Clear expectations**: User knows what they're getting
3. **Debugging**: Errors help identify service issues
4. **Flexibility**: Can adapt to different scenarios

**Default Behavior**:
```typescript
// Explicit mode selection
mode: 'crawl4ai', fallback: false → Error if service down
mode: 'crawl4ai', fallback: true  → Use Playwright if service down

// Auto mode (future)
mode: 'auto' → Always tries best available (Crawl4AI → Playwright → Fetch)
```

**Configuration**:
```typescript
interface Crawl4AIOptions {
  fallbackToPlaywright?: boolean; // Default: false for explicit, true for auto
  fallbackOnTimeout?: boolean;    // Default: true
  fallbackOnError?: boolean;      // Default: false (don't hide errors)
}
```

### Consequences

**Positive**:
- Clear failure modes
- User controls behavior
- Easy to debug (know which mode was used)
- Supports both strict and resilient scenarios

**Negative**:
- More configuration options
- Need to document fallback behavior
- Logs must clearly indicate fallback occurred

**Implementation**:
- Log warning when fallback occurs
- Include fallback mode in response metadata
- Metrics track fallback frequency
- Circuit breaker coordinates with fallback logic

### Alternatives Considered

**Always Fallback**:
- Pros: Maximum resilience
- Cons: Hides service issues, unclear which mode used
- Rejected: Users should know what they're getting

**Always Fail**:
- Pros: Clear, predictable
- Cons: Poor user experience, brittle
- Rejected: Too strict for default

### Related Decisions

- ADR-004: Circuit breaker pattern
- ADR-006: ScrapeMode enum extension

---

## ADR-008: Optional Service Design Pattern

**Date**: 2025-11-08
**Status**: Accepted

### Context

Crawl4AI requires Python, which is a new dependency. Some users may not want or be able to install Python. We need the integration to be optional.

**Options Considered**:
1. Required dependency (all users must have Python)
2. Optional service (feature flag controlled)
3. Plugin architecture (completely separate package)
4. Runtime detection (check if available, adapt)

### Decision

Use **optional service with feature flag** controlled by `CRAWL4AI_ENABLED` environment variable.

### Rationale

**Design Principles**:
1. **Graceful degradation**: Works without Python/service
2. **Clear configuration**: Single environment variable
3. **No code changes**: Same codebase, different deployment
4. **Clear errors**: Tell user why Crawl4AI unavailable

**Implementation**:
```typescript
// Check if enabled
const isCrawl4AIEnabled = process.env.CRAWL4AI_ENABLED !== 'false';

// Check if available
async function isCrawl4AIAvailable(): Promise<boolean> {
  if (!isCrawl4AIEnabled) return false;
  return await healthCheck(); // Ping service
}

// Mode validation
if (mode === 'crawl4ai' && !isCrawl4AIAvailable()) {
  throw new Error('Crawl4AI mode requested but service unavailable. Set CRAWL4AI_ENABLED=true and start service.');
}
```

**Docker Deployment**:
```yaml
# Service only starts if enabled
crawl4ai:
  image: scrapegoat-crawl4ai
  profiles: ["crawl4ai"]  # Optional profile
  # OR
  condition: ${CRAWL4AI_ENABLED:-false}
```

### Consequences

**Positive**:
- Zero impact if disabled
- Clear opt-in mechanism
- Easy to enable/disable
- No Python required for core functionality

**Negative**:
- Two deployment configurations to maintain
- Documentation must cover both scenarios
- Testing needs to cover enabled/disabled cases

**Mitigation**:
- Default to disabled (safe default)
- Clear documentation for enabling
- CI tests both configurations
- Good error messages guide users

### Alternatives Considered

**Required Dependency**:
- Pros: Simpler (one configuration)
- Cons: Forces Python on all users
- Rejected: Too restrictive

**Plugin Architecture**:
- Pros: Complete separation
- Cons: Complex, harder to maintain
- Rejected: Over-engineering for MVP

### Related Decisions

- ADR-001: Microservice architecture
- ADR-007: Graceful degradation

---

## Summary Table

| ADR | Title | Status | Impact |
|-----|-------|--------|--------|
| 001 | Microservice Architecture | Accepted | High - Foundation |
| 002 | REST API Protocol | Accepted | Medium - Communication |
| 003 | Docker Compose Deployment | Accepted | Medium - Deployment |
| 004 | Circuit Breaker Pattern | Accepted | High - Reliability |
| 005 | Fetcher Strategy | Accepted | High - Integration |
| 006 | ScrapeMode Enum | Accepted | Medium - API |
| 007 | Graceful Degradation | Accepted | High - UX |
| 008 | Optional Service | Accepted | High - Adoption |

---
*Last Updated: 2025-11-08*
