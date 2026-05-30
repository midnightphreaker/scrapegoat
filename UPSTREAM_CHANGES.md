# Upstream Changes Review

## Executive Summary

This document compares ScrapeGoat (a fork of `arabold/docs-mcp-server`) against its upstream parent to identify compatible upstream changes that should be merged.

**Key findings:**

- **Upstream:** `arabold/docs-mcp-server` at version **2.4.0** (as of 2026-05-19)
- **ScrapeGoat:** Based on upstream **~2.2.1-era** code with no shared git history (code was imported without preserving upstream commit history)
- **Divergence:** Structural — ScrapeGoat replaced SQLite with PostgreSQL/Vector DB and added configurable embedding providers, while upstream continued with SQLite/sqlite-vec
- **Identical files:** `src/index.ts`, `src/index.test.ts`, `src/events/`, `src/telemetry/`, `src/types/`, `src/app/` (SHA-verified identical)
- **Diverged files:** `src/auth/`, `src/cli/`, `src/mcp/`, `src/pipeline/`, `src/scraper/`, `src/services/`, `src/splitter/`, `src/store/`, `src/tools/`, `src/utils/`, `src/web/`
- **Upstream changes reviewed:** ~20+ significant commits between v2.2.1 and v2.4.0
- **Recommended for porting:** 8 changes (4 safe, 4 with adaptation)
- **Skipped:** 6 changes (conflict with ScrapeGoat architecture or not relevant)
- **Biggest risks:** Store layer divergence (SQLite → PostgreSQL), splitter changes, scraper pipeline modifications

## Repository Baseline

| Item | Value |
|---|---|
| Upstream repository | https://github.com/arabold/docs-mcp-server |
| Upstream branch reviewed | main |
| Upstream HEAD | `e1a7e199de353eb23e7a1f6493fdb46f902e8456` |
| Upstream version | 2.4.0 |
| ScrapeGoat branch reviewed | main |
| ScrapeGoat HEAD | `eeacb8dc6a7c930778db02ceedff96f84b16c779` |
| ScrapeGoat version | 2.2.1 |
| Merge base / divergence commit | **Cannot be determined via git merge-base** |
| Divergence method | Structural comparison (no shared git history) |

### Divergence Note

ScrapeGoat's git history contains only commits by `gitbot` and `mp` starting from 2026-03-25. There is no shared git ancestry with the upstream `arabold/docs-mcp-server` repository. The code was imported (not forked via git) and the fork's initial state corresponds approximately to upstream v2.2.1 or slightly before.

The divergence point was determined by:
1. Comparing `package.json` version numbers (ScrapeGoat: 2.2.1, upstream: 2.4.0)
2. SHA comparison of files in both repos to identify identical vs diverged content
3. Dependency analysis to identify architectural differences

## ScrapeGoat Project Decisions To Preserve

The following non-negotiable decisions must be maintained when porting upstream changes:

- **PostgreSQL storage:** Do not reintroduce SQLite (`better-sqlite3`) as the primary persistence layer
- **No sqlite-vec:** Do not add `sqlite-vec` dependency; ScrapeGoat uses a different vector search approach
- **Configurable embeddings:** Preserve configurable embedding provider/model/endpoint/parameter behavior
- **No mandatory API keys:** Do not reintroduce mandatory external API-key requirements (OpenAI, etc.)
- **Docker deployment:** Preserve ScrapeGoat-specific Docker deployment assumptions (docker-compose, nginx, PostgreSQL container)
- **Forgejo CI/CD:** Maintain Forgejo Actions workflows, do not revert to GitHub Actions
- **MCP session handling:** Preserve the ScrapeGoat streamable HTTP session fix (commit `f61462370610fca206ebc352a8f7cdf85f3ed69f`)
- **CORS configuration:** Preserve ScrapeGoat CORS fix
- **Extended .env.example:** Preserve all ScrapeGoat-specific tuning-relevant env vars in `.env.example` (5098 bytes vs upstream's 2352 bytes)
- **Existing bugfixes:** Preserve existing ScrapeGoat bugfixes unless an upstream fix is clearly better and compatible
- **Package name:** ScrapeGoat still uses `@arabold/docs-mcp-server` as the package name — this may be intentional for compatibility

## File-Level SHA Comparison

Files and directories with **identical SHAs** (safe, no merge needed):

| Path | SHA |
|---|---|
| `src/index.ts` | `a1d29ebd7e3c65ea16998ee9e0e01a921c54a018` |
| `src/index.test.ts` | `9490352ec987d834c45be3b90e03af34bbcf8960` |
| `src/events/` | `d01f1768277e6cb3522f37eaee3d03b801140755` |
| `src/telemetry/` | `63b0a07e097a60b7dbec645b47f328ea56b9c9b5` |
| `src/types/` | `3c18bf088364af6dd292ac9cf2ade39d090d08de` |
| `src/app/` | `a500b9edeb100d69ad389bf1277fa853394e6ff2` |

Files and directories with **different SHAs** (require manual comparison):

| Path | ScrapeGoat SHA | Upstream SHA |
|---|---|---|
| `src/auth/` | `b46cf77e...` | `4adc4069...` |
| `src/cli/` | `d949f1fc...` | `46f4c7b0...` |
| `src/mcp/` | `77f4cc8a...` | `6da517bf...` |
| `src/pipeline/` | `72c9357e...` | `eea203a7...` |
| `src/scraper/` | `7f3f2070...` | `da542479...` |
| `src/services/` | `ea3314265...` | `da9db2d4...` |
| `src/splitter/` | `aa4e4494...` | `868266f2...` |
| `src/store/` | `294502a0...` | `da989b61...` |
| `src/tools/` | `581e33dd...` | `d0a66f65...` |
| `src/utils/` | `0cd38260...` | `59c780c1...` |
| `src/web/` | `2cd1e11d...` | `22c0fa5b...` |

## Dependency Comparison

### Dependencies present in ScrapeGoat but NOT in upstream

| Dependency | Purpose |
|---|---|
| `pg` (^8.13.1) | PostgreSQL client — ScrapeGoat's primary database driver |
| `@types/pg` (^8.11.10) | TypeScript types for PostgreSQL |

### Dependencies present in upstream but NOT in ScrapeGoat

| Dependency | Purpose |
|---|---|
| `better-sqlite3` (^12.8.0) | SQLite driver — upstream's primary database |
| `sqlite-vec` (^0.1.7-alpha.2) | SQLite vector search extension |
| `defuddle` (^0.18.1) | HTML content extractor (opt-in) |
| `linkedom` (^0.18.12) | Lightweight DOM implementation |
| `@types/better-sqlite3` (^7.6.13) | TypeScript types for SQLite |

### Version differences in shared dependencies

| Dependency | ScrapeGoat | Upstream | Notes |
|---|---|---|---|
| `@kreuzberg/node` | `~4.4.6` (pinned) | `^4.4.6` | ScrapeGoat pins to exact minor |
| `@fastify/static` | `^8.3.0` | `^9.1.3` | Major version bump in upstream |
| `env-paths` | `^3.0.0` | `^4.0.0` | Major version bump in upstream |
| `jsdom` | `^27.4.0` | `^29.1.1` | Major version bump in upstream |
| `uuid` | `^13.0.0` | `^14.0.0` | Major version bump in upstream |
| `@types/jsdom` | `^27.0.0` | `^28.0.3` | Follows jsdom version |

## Upstream Change Inventory

Changes between upstream v2.2.1 and v2.4.0 (2026-05-19 release), organized by area:

| Area | Summary | Classification | Notes |
|---|---|---|---|
| **Splitter: code fence balance** | TextContentSplitter now preserves code fence balance across chunk boundaries (fixes #418) | `SAFE_TO_PORT` | Pure logic fix, no storage dependency |
| **Splitter: info string preservation** | Fenced code-block info strings preserved verbatim (e.g. `js{15-18} twoslash`) | `SAFE_TO_PORT` | Pure logic fix, no storage dependency |
| **Scraper: llms.txt discovery** | Discovers and prefers `llms.txt` / `llms-full.txt` markdown content | `SAFE_TO_PORT` | New scraper capability, no storage dependency |
| **Scraper: llms markdown handling** | Tightened llms markdown processing | `SAFE_TO_PORT` | Logic fix in llms pipeline |
| **Scraper: Defuddle HTML extractor** | Optional Defuddle-based HTML content extraction | `PORT_WITH_ADAPTATION` | New dependency (`defuddle`), needs ScrapeGoat embedding awareness |
| **Scraper: redirect scope anchoring** | Keeps redirect scope anchored to start path | `SAFE_TO_PORT` | Bugfix in scraper redirect handling |
| **Scraper: speculative prefetch skip** | Skips speculative Playwright prefetches | `SAFE_TO_PORT` | Performance fix, no storage dependency |
| **Scraper: ad/search widget stripping** | Strips ad networks, search widgets, breadcrumbs, skip-links (#420) | `SAFE_TO_PORT` | Content quality improvement |
| **Scraper: Carbon link rule scoping** | Scopes Carbon link rules to server host, adds Yahoo tracker pixel | `SAFE_TO_PORT` | URL filtering improvement |
| **Scraper: continue from llms seeds** | Continues from llms seeds on root not found | `SAFE_TO_PORT` | Graceful degradation in llms discovery |
| **Scraper: Defuddle review fixes** | Address Copilot review on Defuddle middleware | `PORT_WITH_ADAPTATION` | Depends on Defuddle being ported |
| **Store: SQLite vector search** | Upstream improvements to SQLite-based vector search | `SKIP_CONFLICTS_WITH_SCRAPEGOAT` | ScrapeGoat uses PostgreSQL, not SQLite |
| **Store: SQLite migrations** | Any upstream SQLite migration changes | `SKIP_CONFLICTS_WITH_SCRAPEGOAT` | ScrapeGoat uses PostgreSQL |
| **Store: test isolation** | Hardened vector search test isolation | `SKIP_CONFLICTS_WITH_SCRAPEGOAT` | Tests assume SQLite |
| **Docker: e2e test infrastructure** | Docker-based end-to-end test framework | `PORT_WITH_ADAPTATION` | Needs adaptation for PostgreSQL containers |
| **Docker: archive extraction tests** | Tests for mounted archive extraction in Docker | `PORT_WITH_ADAPTATION` | Needs adaptation for ScrapeGoat Docker setup |
| **Eval: search quality benchmark** | IR-grounded search quality benchmark infrastructure | `PORT_WITH_ADAPTATION` | Useful for quality measurement, needs PG adaptation |
| **Eval: Context7 provider** | Context7 provider for cross-system benchmark | `NOT_RELEVANT` | External benchmarking, not needed for ScrapeGoat |
| **Eval: provider normalization** | Provider normalization fixes in eval | `NOT_RELEVANT` | Eval infrastructure, not core functionality |
| **Eval: bash truncation workaround** | URL normalization fixes for eval scripts | `NOT_RELEVANT` | Eval infrastructure |
| **Docs: AGENTS.md, ARCHITECTURE.md** | Updated documentation | `ALREADY_PRESENT` | ScrapeGoat may have its own versions |
| **Docs: openspec archival** | Archived completed openspec changes | `NOT_RELEVANT` | Upstream process documentation |
| **Docs: eval benchmark numbers** | Defuddle and fence-fix benchmark reports | `NOT_RELEVANT` | Upstream benchmark documentation |
| **Build: Dockerfile** | Upstream Dockerfile changes | `PORT_WITH_ADAPTATION` | ScrapeGoat has its own Docker setup |
| **Build: docker-compose.yml** | Upstream compose changes | `SKIP_CONFLICTS_WITH_SCRAPEGOAT` | ScrapeGoat uses different services (PostgreSQL, etc.) |
| **Build: dependency updates** | Multiple dependency version bumps | `PORT_WITH_ADAPTATION` | Selective updates needed, avoid SQLite deps |

## Recommended Changes To Port

### Priority 1: High — Bugfixes with no storage impact

#### 1.1 Port code fence balance fix

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `06c7f083f958054d2440bd674ddf33f570dfdb0a`
- **Upstream files:** `src/splitter/` (TextContentSplitter, potentially ListContentSplitter)
- **Why:** Fixes a bug where the chunker cuts inside fenced code blocks, causing downstream LLMs to see broken content. This affects search quality.
- **ScrapeGoat compatibility:** No database-specific assumptions. Pure text processing logic.
- **Implementation notes:** Read upstream's `TextContentSplitter` changes and apply manually to ScrapeGoat's `src/splitter/`. The fix adds fence-awareness to the splitting logic — after splitting by paragraphs/lines/words, merge adjacent chunks when the running buffer ends inside an open fence.
- **Expected conflicts:** ScrapeGoat's splitter may have its own modifications. Manual comparison needed.
- **Tests:** Add regression tests for code blocks nested in `<ul>`, `<blockquote>`, `<dl><dd>`, `<details>`, generic `<div>`, table cells.

#### 1.2 Port code-block info string preservation

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `a5445bb1a6fa83fff2c4528c68487fbfddac27e2`
- **Upstream files:** `src/splitter/` (CodeContentSplitter)
- **Why:** Fixes double-fencing of code chunks when info strings contain special characters (e.g., VitePress/Shiki `js{15-18} twoslash [server.js]`).
- **ScrapeGoat compatibility:** No database-specific assumptions. Pure text processing.
- **Implementation notes:** The fix captures the full info string verbatim and re-emits it on every chunk's rewritten opener. Replace the `/^```(\w+)\n/` regex with one that captures the entire info string.
- **Expected conflicts:** Check if ScrapeGoat's CodeContentSplitter has diverged.
- **Tests:** Test with VitePress-style info strings.

#### 1.3 Port scraper redirect scope fix

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `a9fbca06c644fc4f27055741d8023232695f95b6`
- **Upstream files:** `src/scraper/` (redirect handling)
- **Why:** Fixes a bug where redirect scope could drift away from the intended start path.
- **ScrapeGoat compatibility:** No storage impact. Scraper logic fix.
- **Implementation notes:** Read upstream redirect handling diff, apply manually.
- **Expected conflicts:** ScrapeGoat's scraper may have its own changes. Compare carefully.
- **Tests:** Add redirect scope regression tests.

#### 1.4 Port speculative prefetch skip

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `1e6581231e28bec7f7510dedac04d8fae37b147c`
- **Upstream files:** `src/scraper/` (Playwright-related)
- **Why:** Prevents the scraper from following speculative prefetch links, reducing noise and wasted resources.
- **ScrapeGoat compatibility:** No storage impact. Scraper logic fix.
- **Implementation notes:** Add prefetch link filtering to ScrapeGoat's scraper.
- **Expected conflicts:** Minimal if ScrapeGoat's scraper follows similar patterns.
- **Tests:** Test that prefetch links are excluded.

### Priority 2: Medium — Improvements with minor adaptation

#### 2.1 Port llms.txt discovery

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `42309174fca142d513f326453b2ca568ff7da1e5`
- **Upstream files:** `src/scraper/` (llms discovery logic)
- **Why:** Discovers and prefers `llms.txt` / `llms-full.txt` for better documentation quality. This is a significant scraper capability improvement.
- **ScrapeGoat compatibility:** No database-specific assumptions. New scraper feature.
- **Implementation notes:** Add llms.txt detection and parsing to ScrapeGoat's scraper pipeline. May need to check if ScrapeGoat's pipeline has diverged in how it processes discovered URLs.
- **Expected conflicts:** ScrapeGoat's `src/scraper/` has different SHA. Manual comparison needed.
- **Tests:** Test llms.txt discovery for known sites.

#### 2.2 Port ad/widget/breadcrumb stripping

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `4898ce96299e98fdd821fc8d33b2c319315adfd1`
- **Upstream files:** `src/scraper/` (HTML content cleaning)
- **Why:** Improves documentation quality by removing ads, search widgets, breadcrumbs, and skip-links. Closes upstream #420.
- **ScrapeGoat compatibility:** No storage impact. Content quality improvement.
- **Implementation notes:** Read upstream's HTML cleaning rules and apply to ScrapeGoat's equivalent.
- **Expected conflicts:** ScrapeGoat's scraper may have its own cleaning logic.
- **Tests:** Test content quality on pages with known ad/widget elements.

#### 2.3 Port Carbon link rule scoping

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `d35fc3e21fa6d184c7ef8a0d90bbfd8ad360ad83`
- **Upstream files:** `src/scraper/` (URL filtering)
- **Why:** Scopes Carbon ad link rules to the server host and adds Yahoo tracker pixel filtering.
- **ScrapeGoat compatibility:** No storage impact.
- **Implementation notes:** Apply URL filtering changes.
- **Expected conflicts:** Minimal.
- **Tests:** Test URL filtering with Carbon and Yahoo tracker URLs.

#### 2.4 Port llms "continue from seeds" fix

- **Classification:** `SAFE_TO_PORT`
- **Upstream commits:** `7ac577ab7ea9e3c7c9ad55970c335a9427943a15`
- **Upstream files:** `src/scraper/` (llms discovery fallback)
- **Why:** Graceful degradation when root page is not found but llms seeds are available.
- **ScrapeGoat compatibility:** No storage impact.
- **Implementation notes:** Add fallback logic for llms seed continuation.
- **Expected conflicts:** Depends on llms.txt feature being ported first.
- **Tests:** Test fallback when root page returns 404 but llms.txt exists.

### Priority 3: Low — Improvements needing significant adaptation

#### 3.1 Port Defuddle HTML extractor (opt-in)

- **Classification:** `PORT_WITH_ADAPTATION`
- **Upstream commits:** `5a89f84cdfc7302401bd30f6d08a5bf049eb4776`, `729526fdf65c0000ccda966914e48ae6fc6974a8`
- **Upstream files:** `src/scraper/` (Defuddle integration), `package.json`
- **Why:** Provides an alternative HTML content extractor that may improve content quality for some sites.
- **ScrapeGoat compatibility:** Requires adding `defuddle` dependency. Lazy-loaded so default path is unaffected.
- **Implementation notes:** Add `defuddle` as optional dependency. Integrate into ScrapeGoat's scraper pipeline with `SCRAPEGOAT_SCRAPER_HTML_EXTRACTOR` env var support.
- **Expected conflicts:** ScrapeGoat's scraper has diverged. Manual integration needed.
- **Tests:** Compare content quality with/without Defuddle on test documentation sites.

## Changes To Port With Adaptation

### Docker E2E Test Framework

- **Classification:** `PORT_WITH_ADAPTATION`
- **Upstream commits:** `0eb2bf048c5fa47be88c25abee48f62c5ce9550a`, `6c218984297166d7a9e98b0a825d003193652317`
- **Why:** Docker-based E2E testing is critical for ScrapeGoat's deployment model.
- **Adaptation needed:** Replace upstream's SQLite test containers with PostgreSQL containers. Add Vector DB containers. Use ScrapeGoat-specific Docker Compose configuration.
- **Tests:** Full Docker E2E test suite adapted for ScrapeGoat's stack.

### Dependency Updates (Selective)

- **Classification:** `PORT_WITH_ADAPTATION`
- **Why:** Several shared dependencies have major version bumps in upstream.
- **Safe to update:** `@fastify/static` (8→9), `env-paths` (3→4), `jsdom` (27→29), `uuid` (13→14)
- **Skip:** `better-sqlite3`, `sqlite-vec`, `defuddle`, `linkedom` (already covered above or not needed)
- **Caution:** Test each update individually. Major version bumps may have breaking changes.

## Changes To Skip

### Skip upstream SQLite storage changes

- **Reason:** ScrapeGoat uses PostgreSQL / Vector DB. Upstream's `better-sqlite3` and `sqlite-vec` dependencies, SQLite migrations, and SQLite-specific store code are incompatible with ScrapeGoat's architecture.

### Skip upstream SQLite vector search

- **Reason:** ScrapeGoat uses its own vector search approach via PostgreSQL. Upstream's `sqlite-vec` integration is irrelevant.

### Skip upstream SQLite test isolation fixes

- **Reason:** Tests assume SQLite. ScrapeGoat needs its own PostgreSQL-based test isolation.

### Skip upstream docker-compose.yml

- **Reason:** ScrapeGoat uses a different Docker Compose configuration with PostgreSQL, nginx, and different service architecture.

### Skip upstream eval infrastructure

- **Reason:** Upstream's search quality benchmark, Context7 provider, and eval-specific fixes are for upstream's own quality measurement. ScrapeGoat should develop its own benchmark if desired.

### Skip upstream semantic-release configuration

- **Reason:** ScrapeGoat uses Forgejo Actions for releases, not semantic-release with GitHub Actions.

## Potential Conflicts / Risk Areas

### High Risk

1. **Store layer (`src/store/`)** — Fundamental architectural difference (PostgreSQL vs SQLite). Any upstream changes to store, migrations, or vector search must be carefully evaluated. This is the highest-risk area.

2. **Splitter (`src/splitter/`)** — Different SHAs indicate ScrapeGoat may have splitter modifications. Code fence balance and info string fixes need manual application, not cherry-picking.

3. **Scraper pipeline (`src/scraper/`)** — Different SHAs. ScrapeGoat may have its own scraper modifications. All scraper changes need manual comparison.

### Medium Risk

4. **MCP service (`src/mcp/`)** — ScrapeGoat has custom MCP session handling (streamable HTTP fix). Upstream changes to MCP service could conflict.

5. **Pipeline (`src/pipeline/`)** — Different SHAs. Changes to the processing pipeline need careful merging.

6. **Web UI (`src/web/`)** — Different SHAs. ScrapeGoat may have Web UI modifications.

7. **Services (`src/services/`)** — Different SHAs. Service-level changes (embedding, search) may conflict with ScrapeGoat's configurable embedding setup.

### Low Risk

8. **Tools (`src/tools/`)** — Different SHAs but likely minor changes.

9. **Utils (`src/utils/`)** — Different SHAs but utility functions are typically safe to update.

10. **CLI (`src/cli/`)** — Different SHAs. CLI changes are usually self-contained.

11. **Auth (`src/auth/`)** — Different SHAs. Auth changes need evaluation.

12. **Dependencies** — Selective updates are safe, but `pg` must not be removed, and `better-sqlite3`/`sqlite-vec` must not be added.

## Implementation Plan For Follow-Up Issue

### Phase 1: Low-risk splitter fixes

- Port code fence balance fix (commit `06c7f08`)
- Port code-block info string preservation (commit `a5445bb`)
- Add regression tests for both
- Run `npm run lint`, `npm run typecheck`, `npm test`
- **Estimated effort:** Small
- **Risk:** Low (no storage/config impact)

### Phase 2: Scraper fixes

- Port speculative prefetch skip (commit `1e65812`)
- Port redirect scope anchoring fix (commit `a9fbca0`)
- Port Carbon link rule scoping (commit `d35fc3e`)
- Port ad/widget/breadcrumb stripping (commit `4898ce9`)
- Add regression tests
- Run full test suite
- **Estimated effort:** Medium
- **Risk:** Medium (scraper may have diverged)

### Phase 3: Scraper features

- Port llms.txt discovery (commit `4230917`)
- Port llms seed continuation (commit `7ac577a`)
- Port llms markdown handling fixes (commit `1e88418`)
- Add tests for llms.txt processing
- **Estimated effort:** Medium
- **Risk:** Medium (new feature integration)

### Phase 4: Optional enhancements

- Evaluate Defuddle HTML extractor integration
- Port Docker E2E test framework (adapted for PostgreSQL)
- Selective dependency updates (`@fastify/static`, `env-paths`, `uuid`)
- **Estimated effort:** Large
- **Risk:** Medium-High (dependency changes, test infrastructure)

### Phase 5: Validation

- Run full ScrapeGoat Docker stack tests
- Validate PostgreSQL connectivity and migrations
- Validate embedding provider configuration
- Validate WebUI functionality
- Validate MCP protocol (SSE + Streamable HTTP)
- Performance regression testing

## Validation Plan

### Pre-port validation (establish baseline)

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

### Post-port validation (per phase)

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Docker validation

```bash
docker compose build
docker compose up -d
# Wait for services to be healthy
# Test MCP endpoint
curl -s http://localhost:6280/health
# Test WebUI
curl -s http://localhost:6280/
# Test search functionality
# Test scraping functionality
```

### Full integration validation

```bash
# Run all tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Docker stack validation
docker compose down -v
docker compose build --no-cache
docker compose up -d
# Validate all services healthy
# Validate MCP SSE transport
# Validate MCP Streamable HTTP transport
# Validate WebUI scraping and search
docker compose down -v
```

## Notes For Future Implementer

1. **Do not blindly merge upstream.** ScrapeGoat has fundamental architectural differences (PostgreSQL vs SQLite) that make direct merging impossible.

2. **Prefer manual patches** where ScrapeGoat has diverged. Read the upstream diff, understand the intent, then apply the logic to ScrapeGoat's code.

3. **Keep commits small and reviewable.** Each ported change should be its own commit with a clear description of what was ported and any adaptations made.

4. **Preserve PostgreSQL/Vector DB architecture.** Never introduce SQLite dependencies into ScrapeGoat.

5. **Preserve ScrapeGoat embedding configuration.** The configurable provider/model/endpoint/parameter system must not be weakened.

6. **Run tests after each logical group.** Don't accumulate multiple ports before testing.

7. **Update this document** if implementation discovers incorrect assumptions or additional upstream changes.

8. **Check `src/store/` SHA differences first** before touching any store-related code. The store layer is the most divergent area.

9. **The `.env.example` difference (5098 vs 2352 bytes) suggests** ScrapeGoat has many additional environment variables for PostgreSQL, embedding, and Docker configuration. Any upstream `.env.example` changes should be merged carefully to preserve ScrapeGoat additions.

10. **ScrapeGoat's `@kreuzberg/node` is pinned (`~4.4.6`)** while upstream uses `^4.4.6`. Investigate why ScrapeGoat pins this before updating.
