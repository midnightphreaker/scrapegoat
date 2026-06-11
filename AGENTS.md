# AGENTS.md

## Role

You are working in the ScrapeGoat repository. ScrapeGoat is a Node.js 22 /
TypeScript MCP server and web dashboard for fetching, indexing, refreshing, and
searching documentation. It ingests web pages, GitHub/package sources, local
files, and archives; chunks content; writes embeddings to PostgreSQL with
pgvector; and exposes the data through MCP tools, CLI commands, and a web UI.

Work directly in this repository when the task is scoped and safe. Preserve user
changes, keep edits project-local, and verify before claiming completion.

## First Reads

Before changing behavior, read the relevant files plus these docs:

- `README.md` for product behavior, deployment modes, environment variables, and
  MCP tool surface.
- `docs/ARCHITECTURE.md` for service boundaries and pipeline flow. Treat it as
  useful context, but verify against current code when details disagree.
- `docs/CONTRIBUTING.md` and `test/README.md` for development and test workflow.
- OpenSpec material under `openspec/changes/` when the task references an active
  design/change.

## Repository Map

- `src/index.ts`: executable entrypoint; loads dotenv, sanitizes env, enables
  source maps, and starts the CLI.
- `src/cli/`: yargs CLI, command routing, output formatting, and service
  lifecycle handling.
- `src/app/`: composed application server for combined services.
- `src/mcp/`: MCP server, transport setup, and MCP tool registration.
- `src/tools/`: business logic for MCP/CLI-visible operations such as scraping,
  searching, listing jobs, refreshing, and removal.
- `src/pipeline/`: job queue, worker execution, tRPC client/router interfaces,
  and distributed pipeline coordination.
- `src/scraper/`: content acquisition and conversion pipelines for web, package,
  source, document, and local-file inputs.
- `src/splitter/`: markdown, JSON, text, tree-sitter, and greedy chunking logic.
- `src/store/`: PostgreSQL connection, migrations, document management,
  retrieval, embeddings, search result assembly, and store tRPC router.
- `src/events/`: event bus, remote event proxy, and event streaming router.
- `src/web/`: Fastify/TSX web UI routes, components, client JS, and styles.
- `src/upload/`: upload staging, archive extraction, import tree construction,
  and upload security checks.
- `src/auth/`: OAuth2 proxy auth manager and route middleware.
- `src/telemetry/`: privacy-minded telemetry config, sanitizer, and PostHog
  client.
- `src/utils/`: shared config, logging, env, URL, path, MIME, archive, and
  version utilities.
- `db/migrations/`: ordered PostgreSQL schema migrations.
- `test/`: end-to-end and integration tests plus fixtures and mock server.
- `skills/`: MCP/agent-facing skill definitions shipped with the project.

## Runtime And Configuration

- Use Node.js 22. `package.json` requires `>=22`; native dependencies may need
  `npm rebuild` after switching Node versions.
- Configuration is resolved by `src/utils/config.ts` using defaults, config
  files, environment variables, and CLI arguments. Keep `DEFAULT_CONFIG`,
  `AppConfigSchema`, env aliases, and docs synchronized when adding settings.
- The database is PostgreSQL with pgvector. Do not add SQLite guidance or code
  unless the project explicitly reintroduces it.
- Database changes belong in `db/migrations/` and must be compatible with
  `src/store/applyMigrations.ts`.
- Never commit or print secrets. Do not persist `.env` contents, API keys,
  tokens, private keys, passwords, or credential JSON in logs, tests, docs, or
  summaries.

## Commands

Run the smallest reliable check first, then broaden as risk increases.

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Build server and web assets | `npm run build` |
| Run all tests | `npm test` |
| Run unit tests only | `npm run test:unit` |
| Run e2e tests | `npm run test:e2e` |
| Run one test file | `npx vitest run <path>` |
| Run live web e2e tests | `npm run test:live` |
| Typecheck source and tests | `npm run typecheck` |
| Typecheck production build | `npm run typecheck:build` |
| Lint with Biome | `npm run lint` |
| Auto-fix lint issues | `npm run lint:fix` |
| Format | `npm run format` |
| Search evaluation | `npm run evaluate:search` |
| Start built app | `npm start` |
| Dev server/watch build | `npm run dev` |

`npm run test:live` touches real websites and is slower/flakier by design. Use it
only when the change depends on live scraping behavior or the user asks for it.

## Coding Conventions

- TypeScript is strict. Prefer explicit domain types, discriminated unions, and
  existing interfaces over `any`.
- Keep imports at the top and let Biome organize them.
- Use 2-space indentation and the existing line width/style.
- Prefer small, composable services that match the current boundaries: tools
  coordinate operations, pipeline services execute jobs, store services own
  persistence/search, and route layers adapt inputs/outputs.
- Do not bypass centralized configuration by reading process env deep inside
  feature code when an `AppConfig` path already exists.
- Use existing logger utilities for app/service messages. `console.*` is for
  intentional CLI/user output.
- Sanitize user-provided URLs, paths, filenames, headers, auth data, and binary
  content before logging or storing.
- Preserve read-only mode behavior. Write tools must remain disabled when
  `SCRAPEGOAT_READ_ONLY` / `app.readOnly` is enabled.
- Keep telemetry privacy-preserving. Update sanitizer tests when telemetry event
  payloads change.

## Testing Expectations

- Source tests are colocated as `src/**/*.test.ts`.
- System-level e2e tests live in `test/*-e2e.test.ts`.
- Default tests should not depend on external network availability. Use the mock
  server and fixtures under `test/` unless explicitly working on live behavior.
- For new behavior, add or update a focused test when feasible. Prefer testing
  observable contracts over internal implementation details.
- For bug fixes, reproduce with a failing test or the smallest executable check
  before changing code when practical.
- For database changes, cover migration behavior and any affected
  `DocumentStore` / document management query behavior.
- For web UI changes, verify route output or client behavior with the existing
  Vitest setup. Use browser/manual verification only when automated coverage is
  not practical.

## Web UI Notes

- Web routes and components use TSX with `@kitajs/html`, HTMX, AlpineJS, and
  Tailwind-style CSS.
- Keep server-rendered route handlers thin. Reuse services/tools instead of
  duplicating business logic in route files.
- Keep upload UI and upload security behavior aligned with `src/upload/`.
- When changing CSS or client JS, check responsive behavior and avoid breaking
  htmx/Alpine attributes generated from TSX.

## MCP And Tooling Notes

- MCP tool definitions are registered in `src/mcp/` and implemented in
  `src/tools/`. Update both implementation and tests when tool input/output
  contracts change.
- Keep MCP resources and README documentation in sync when adding, removing, or
  renaming tools/resources.
- `fetch_url` is a read tool. Scraping, refresh, removal, and job mutation tools
  are write operations and must honor read-only mode.

## Documentation

- Update `README.md` for user-facing install, deployment, configuration, and MCP
  surface changes.
- Update `docs/ARCHITECTURE.md` or `docs/concepts/*.md` for service boundaries,
  data flow, storage, splitting, search, or pipeline changes.
- Keep docs declarative and current. Prefer concrete commands, file names, and
  environment variable names over broad prose.

## Git And Safety

- Inspect `git status --short` before edits when making code changes.
- Do not revert, overwrite, or reformat unrelated user changes.
- Do not commit, push, publish, deploy, or release unless explicitly asked.
- Before any requested commit, verify the diff, exclude unrelated changes, and
  ensure no secrets are present.
- Avoid destructive commands such as `git reset --hard`, `git checkout --`, and
  broad deletes unless the user explicitly asks and the target is unambiguous.

## Final Response Expectations

When finishing work, report:

- status: complete, partial, blocked, or failed
- what changed
- files changed
- checks/tests run and key evidence
- remaining risks or follow-up, if any

Do not claim checks passed unless they were actually run and the output
confirmed success.
