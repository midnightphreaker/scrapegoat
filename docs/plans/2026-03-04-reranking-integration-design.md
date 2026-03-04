# ScrapeGoat Reranking Integration Design

**Date:** March 4, 2026  
**Status:** Approved  
**Author:** AI Assistant  
**Approver:** Master

---

## Executive Summary

Add optional reranking support to ScrapeGoat to improve search result relevance. Reranking is **disabled by default** and completely optional - users can continue using ScrapeGoat with embeddings only if desired.

**Key Design Principles:**
- **Zero impact when disabled** - No performance cost, no configuration required
- **Graceful degradation** - Service failures fall back to original behavior
- **Follow existing patterns** - Matches IMAGE_EMBEDDING_ENABLED architecture

**Expected Impact:**
- ✅ +15-35% search accuracy for complex queries
- ✅ 200-400ms latency when enabled (acceptable for accuracy gain)
- ✅ Optional - can be completely ignored by users who don't need it

---

## Problem Statement

ScrapeGoat currently uses **hybrid search** (vector similarity + full-text search) with Reciprocal Rank Fusion (RRF) to combine results. This provides good baseline accuracy (~70-80% relevance).

**Limitations of current approach:**
1. **Bi-encoder approximation**: Embeddings are computed independently for query and documents, missing nuanced query-document interactions
2. **Semantic ambiguity**: "Rust programming" vs "Rust oxidation" get similar embeddings but vastly different relevance for programming queries
3. **Domain-specific terminology**: Medical, legal, technical docs need context-aware relevance scoring

**Solution: Cross-encoder reranking**

A reranker sees **both query and document together**, enabling it to:
- Disambiguate polysemous words (bank: financial vs river)
- Understand domain-specific relationships (async → futures → tokio)
- Score semantic relevance more accurately than vector similarity alone

---

## Design Overview

### Architecture

```
DocumentRetrieverService.search(query, limit=10)
    │
    ├─ rerankerService.isReady()?
    │   ├─ YES: retrieve(limit × 3) → rerank → return top N
    │   └─ NO:  retrieve(limit) → return as-is
    │
    ↓
SearchResult[]
```

### Components

| Component | File | Purpose | Lines |
|-----------|------|---------|-------|
| **RerankerService** | `src/store/RerankerService.ts` | Call external reranker API, handle errors | ~150 |
| **DocumentRetrieverService** | `src/store/DocumentRetrieverService.ts` | Modified to use reranker | ~30 changes |
| **Config** | `src/utils/config.ts` | Add reranker configuration | ~20 changes |
| **Tests** | `src/store/RerankerService.test.ts` | Unit + integration tests | ~200 |

**Total:** ~400 lines of code + tests

---

## Configuration

### Environment Variables

```bash
# OPTIONAL: Reranking Service
# RERANK_ENABLED=false                    # Enable reranking (default: false)
# RERANK_API_BASE=                        # Reranker endpoint URL
# RERANK_MODEL=                           # Reranker model name
# RERANK_TIMEOUT=5000                     # Timeout in ms (default: 5000)
```

### Configuration Interface

```typescript
interface RerankerConfig {
  enabled: boolean;
  baseURL?: string;
  model?: string;
  timeout: number;
}

// Loading
const config: RerankerConfig = {
  enabled: process.env.RERANK_ENABLED === "true",
  baseURL: process.env.RERANK_API_BASE,
  model: process.env.RERANK_MODEL,
  timeout: Number.parseInt(process.env.RERANK_TIMEOUT || "5000", 10),
};
```

### Validation

```typescript
if (config.reranker.enabled) {
  if (!config.reranker.baseURL) {
    errors.push("RERANK_API_BASE is required when RERANK_ENABLED=true");
  }
  if (!config.reranker.model) {
    errors.push("RERANK_MODEL is required when RERANK_ENABLED=true");
  }
  if (config.reranker.timeout < 1000 || config.reranker.timeout > 30000) {
    errors.push("RERANK_TIMEOUT must be between 1000 and 30000ms");
  }
}
```

---

## API Specification

### Reranker API Format

**Standard:** Jina AI format (becoming industry standard, compatible with Cohere/vLLM)

**Endpoint:** `POST {RERANK_API_BASE}/rerank`

**Request:**
```json
{
  "model": "qwen3-text-reranker",
  "query": "How to handle errors in async Rust?",
  "documents": [
    "Error handling in async Rust requires...",
    "Python exceptions use try-except blocks...",
    "Rust ownership prevents data races..."
  ],
  "top_n": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "index": 0,
      "relevance_score": 0.89,
      "document": {
        "text": "Error handling in async Rust requires..."
      }
    },
    {
      "index": 2,
      "relevance_score": 0.76,
      "document": {
        "text": "Rust ownership prevents data races..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 145,
    "total_tokens": 145
  }
}
```

### Error Handling

| HTTP Status | Behavior |
|-------------|----------|
| 200 OK | Parse results, return reranked documents |
| 400 Bad Request | Log warning, fallback to original order |
| 401/403 Unauthorized | Log warning, fallback to original order |
| 429 Rate Limited | Log warning, fallback to original order |
| 500/502/503 Server Error | Log warning, fallback to original order |
| Timeout | Log warning, fallback to original order |
| Network Error | Log warning, fallback to original order |

**Key principle:** **Never fail the search** - always return results, even if reranking fails.

---

## Implementation

### RerankerService Class

**Location:** `src/store/RerankerService.ts`

**Key Methods:**
- `isReady(): boolean` - Check if enabled and initialized
- `initialize(): Promise<void>` - Test endpoint, validate config
- `rerank(query, documents, topN): Promise<RerankResult[]>` - Call API with fallback

### Integration in DocumentRetrieverService

**Location:** `src/store/DocumentRetrieverService.ts`

**Changes to search() method:**
1. Check `rerankerService.isReady()`
2. If ready: retrieve `limit * 3` documents
3. If not ready: retrieve `limit` documents
4. If ready and have >limit candidates: call reranker
5. Return top N results

---

## Behavior

### When Disabled (Default)

```bash
# .env
RERANK_ENABLED=false  # or not set at all
```

**Flow:**
1. search("async rust errors", limit=10)
2. rerankerService.isReady() → false
3. Retrieve 10 documents
4. Return as-is

**Performance:** Identical to current behavior - zero overhead.

---

### When Enabled

```bash
# .env
RERANK_ENABLED=true
RERANK_API_BASE=https://rerank.fenrirsden.org/v1
RERANK_MODEL=qwen3-text-reranker
RERANK_TIMEOUT=5000
```

**Flow:**
1. search("async rust errors", limit=10)
2. rerankerService.isReady() → true
3. Retrieve 30 documents (limit × 3)
4. POST to reranker with all 30 documents
5. Reranker returns top 10 sorted by relevance
6. Return reranked results

**Performance:**
- Retrieval: ~50ms (30 docs)
- Reranking: ~200-400ms (30 docs on GPU)
- Total: ~250-450ms

**Expected improvement:** +15-35% relevance for complex queries.

---

### When Service Fails

**Flow:**
1. search("async rust errors", limit=10)
2. rerankerService.isReady() → true
3. Retrieve 30 documents
4. POST to reranker → 500 Internal Server Error
5. Log warning: "Reranker returned 500, using original order"
6. Return 10 documents in original order

**User impact:** Zero - search still works, just without reranking.

---

## Testing Strategy

### Unit Tests

- should return false for isReady() when disabled
- should return false for isReady() when no baseURL configured
- should fallback to original order on API error
- should fallback to original order on timeout
- should correctly parse rerank response
- should handle empty document arrays
- should handle malformed responses

### Integration Tests

- should retrieve 3x docs when reranker is ready
- should retrieve limit docs when reranker is disabled
- should fallback gracefully when reranker fails
- should return original order when reranker times out

---

## Performance Considerations

### Latency Budget

| Operation | Time (ms) | Notes |
|-----------|-----------|-------|
| Query embedding | 50-100 | Already happening |
| Vector retrieval (30 docs) | 30-50 | PostgreSQL + pgvector |
| Reranking API call | 200-400 | GPU-accelerated |
| Result processing | 10-20 | Grouping, formatting |
| **Total** | **290-570ms** | Acceptable for accuracy gain |

### Throughput

**Assumptions:**
- 32 concurrent sequences per request (vLLM config)
- Reranker at 10.1.1.82 with 0.35 GPU memory

**Expected throughput:**
- ~100 rerank requests/second (32 docs each)
- Well within ScrapeGoat's concurrent crawl limit (16)

---

## Deployment

### Rollout Plan

**Phase 1: Disabled by default (MVP)**
- Deploy code with RERANK_ENABLED=false (default)
- No user impact, feature available but dormant

**Phase 2: Internal testing**
- Enable for specific libraries/versions
- Monitor latency, accuracy, error rates

**Phase 3: Production rollout**
- Enable globally via RERANK_ENABLED=true
- Document in user-facing docs

### Rollback

Simply set RERANK_ENABLED=false - instant rollback, zero code changes needed.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Search relevance | +15% accuracy |
| Latency impact | <500ms p95 |
| Error rate | <5% fallbacks |
| Adoption | >50% users enable |

---

## Files Changed

| File | Changes |
|------|---------|
| `src/store/RerankerService.ts` | NEW - Service implementation |
| `src/store/RerankerService.test.ts` | NEW - Unit tests |
| `src/store/DocumentRetrieverService.ts` | MODIFY - Inject reranker, modify search() |
| `src/utils/config.ts` | MODIFY - Add reranker config interface |
| `.env.example` | MODIFY - Document new env vars |

**Total:** ~400 lines of code + tests

---

**Document Status:** ✅ Approved for implementation  
**Next Step:** Invoke writing-plans skill to create detailed implementation plan
