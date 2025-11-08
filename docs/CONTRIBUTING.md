# Contributing to Scrapegoat

Thank you for your interest in contributing to Scrapegoat! This guide will help you get started with development.

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector
- Docker (for Crawl4AI development)
- Git

### Initial Setup

```bash
# Fork and clone repository
git clone https://github.com/yourusername/scrapegoat.git
cd scrapegoat

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your local settings

# Set up database
createdb scrapegoat
psql scrapegoat -c "CREATE EXTENSION vector;"
npm run db:push

# Start Crawl4AI (optional)
docker run -d \
  --name crawl4ai-dev \
  -p 11235:11235 \
  --security-opt seccomp=unconfined \
  --cap-add=SYS_ADMIN \
  unclecode/crawl4ai:basic
```

### Development Mode

Run services in development mode with hot reload:

```bash
# Terminal 1: MCP Server
npm run dev:mcp

# Terminal 2: Web Service
npm run dev:web

# Terminal 3: Worker API
npm run dev:worker
```

## Project Structure

```
scrapegoat/
├── src/
│   ├── mcp/              # MCP Server (port 6280)
│   ├── web/              # Web Service (port 6281)
│   ├── worker/           # Worker API (port 8080)
│   ├── lib/              # Shared libraries
│   │   ├── fetchers/     # Content fetchers
│   │   └── storage/      # Storage pipeline
│   ├── db/               # Database layer
│   │   ├── schema.ts     # Drizzle schema
│   │   └── migrations/   # SQL migrations
│   ├── pipeline/         # Processing pipeline
│   ├── store/            # Document store
│   └── tools/            # MCP tools
├── tests/                # Test files
├── docs/                 # Documentation
└── dist/                 # Compiled output
```

## Development Workflow

### Creating a New Feature

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following our standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(mcp): add batch search tool
fix(worker): resolve timeout in Crawl4AI fetcher
docs(install): update PostgreSQL setup instructions
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/fetchers/simple.test.ts

# Run with coverage
npm test -- --coverage
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { SimpleFetcher } from '@/lib/fetchers/simple';

describe('SimpleFetcher', () => {
  it('should fetch static HTML', async () => {
    const fetcher = new SimpleFetcher();
    const result = await fetcher.fetch('https://example.com');
    
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });
});
```

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types, avoid `any`
- Use interfaces for object shapes
- Export types for public APIs

### Code Style

We use ESLint and Prettier:

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

**Key rules:**
- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons
- Max line length: 100 characters
- Use async/await over promises
- Prefer const over let

### Error Handling

```typescript
// Good: Specific error types
class FetchError extends Error {
  constructor(
    message: string,
    public url: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

try {
  const result = await fetcher.fetch(url);
} catch (error) {
  if (error instanceof FetchError) {
    console.error(`Failed to fetch ${error.url}: ${error.message}`);
  } else {
    throw error;
  }
}
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Documentation updated
- [ ] Commit messages follow convention

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How were these changes tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

1. Automated checks run (tests, linting, build)
2. Code review by maintainers
3. Address feedback
4. Approval and merge

## Architecture Guidelines

### Adding a New Fetcher

1. Create fetcher class in `src/lib/fetchers/`
2. Implement `Fetcher` interface
3. Add to fetcher factory
4. Add tests
5. Update documentation

### Adding a New MCP Tool

1. Create tool definition in `src/tools/`
2. Register in MCP server
3. Add tests
4. Update MCP documentation

### Adding Database Migrations

1. Update schema in `src/db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Test migration: `npm run db:push`
4. Commit migration files

## Documentation

### When to Update Documentation

- Adding new features
- Changing APIs or interfaces
- Fixing bugs with user impact
- Changing configuration options

### Documentation Files

- `README.md` - Overview and quick start
- `INSTALL.md` - Installation guide
- `docs/ARCHITECTURE.md` - System design
- `docs/NGINX.md` - Reverse proxy setup
- `docs/TROUBLESHOOTING.md` - Common issues
- `docs/CONTRIBUTING.md` - This file

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Feature Requests**: Open a GitHub Issue
- **Security Issues**: Use private reporting

## License

By contributing to Scrapegoat, you agree that your contributions will be licensed under the project's MIT License.

## Related Documentation

- [INSTALL.md](../INSTALL.md) - Installation guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [NGINX.md](NGINX.md) - nginx configuration
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
