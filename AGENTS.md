
# Agent Instructions for scrapegoat

## Additional Rule

- NEVER USE SUBTASKS!  ONLY USE SUBAGENTS!

## Repository Context

- **Repository**: `midnightphreaker/scrapegoat`
- **Core Stack**: Node.js 22.x, TypeScript, Vite, AlpineJS, TailwindCSS, PostgreSQL (pgvector)
  - **Node Version**: Always use **Node.js v22** for local development and builds, even if `package.json` allows older versions.
- **Tooling**: Biome (lint/format), Vitest (test), Husky (pre-commit)
- **Critical Documentation**:
  - 📖 **Read `README.md`** first for project structure, setup, and configuration details.
  - 🗺️ **Read `ARCHITECTURE.md`** before making changes to understand system design and service interactions.

## Repository Map

A full codemap is available at `codemap.md` in the project root.

Before working on any task, read `codemap.md` to understand:
- Project architecture and entry points
- Directory responsibilities and design patterns
- Data flow and integration points between modules

For deep work on a specific folder, also read that folder's `codemap.md`.

## Development Workflow

### Key Commands

| Task | Command | Description |
|------|---------|-------------|
| **Setup** | `npm install` | Install dependencies |
| **Build** | `npm run build` | Build both server and web assets |
| **Lint** | `npm run lint` | Check code issues with Biome |
| **Fix** | `npm run lint:fix` | Auto-fix lint issues (add `-- --unsafe` if needed) |
| **Typecheck** | `npm run typecheck` | Run TypeScript compiler checks |
| **Format** | `npm run format` | Format code with Biome |
| **Test All** | `npm test` | Run all tests with Vitest |
| **Test Single** | `npx vitest run <path>` | Run a specific test file (e.g., `src/utils/foo.test.ts`) |

### Git Workflow

- Always create a feature branch from `main`
- Follow conventional commits (checked by commitlint)
- Use `npm run lint` before committing (enforced by Husky pre-commit)
- Ensure all tests pass before pushing
