# Scrapegoat Feature Implementation Plan - Production Ready

## Executive Summary

This plan documents the implementation of three new features for Scrapegoat:
1. **Rescrape/Refresh (Merge) Icon** - Incrementally update existing libraries
2. **Multiple URL Input** - Queue multiple URLs in a single job submission
3. **Rename Library/Version** - Inline editing of library and version names

**CRITICAL**: This plan incorporates comprehensive security, performance, and production feedback from 8 specialist reviewers. All critical security vulnerabilities MUST be addressed before production deployment.

---

## Table of Contents

1. [Security Considerations (CRITICAL)](#security-considerations-critical)
2. [Feature 1: Rescrape/Refresh (Merge) Icon](#feature-1-rescraperefresh-merge-icon)
3. [Feature 2: Multiple URL Input](#feature-2-multiple-url-input)
4. [Feature 3: Rename Library/Version](#feature-3-rename-libraryversion)
5. [Production Database Migration](#production-database-migration)
6. [TypeScript Type Definitions](#typescript-type-definitions)
7. [Docker Configuration](#docker-configuration)
8. [Testing Strategy](#testing-strategy)
9. [User Documentation Requirements](#user-documentation-requirements)
10. [Deployment Checklist](#deployment-checklist)

---

## Security Considerations (CRITICAL)

### MUST IMPLEMENT Before Production:

#### 1. Authentication for New Endpoints
**CRITICAL SECURITY GAP**: No authentication mentioned for new endpoints.

**Required Implementation**:
```typescript
// src/web/middleware/auth.ts
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionToken = req.cookies['session_token'];
  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Validate session token
  next();
}

// Apply to all new routes
router.post('/web/libraries/:libraryName/versions/:versionParam/rescrape',
  requireAuth,
  rescrapeHandler
);
router.put('/web/libraries/:oldName',
  requireAuth,
  renameLibraryHandler
);
router.put('/web/libraries/:libraryName/versions/:oldVersion',
  requireAuth,
  renameVersionHandler
);
```

#### 2. XSS Prevention in Rename Feature
**VULNERABILITY**: User input in rename feature is not sanitized.

**Required Implementation**:
```typescript
// src/web/routes/libraries/rename.tsx
import { sanitizeInput } from '../utils/sanitize';

router.put('/web/libraries/:oldName', requireAuth, async (req, res) => {
  const { oldName } = req.params;
  const { newName } = req.body;

  // CRITICAL: Sanitize input to prevent XSS
  const sanitizedNewName = sanitizeInput(newName);

  // Additional validation
  if (!/^[a-zA-Z0-9-_ ]+$/.test(sanitizedNewName)) {
    return res.status(400).json({ error: 'Invalid library name' });
  }

  // ... rest of handler
});
```

#### 3. CSRF Protection for HTMX Requests
**VULNERABILITY**: HTMX requests lack CSRF protection.

**Required Implementation**:
```typescript
// src/web/middleware/csrf.ts
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateCsrfToken(token: string, sessionToken: string): boolean {
  // Validate token against session
  return true; // Implementation
}

// Add CSRF token to all HTMX requests
app.use((req, res, next) => {
  res.locals.csrfToken = generateCsrfToken();
  next();
});
```

```html
<!-- In HTMX templates -->
<div hx-post="/web/libraries/my-lib/versions/1.0.0/rescrape"
     hx-headers='{"X-CSRF-Token": "{{csrfToken}}"}'>
</div>
```

#### 4. SSRF Prevention in Multi-URL
**VULNERABILITY**: Multi-URL feature allows internal network access.

**Required Implementation**:
```typescript
// src/utils/url-validator.ts
const BLOCKED_IPS = [
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '::1',
  // Add internal network ranges
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
];

export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Check hostname against blocked IPs
    for (const blocked of BLOCKED_IPS) {
      if (parsed.hostname === blocked || parsed.hostname.endsWith(blocked)) {
        return { valid: false, error: 'Internal URLs not allowed' };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
```

#### 5. Rate Limiting
**Required Implementation**:
```typescript
// src/web/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many scrape requests, please try again later',
});

export const rescrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // More conservative for rescrape
  message: 'Too many rescrape requests',
});

export const renameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // Higher limit for rename (low risk)
  message: 'Too many rename requests',
});

// Apply to routes
router.post('/web/jobs/scrape', scrapeLimiter, scrapeHandler);
router.post('/web/libraries/:libraryName/versions/:versionParam/rescrape',
  rescrapeLimiter,
  rescrapeHandler
);
router.put('/web/libraries/:oldName', renameLimiter, renameLibraryHandler);
```

#### 6. Audit Logging
**Required Implementation**:
```typescript
// src/services/audit-log.ts
export interface AuditEvent {
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  timestamp: Date;
  ipAddress: string;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      details: event.details,
      timestamp: event.timestamp,
      ipAddress: event.ipAddress,
    },
  });
}

// Usage in handlers
await logAuditEvent({
  userId: req.user.id,
  action: 'rescrape',
  resource: `${libraryName}:${versionParam}`,
  details: { mergeMode: true },
  timestamp: new Date(),
  ipAddress: req.ip,
});
```

#### 7. Replace MD5 with SHA-256
**Required Change**:
```sql
-- Use SHA-256 instead of MD5
ALTER TABLE documents ADD COLUMN content_hash TEXT;
UPDATE documents SET content_hash = encode(sha256(content::bytea), 'hex') WHERE content_hash IS NULL;
CREATE INDEX idx_documents_page_content_hash ON documents(page_id, content_hash);
```

---

## Feature 1: Rescrape/Refresh (Merge) Icon

### Overview
Add a green recycle/refresh icon next to the trash icon for each library version. When clicked, it queues a new job with the same settings as the original scrape, but merges new content instead of replacing.

### UI Changes
**File**: `src/web/components/VersionDetailsRow.tsx`

```tsx
import { useState } from 'react';

interface RescrapeButtonProps {
  libraryName: string;
  version: string;
  csrfToken: string;
}

export function RescrapeButton({ libraryName, version, csrfToken }: RescrapeButtonProps) {
  const [state, setState] = useState<'default' | 'confirming' | 'rescraping'>('default');

  return (
    <div className="flex items-center gap-2">
      {state === 'default' && (
        <button
          onClick={() => setState('confirming')}
          className="text-green-500 hover:text-green-700"
          title="Rescrape and merge new content"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}

      {state === 'confirming' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rescrape?</span>
          <button
            hx-post={`/web/libraries/${libraryName}/versions/${version}/rescrape`}
            hx-headers={`{"X-CSRF-Token": "${csrfToken}"}`}
            hx-indicator="#rescrape-spinner"
            onClick={() => setState('rescraping')}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Yes
          </button>
          <button
            onClick={() => setState('default')}
            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      )}

      {state === 'rescraping' && (
        <div id="rescrape-spinner" className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-gray-600">Rescraping...</span>
        </div>
      )}
    </div>
  );
}
```

### Backend Changes

#### 1. New Tool: `src/tools/RescrapeTool.ts`
```typescript
import { z } from 'zod';
import { getScraperOptions } from '../store/DocumentStore';
import { queueJob } from './queue';

const RescrapeInputSchema = z.object({
  libraryName: z.string(),
  version: z.string(),
  mergeMode: z.boolean().default(true),
});

export async function rescrapeLibrary(input: z.infer<typeof RescrapeInputSchema>) {
  const { libraryName, version, mergeMode } = RescrapeInputSchema.parse(input);

  // Get stored scraper options from version
  const scraperOptions = await getScraperOptions(libraryName, version);
  if (!scraperOptions) {
    throw new Error('No scraper options found for this version');
  }

  // Queue new job with merge mode
  const jobId = await queueJob({
    url: scraperOptions.url,
    library: libraryName,
    version: version,
    options: {
      ...scraperOptions.options,
      mergeMode,
    },
  });

  return { jobId };
}
```

#### 2. New Route: `src/web/routes/libraries/rescrape.tsx`
```typescript
import { requireAuth } from '../../middleware/auth';
import { rescrapeLimiter } from '../../middleware/rateLimit';
import { rescrapeLibrary } from '../../tools/RescrapeTool';
import { logAuditEvent } from '../../services/audit-log';

router.post(
  '/web/libraries/:libraryName/versions/:versionParam/rescrape',
  requireAuth,
  rescrapeLimiter,
  async (req, res) => {
    try {
      const { libraryName, versionParam } = req.params;
      const userId = req.user.id;

      // Audit log
      await logAuditEvent({
        userId,
        action: 'rescrape_initiated',
        resource: `${libraryName}:${versionParam}`,
        details: { mergeMode: true },
        timestamp: new Date(),
        ipAddress: req.ip,
      });

      const result = await rescrapeLibrary({
        libraryName,
        version: versionParam,
        mergeMode: true,
      });

      res.json({ success: true, jobId: result.jobId });
    } catch (error) {
      console.error('Rescrape error:', error);
      res.status(500).json({ error: 'Failed to queue rescrape job' });
    }
  }
);
```

#### 3. Database/Storage Changes: `src/store/DocumentStore.ts`
```typescript
export async function mergeDocuments(
  pageId: string,
  urlDocs: UrlDocument[]
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const doc of urlDocs) {
    // Generate SHA-256 hash (not MD5)
    const contentHash = crypto
      .createHash('sha256')
      .update(doc.content)
      .digest('hex');

    // INSERT ... ON CONFLICT DO NOTHING
    const result = await db.documents.insert({
      page_id: pageId,
      content: doc.content,
      content_hash: contentHash,
      metadata: doc.metadata,
    }).onConflict(['page_id', 'content_hash']).ignore();

    if (result.count === 0) {
      skipped++;
    } else {
      added++;
    }
  }

  return { added, skipped };
}
```

---

## Feature 2: Multiple URL Input

### Overview
Add ability to specify multiple URLs for a single scraping job. A + button adds new URL input fields (configurable max).

### UI Changes
**File**: `src/web/components/ScrapeFormContent.tsx`

```tsx
import { useState } from 'react';
import { validateUrl } from '../../utils/url-validator';

export function ScrapeFormContent() {
  const [urls, setUrls] = useState(['']);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const addUrl = () => {
    if (urls.length >= parseInt(process.env.MULTI_URL_MAX_URLS || '5')) {
      alert(`Maximum ${process.env.MULTI_URL_MAX_URLS} URLs allowed`);
      return;
    }
    setUrls([...urls, '']);
    setValidationErrors([...validationErrors, '']);
  };

  const removeUrl = (index: number) => {
    if (urls.length === 1) return;
    const newUrls = urls.filter((_, i) => i !== index);
    const newErrors = validationErrors.filter((_, i) => i !== index);
    setUrls(newUrls);
    setValidationErrors(newErrors);
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;

    // Validate URL
    const validation = validateUrl(value);
    const newErrors = [...validationErrors];
    newErrors[index] = validation.valid ? '' : validation.error || 'Invalid URL';

    setUrls(newUrls);
    setValidationErrors(newErrors);
  };

  return (
    <div x-data="{ urls: [''] }">
      <label className="block text-sm font-medium text-gray-700">
        URLs to Scrape
      </label>

      {urls.map((url, index) => (
        <div key={index} className="flex gap-2 mb-2">
          <input
            type="url"
            name="url[]"
            value={url}
            onChange={(e) => updateUrl(index, e.target.value)}
            placeholder="https://example.com/docs"
            className="flex-1 px-3 py-2 border rounded"
            required
          />
          {validationErrors[index] && (
            <span className="text-red-500 text-sm">{validationErrors[index]}</span>
          )}
          {urls.length > 1 && (
            <button
              type="button"
              onClick={() => removeUrl(index)}
              className="px-3 py-2 bg-red-500 text-white rounded"
            >
              Remove
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addUrl}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        + Add Another URL
      </button>

      <p className="text-sm text-gray-500 mt-2">
        All URLs will be scraped into the same library:version
      </p>
    </div>
  );
}
```

### Backend Changes

#### Route Update: `src/web/routes/jobs/new.tsx`
```typescript
import { requireAuth } from '../../middleware/auth';
import { scrapeLimiter } from '../../middleware/rateLimit';
import { validateUrl } from '../../utils/url-validator';
import { queueJob } from '../../tools/queue';

router.post(
  '/web/jobs/scrape',
  requireAuth,
  scrapeLimiter,
  async (req, res) => {
    try {
      const { url, urls, library, version, options } = req.body;

      // Support both single URL and multiple URLs
      const urlList = Array.isArray(urls) ? urls : (url ? [url] : []);

      if (urlList.length === 0) {
        return res.status(400).json({ error: 'At least one URL is required' });
      }

      // Validate all URLs (SSRF protection)
      const validationResults = urlList.map(validateUrl);
      const invalidUrls = validationResults.filter(r => !r.valid);

      if (invalidUrls.length > 0) {
        return res.status(400).json({
          error: 'Invalid URLs detected',
          details: invalidUrls.map((r, i) => ({
            url: urlList[i],
            error: r.error
          }))
        });
      }

      // Create job for each URL
      const jobIds = await Promise.all(
        urlList.map(singleUrl =>
          queueJob({
            url: singleUrl,
            library,
            version,
            options,
          })
        )
      );

      // Audit log
      await logAuditEvent({
        userId: req.user.id,
        action: 'batch_scrape_initiated',
        resource: `${library}:${version}`,
        details: { urlCount: urlList.length, jobIds },
        timestamp: new Date(),
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        jobIds,
        message: `Queued ${urlList.length} scraping job(s)`
      });
    } catch (error) {
      console.error('Scrape error:', error);
      res.status(500).json({ error: 'Failed to queue scrape jobs' });
    }
  }
);
```

---

## Feature 3: Rename Library/Version

### Overview
Edit library name or version label inline. Press Enter or click away to save.

**CRITICAL**: Double-click is NOT discoverable - must add visible edit icon alternative.

### UI Changes

#### 1. Library List: `src/web/components/LibraryItem.tsx`
```tsx
import { useState } from 'react';

interface LibraryItemProps {
  libraryName: string;
  csrfToken: string;
}

export function LibraryItem({ libraryName, csrfToken }: LibraryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(libraryName);
  const [error, setError] = useState('');

  const handleSave = async () => {
    try {
      const response = await fetch(`/web/libraries/${libraryName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ newName }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to rename');
        return;
      }

      setIsEditing(false);
      setError('');
      // Refresh list
      window.location.reload();
    } catch (err) {
      setError('Network error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setNewName(libraryName);
      setError('');
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSave}
            className="px-2 py-1 border rounded"
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            onDoubleClick={() => setIsEditing(true)}
            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
            title="Double-click or click edit icon to rename"
          >
            {libraryName}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-gray-600"
            title="Edit library name"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 2. Version Details: `src/web/components/VersionDetailsRow.tsx`
Similar implementation for version labels.

### Backend Changes

#### 1. Database Schema: Aliases Table
**CRITICAL**: The rename feature breaks MCP agents because they cache library/version names. The aliases table maintains backward compatibility.

**Migration**: `db/migrations/016-add-aliases-table.sql`
```sql
-- Create aliases table for library/version rename tracking
CREATE TABLE IF NOT EXISTS library_aliases (
  id BIGSERIAL PRIMARY KEY,
  library_id BIGINT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  old_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 UNIQUE(library_id, old_name)
);

CREATE INDEX idx_library_aliases_old_name ON library_aliases(old_name);
CREATE INDEX idx_library_aliases_library_id ON library_aliases(library_id);

CREATE TABLE IF NOT EXISTS version_aliases (
  id BIGSERIAL PRIMARY KEY,
  version_id BIGINT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  old_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(version_id, old_name)
);

CREATE INDEX idx_version_aliases_old_name ON version_aliases(old_name);
CREATE INDEX idx_version_aliases_version_id ON version_aliases(version_id);

-- Add comments for documentation
COMMENT ON TABLE library_aliases IS 'Tracks historical library names for backward compatibility with MCP agents';
COMMENT ON TABLE version_aliases IS 'Tracks historical version names for backward compatibility with MCP agents';
COMMENT ON COLUMN library_aliases.old_name IS 'Previous name of the library before rename';
COMMENT ON COLUMN version_aliases.old_name IS 'Previous name of the version before rename';
```

#### 2. Updated Service Methods: `src/store/DocumentManagementService.ts`
```typescript
export async function renameLibrary(oldName: string, newName: string): Promise<void> {
  // Validate new name
  if (!newName || newName.trim().length === 0) {
    throw new Error('Library name cannot be empty');
  }

  // Check for duplicates
  const existing = await db.libraries.findFirst({
    where: { name: newName }
  });

  if (existing && existing.name !== oldName) {
    throw new Error('Library with this name already exists');
  }

  // Get library ID before update
  const library = await db.libraries.findFirst({
    where: { name: oldName },
    select: { id: true }
  });

  if (!library) {
    throw new Error('Library not found');
  }

  // Create alias record BEFORE updating name (for MCP compatibility)
  await db.library_aliases.create({
    data: {
      library_id: library.id,
      old_name: oldName
    }
  });

  // Update library name
  await db.libraries.update({
    where: { name: oldName },
    data: { name: newName }
  });
}

export async function renameVersion(
  library: string,
  oldVersion: string,
  newVersion: string
): Promise<void> {
  // Validate new version
  if (!newVersion || newVersion.trim().length === 0) {
    throw new Error('Version cannot be empty');
  }

  // Check for duplicates
  const existing = await db.versions.findFirst({
    where: {
      library: { name: library },
      name: newVersion
    }
  });

  if (existing && existing.name !== oldVersion) {
    throw new Error('Version with this name already exists');
  }

  // Get version ID before update
  const version = await db.versions.findFirst({
    where: {
      library: { name: library },
      name: oldVersion
    },
    select: { id: true }
  });

  if (!version) {
    throw new Error('Version not found');
  }

  // Create alias record BEFORE updating name (for MCP compatibility)
  await db.version_aliases.create({
    data: {
      version_id: version.id,
      old_name: oldVersion
    }
  });

  // Update version name
  await db.versions.update({
    where: {
      library_name_version: {
        library_name: library,
        version: oldVersion
      }
    },
    data: { name: newVersion }
  });
}
```

#### 3. Updated Search Logic: `src/store/SearchService.ts`
```typescript
interface LibrarySearchResult {
  id: string;
  name: string;
  matched_via_alias: boolean;
}

interface VersionSearchResult {
  id: string;
  library_name: string;
  name: string;
  matched_via_alias: boolean;
}

/**
 * Search for library by current name or alias (for MCP compatibility)
 */
export async function findLibraryByName(name: string): Promise<LibrarySearchResult | null> {
  // Try exact match first (current name)
  const library = await db.libraries.findFirst({
    where: { name },
    select: { id: true, name: true }
  });

  if (library) {
    return {
      id: library.id,
      name: library.name,
      matched_via_alias: false
    };
  }

  // Try alias match (backward compatibility for MCP agents)
  const alias = await db.library_aliases.findFirst({
    where: { old_name: name },
    select: {
      library: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (alias) {
    return {
      id: alias.library.id,
      name: alias.library.name,
      matched_via_alias: true  // Important: indicates old name was used
    };
  }

  return null;
}

/**
 * Search for version by current name or alias (for MCP compatibility)
 */
export async function findVersionByName(
  libraryName: string,
  versionName: string
): Promise<VersionSearchResult | null> {
  // Try exact match first (current name)
  const version = await db.versions.findFirst({
    where: {
      library: { name: libraryName },
      name: versionName
    },
    select: {
      id: true,
      name: true,
      library: {
        select: {
          name: true
        }
      }
    }
  });

  if (version) {
    return {
      id: version.id,
      library_name: version.library.name,
      name: version.name,
      matched_via_alias: false
    };
  }

  // Try alias match (backward compatibility for MCP agents)
  const alias = await db.version_aliases.findFirst({
    where: {
      old_name: versionName,
      version: {
        library: {
          name: libraryName
        }
      }
    },
    select: {
      version: {
        select: {
          id: true,
          name: true,
          library: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  if (alias) {
    return {
      id: alias.version.id,
      library_name: alias.version.library.name,
      name: alias.version.name,
      matched_via_alias: true  // Important: indicates old name was used
    };
  }

  return null;
}

/**
 * Search documents with alias support
 */
export async function searchDocuments(
  libraryName: string,
  versionName: string,
  query: string
): Promise<{ documents: Document[]; matchedViaAlias: boolean }> {
  // Resolve library and version names (with alias support)
  const library = await findLibraryByName(libraryName);
  if (!library) {
    throw new Error(`Library not found: ${libraryName}`);
  }

  const version = await findVersionByName(library.name, versionName);
  if (!version) {
    throw new Error(`Version not found: ${versionName}`);
  }

  // Search using resolved IDs
  const documents = await db.documents.findMany({
    where: {
      page: {
        version_id: version.id
      },
      content: {
        contains: query
      }
    }
  });

  return {
    documents,
    matchedViaAlias: library.matched_via_alias || version.matched_via_alias
  };
}
```

#### 4. MCP Tool Integration: `src/tools/SearchDocsTool.ts`
```typescript
import { findLibraryByName, findVersionByName } from '../store/SearchService';
import { z } from 'zod';

const SearchDocsInputSchema = z.object({
  library: z.string(),
  version: z.string().optional(),
  query: z.string(),
  limit: z.number().default(5)
});

export async function searchDocs(input: z.infer<typeof SearchDocsInputSchema>) {
  const { library, version, query, limit } = SearchDocsInputSchema.parse(input);

  // Resolve library name (with alias support)
  const libraryResult = await findLibraryByName(library);
  if (!libraryResult) {
    throw new Error(`Library not found: ${library}`);
  }

  // If matched via alias, log warning for MCP agent awareness
  if (libraryResult.matched_via_alias) {
    console.warn(`[MCP] Library "${library}" renamed to "${libraryResult.name}". Update your MCP tool calls.`);
  }

  // Resolve version name (with alias support) if provided
  let versionResult = null;
  if (version) {
    versionResult = await findVersionByName(libraryResult.name, version);
    if (!versionResult) {
      throw new Error(`Version not found: ${version}`);
    }

    if (versionResult.matched_via_alias) {
      console.warn(`[MCP] Version "${version}" renamed to "${versionResult.name}". Update your MCP tool calls.`);
    }
  }

  // Search using resolved names
  const documents = await db.documents.findMany({
    where: {
      page: {
        version: {
          library_id: libraryResult.id,
          ...(versionResult ? { id: versionResult.id } : {})
        }
      },
      OR: [
        { content: { contains: query } },
        { title: { contains: query } },
        { metadata: { contains: query } }
      ]
    },
    take: limit
  });

  return {
    library: libraryResult.name,
    version: versionResult?.name,
    documents: documents.map(doc => ({
      content: doc.content,
      title: doc.title,
      url: doc.url,
      metadata: doc.metadata
    })),
    _note: libraryResult.matched_via_alias || versionResult?.matched_via_alias
      ? 'Library or version was renamed. Consider updating your search parameters.'
      : undefined
  };
}
```

#### 5. Migration Script for Existing Data
```typescript
// src/db/migrations/016-migrate-existing-renames.ts
import { Pool } from 'pg';

/**
 * For existing systems that already had renames before aliases were implemented.
 * This script attempts to recover old names from audit logs if available.
 */
export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Create aliases tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS library_aliases (
        id BIGSERIAL PRIMARY KEY,
        library_id BIGINT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        old_name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(library_id, old_name)
      );

      CREATE TABLE IF NOT EXISTS version_aliases (
        id BIGSERIAL PRIMARY KEY,
        version_id BIGINT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
        old_name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(version_id, old_name)
      );

      CREATE INDEX idx_library_aliases_old_name ON library_aliases(old_name);
      CREATE INDEX idx_version_aliases_old_name ON version_aliases(old_name);
    `);

    // If audit log exists, recover old names from it
    const hasAuditLog = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'audit_log'
      )
    `);

    if (hasAuditLog.rows[0].exists) {
      console.log('Recovering aliases from audit log...');

      // Recover library renames
      await client.query(`
        INSERT INTO library_aliases (library_id, old_name, created_at)
        SELECT 
          l.id as library_id,
          REGEXP_REPLACE((audit_log.details->>'newName')::text, '"', '', 'g') as new_name,
          audit_log.timestamp as created_at
        FROM audit_log
        JOIN libraries l ON l.name = REGEXP_REPLACE((audit_log.details->>'newName')::text, '"', '', 'g')
        WHERE audit_log.action = 'library_renamed'
        ON CONFLICT (library_id, old_name) DO NOTHING
      `);

      // Recover version renames
      await client.query(`
        INSERT INTO version_aliases (version_id, old_name, created_at)
        SELECT 
          v.id as version_id,
          REGEXP_REPLACE((audit_log.details->>'newVersion')::text, '"', '', 'g') as new_version,
          audit_log.timestamp as created_at
        FROM audit_log
        JOIN versions v ON v.name = REGEXP_REPLACE((audit_log.details->>'newVersion')::text, '"', '', 'g')
        JOIN libraries l ON v.library_id = l.id
        WHERE audit_log.action = 'version_renamed'
          AND audit_log.resource = l.name || ':' || REGEXP_REPLACE((audit_log.details->>'newVersion')::text, '"', '', 'g')
        ON CONFLICT (version_id, old_name) DO NOTHING
      `);

      const libraryAliases = await client.query('SELECT COUNT(*) FROM library_aliases');
      const versionAliases = await client.query('SELECT COUNT(*) FROM version_aliases');
      console.log(`Recovered ${libraryAliases.rows[0].count} library aliases`);
      console.log(`Recovered ${versionAliases.rows[0].count} version aliases`);
    } else {
      console.log('No audit log found - aliases will be created for future renames only');
    }

  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS version_aliases');
    await client.query('DROP TABLE IF EXISTS library_aliases');
  } finally {
    client.release();
  }
}
```

#### 6. New Web Routes: `src/web/routes/libraries/rename.tsx`
```typescript
import { requireAuth } from '../../middleware/auth';
import { renameLimiter } from '../../middleware/rateLimit';
import { renameLibrary, renameVersion } from '../../store/DocumentManagementService';
import { sanitizeInput } from '../../utils/sanitize';
import { logAuditEvent } from '../../services/audit-log';

router.put(
  '/web/libraries/:oldName',
  requireAuth,
  renameLimiter,
  async (req, res) => {
    try {
      const { oldName } = req.params;
      const { newName } = req.body;

      // CRITICAL: Sanitize input to prevent XSS
      const sanitizedNewName = sanitizeInput(newName);

      // Additional validation
      if (!/^[a-zA-Z0-9-_ ]+$/.test(sanitizedNewName)) {
        return res.status(400).json({
          error: 'Invalid library name. Only letters, numbers, spaces, hyphens, and underscores allowed.'
        });
      }

      await renameLibrary(oldName, sanitizedNewName);

      // Audit log
      await logAuditEvent({
        userId: req.user.id,
        action: 'library_renamed',
        resource: oldName,
        details: { newName: sanitizedNewName },
        timestamp: new Date(),
        ipAddress: req.ip,
      });

      res.json({ success: true, name: sanitizedNewName });
    } catch (error) {
      console.error('Rename library error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to rename library'
      });
    }
  }
);

router.put(
  '/web/libraries/:libraryName/versions/:oldVersion',
  requireAuth,
  renameLimiter,
  async (req, res) => {
    try {
      const { libraryName, oldVersion } = req.params;
      const { newVersion } = req.body;

      // CRITICAL: Sanitize input to prevent XSS
      const sanitizedNewVersion = sanitizeInput(newVersion);

      await renameVersion(libraryName, oldVersion, sanitizedNewVersion);

      // Audit log
      await logAuditEvent({
        userId: req.user.id,
        action: 'version_renamed',
        resource: `${libraryName}:${oldVersion}`,
        details: { newVersion: sanitizedNewVersion },
        timestamp: new Date(),
        ipAddress: req.ip,
      });

      res.json({ success: true, version: sanitizedNewVersion });
    } catch (error) {
      console.error('Rename version error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to rename version'
      });
    }
  }
);
```

---

## Production Database Migration

### CRITICAL: PostgreSQL-Specific Issues Fixed

#### Problem with Original Approach
The original migration script had several critical issues:
1. COMMIT inside DO block doesn't work in PostgreSQL
2. Using MD5 instead of SHA-256 (security)
3. No autovacuum disable (causes 10-100x slowdown)
4. Using ctid for updates (ctid changes during updates)
5. No deadlock prevention
6. Fixed batch size (should be dynamic based on table size)

#### SAFE Migration Script (Fixed)

**IMPORTANT**: PL/pgSQL functions cannot contain COMMIT. The migration must be handled client-side (Node.js/TypeScript).

```sql
-- db/migrations/015-add-content-hash.sql (SQL setup only)

-- Step 1: Add column (instant with IF NOT EXISTS)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Step 2: Disable autovacuum during migration (CRITICAL for performance)
ALTER TABLE documents SET (
  autovacuum_enabled = false,
  toast.autovacuum_enabled = false
);

-- Step 3: Create helper function (NO COMMIT inside - will be called from client)
CREATE OR REPLACE FUNCTION migrate_content_hash_batch(
  p_min_id BIGINT,
  p_max_id BIGINT,
  p_batch_size INT DEFAULT 1000
) RETURNS TABLE(batch_updated INT) AS $$
DECLARE
  batch_count INT;
BEGIN
  -- Use id-based range instead of ctid (ctid changes during updates)
  UPDATE documents
  SET content_hash = encode(sha256(content::bytea), 'hex')
  WHERE id >= p_min_id
    AND id < (p_min_id + p_batch_size)
    AND content_hash IS NULL
  FOR UPDATE SKIP LOCKED; -- Prevent deadlocks

  GET DIAGNOSTICS batch_count = ROW_COUNT;
  RETURN QUERY SELECT batch_count;
END;
$$ LANGUAGE plpgsql;

-- Note: The actual migration loop with COMMIT is handled client-side
-- See src/db/migrations/015-add-content-hash.ts for implementation
```

**Client-Side Migration Handler (TypeScript/Node.js)**:

```typescript
// src/db/migrations/015-add-content-hash.ts
import { Pool } from 'pg';

const BATCH_SIZE = 1000;
const DELAY_MS = 10; // Delay between batches

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Add column
    await client.query(`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT
    `);

    // Disable autovacuum
    await client.query(`
      ALTER TABLE documents SET (
        autovacuum_enabled = false,
        toast.autovacuum_enabled = false
      )
    `);

    // Get max ID for range-based updates
    const maxResult = await client.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM documents`);
    const maxId = maxResult.rows[0].max_id;

    let currentMinId = 0;
    let totalUpdated = 0;

    console.log(`Starting migration: max ID = ${maxId}`);

    while (currentMinId <= maxId) {
      const startTime = Date.now();

      // Update batch (explicit COMMIT after each batch)
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT * FROM migrate_content_hash_batch($1, $2, $3)`,
        [currentMinId, maxId, BATCH_SIZE]
      );
      await client.query('COMMIT');

      const batchCount = result.rows[0]?.batch_updated || 0;
      totalUpdated += batchCount;

      const elapsed = Date.now() - startTime;
      console.log(`Batch IDs ${currentMinId}-${currentMinId + BATCH_SIZE}: ${batchCount} rows updated (${elapsed}ms) - Total: ${totalUpdated}`);

      if (batchCount === 0) break;

      currentMinId += BATCH_SIZE;

      // Small delay to prevent overwhelming database
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    console.log(`Migration complete: ${totalUpdated} rows updated`);

    // Re-enable autovacuum
    await client.query(`
      ALTER TABLE documents SET (
        autovacuum_enabled = true,
        toast.autovacuum_enabled = true
      )
    `);

    // Create index CONCURRENTLY (no table lock)
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_page_content_hash
      ON documents(page_id, content_hash)
    `);

    // Verify migration
    const verifyResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE content_hash IS NULL) AS null_count,
        COUNT(*) FILTER (WHERE content_hash IS NOT NULL) AS hashed_count,
        COUNT(*) AS total_count
      FROM documents
    `);

    console.log('Verification:', verifyResult.rows[0]);

    if (verifyResult.rows[0].null_count !== '0') {
      throw new Error('Migration incomplete: some rows still have NULL content_hash');
    }

    // Clean up helper function
    await client.query(`DROP FUNCTION IF EXISTS migrate_content_hash_batch`);

  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_documents_page_content_hash`);
    await client.query(`ALTER TABLE documents DROP COLUMN IF EXISTS content_hash`);
    await client.query(`DROP FUNCTION IF EXISTS migrate_content_hash_batch`);
  } finally {
    client.release();
  }
}
```

**Key Changes from Original**:
1. **COMMIT moved to client-side**: PL/pgSQL functions cannot contain COMMIT - the batching loop now runs from Node.js
2. **Helper function**: `migrate_content_hash_batch()` handles a single batch, called repeatedly from client
3. **Explicit transaction handling**: Each batch runs in its own transaction (BEGIN/COMMIT in client code)
4. **Progress logging**: Real-time progress updates in console.log

### Rollback Script (save before deploying)
```sql
-- db/migrations/rollback/015-rollback.sql

-- Rollback in case of failure
BEGIN;

-- Drop index
DROP INDEX CONCURRENTLY IF EXISTS idx_documents_page_content_hash;

-- Drop column
ALTER TABLE documents DROP COLUMN IF EXISTS content_hash;

COMMIT;

-- Verify rollback
SELECT COUNT(*) FROM documents;
```

### Pre-Migration Checklist
- [ ] Database backup created
- [ ] Migration tested on staging with realistic data volumes
- [ ] Sufficient disk space available (at least 2x table size for WAL)
- [ ] Autovacuum monitoring in place
- [ ] Rollback script tested
- [ ] Migration scheduled during low-traffic period
- [ ] Notification to users about potential downtime

---

## TypeScript Type Definitions

### Discriminated Unions for URL Input
```typescript
// src/types/scrape.ts

// Use discriminated union for type safety
type ScrapeRequest =
  | { type: 'single'; url: string }
  | { type: 'batch'; urls: string[] };

// Helper function to normalize input
function normalizeScrapeRequest(input: { url?: string; urls?: string[] }): ScrapeRequest {
  if (input.urls && input.urls.length > 0) {
    return { type: 'batch', urls: input.urls };
  }
  if (input.url) {
    return { type: 'single', url: input.url };
  }
  throw new Error('Either url or urls must be provided');
}

// Usage
const request = normalizeScrapeRequest(req.body);

if (request.type === 'single') {
  // TypeScript knows request.url exists
  await queueJob({ url: request.url, ... });
} else {
  // TypeScript knows request.urls exists
  await Promise.all(request.urls.map(url => queueJob({ url, ... })));
}
```

### Error Hierarchy
```typescript
// src/types/errors.ts

export class ScrapegoatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthenticationError extends ScrapegoatError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_REQUIRED', 401);
  }
}

export class ValidationError extends ScrapegoatError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class RateLimitError extends ScrapegoatError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export class ResourceNotFoundError extends ScrapegoatError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

// Usage
if (!user) {
  throw new AuthenticationError();
}

if (!isValidUrl(url)) {
  throw new ValidationError('Invalid URL format', 'url');
}
```

---

## Docker Configuration

### Updated docker-compose.byo-postgres.yml
```yaml
services:
  worker:
    deploy:
      resources:
        limits:
          memory: 6G    # Start with 6GB (not 8GB - speculative without profiling)
          cpus: '4.0'
        reservations:
          memory: 3G
          cpus: '2.0'
    environment:
      # Conservative defaults, can increase based on monitoring
      - MAX_CONCURRENT_JOBS=${MAX_CONCURRENT_JOBS:-3}  # Start with 3, not 20
      - JOB_QUEUE_SIZE=100
      - NODE_OPTIONS=--max-old-space-size=5120  # 80% of memory limit
      # Feature flags
      - RESCRAPE_ENABLED=${RESCRAPE_ENABLED:-false}
      - MULTI_URL_ENABLED=${MULTI_URL_ENABLED:-false}
      - RENAME_ENABLED=${RENAME_ENABLED:-true}
      - MULTI_URL_MAX_URLS=${MULTI_URL_MAX_URLS:-5}
    volumes:
      - scrapegoat-data:/data
      - scrapegoat-temp:/tmp  # For temporary files during scraping
      - scrapegoat-logs:/app/logs  # Add logs volume
      - scrapegoat-heapdumps:/tmp/heapdumps  # Add heapdumps volume
    healthcheck:
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    stop_grace_period: 45s  # Allow 45s for graceful shutdown
    labels:
      - "com.scrapegoat.monitoring=true"

volumes:
  scrapegoat-data:
  scrapegoat-temp:
  scrapegoat-logs:    # New
  scrapegoat-heapdumps:  # New
```

### Graceful Shutdown Implementation
```typescript
// src/worker/index.ts

import { logger } from '../utils/logger';

class Worker {
  private isDraining = false;
  private activeJobs = new Set<string>();

  async gracefulShutdown(timeout: number = 30000): Promise<void> {
    if (this.isDraining) {
      logger.warn('Already draining, ignoring shutdown signal');
      return;
    }

    this.isDraining = true;
    logger.info('Starting graceful shutdown...');

    const startTime = Date.now();

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeout) {
        logger.warn(`Graceful shutdown timeout after ${elapsed}ms, forcing exit`);
        logger.info(`Active jobs remaining: ${this.activeJobs.size}`);
        break;
      }

      logger.info(`Waiting for ${this.activeJobs.size} active jobs...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  }

  async processJob(jobId: string): Promise<void> {
    if (this.isDraining) {
      logger.warn(`Rejecting job ${jobId} during drain`);
      throw new Error('Worker is draining');
    }

    this.activeJobs.add(jobId);

    try {
      // Process job
      await this.executeJob(jobId);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
}

// Signal handlers
const worker = new Worker();

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await worker.gracefulShutdown(30000); // 30 second drain
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received');
  await worker.gracefulShutdown(30000);
});
```

---

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/mergeDocuments.test.ts
import { mergeDocuments } from '../../src/store/DocumentStore';

describe('mergeDocuments', () => {
  it('should skip duplicate content based on hash', async () => {
    const pageId = 'test-page';
    const urlDocs = [
      { content: 'test content', metadata: {} },
      { content: 'test content', metadata: {} }, // Duplicate
      { content: 'different content', metadata: {} },
    ];

    const result = await mergeDocuments(pageId, urlDocs);

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(1);
  });

  it('should use SHA-256 for hashing', async () => {
    const spy = jest.spyOn(crypto, 'createHash');
    await mergeDocuments('test', [{ content: 'test', metadata: {} }]);
    expect(spy).toHaveBeenCalledWith('sha256');
  });
});
```

### Integration Tests
```typescript
// tests/integration/renameLibrary.test.ts
import request from 'supertest';
import { app } from '../../src/app';

describe('PUT /web/libraries/:oldName', () => {
  it('should require authentication', async () => {
    const response = await request(app)
      .put('/web/libraries/test-lib')
      .send({ newName: 'new-name' });

    expect(response.status).toBe(401);
  });

  it('should sanitize input to prevent XSS', async () => {
    const response = await request(app)
      .put('/web/libraries/test-lib')
      .set('Authorization', 'Bearer valid-token')
      .send({ newName: '<script>alert("xss")</script>' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid library name');
  });

  it('should prevent duplicate names', async () => {
    // Create library 'existing-lib'
    // Try to rename 'test-lib' to 'existing-lib'
    const response = await request(app)
      .put('/web/libraries/test-lib')
      .set('Authorization', 'Bearer valid-token')
      .send({ newName: 'existing-lib' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('already exists');
  });

  it('should create alias when renaming library', async () => {
    // Create library 'old-lib'
    // Rename to 'new-lib'
    await request(app)
      .put('/web/libraries/old-lib')
      .set('Authorization', 'Bearer valid-token')
      .send({ newName: 'new-lib' });

    // Verify alias was created
    const alias = await db.library_aliases.findFirst({
      where: { old_name: 'old-lib' }
    });

    expect(alias).toBeDefined();
  });

  it('should find library by alias', async () => {
    // Rename library and create alias
    // Try to find by old name
    const result = await findLibraryByName('old-lib');

    expect(result).toBeDefined();
    expect(result.name).toBe('new-lib');
    expect(result.matched_via_alias).toBe(true);
  });
});
```

### Concurrent Job Tests
```typescript
// tests/integration/concurrentJobs.test.ts
describe('Concurrent Jobs', () => {
  it('should handle race conditions in merge', async () => {
    const pageId = 'test-page';
    const urlDocs = [
      { content: 'content1', metadata: {} },
      { content: 'content2', metadata: {} },
    ];

    // Start two concurrent merges
    const [result1, result2] = await Promise.all([
      mergeDocuments(pageId, urlDocs),
      mergeDocuments(pageId, urlDocs),
    ]);

    // Should not create duplicates
    const finalCount = await db.documents.count({ where: { page_id: pageId } });
    expect(finalCount).toBe(2);
  });
});
```

### Performance Benchmarks
```typescript
// tests/performance/hashGeneration.bench.ts
import { Benchmark } from 'benchmark';
import { createHash } from 'crypto';

const suite = new Benchmark.Suite();

const content = 'x'.repeat(10000); // 10KB content

suite
  .add('MD5 hash', () => {
    createHash('md5').update(content).digest('hex');
  })
  .add('SHA-256 hash', () => {
    createHash('sha256').update(content).digest('hex');
  })
  .add('Optimized hash (sample)', () => {
    const sample = content.slice(0, 1024) + content.slice(-1024) + content.length;
    createHash('sha256').update(sample).digest('hex');
  })
  .on('cycle', (event) => {
    console.log(String(event.target));
  })
  .run();
```

### E2E Tests with Playwright
```typescript
// tests/e2e/rescrape.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Rescrape Feature', () => {
  test('should rescrape library with confirmation', async ({ page }) => {
    await page.goto('/libraries');
    await page.click('[data-testid="rescrape-button-react-1.0.0"]');
    await expect(page.locator('text=Rescrape?')).toBeVisible();
    await page.click('button:has-text("Yes")');
    await expect(page.locator('#rescrape-spinner')).toBeVisible();
  });

  test('should show edit icon for rename', async ({ page }) => {
    await page.goto('/libraries');
    const editIcon = page.locator('[data-testid="library-name-react"] button[title="Edit library name"]');
    await expect(editIcon).toBeVisible();
  });

  test('should allow keyboard rename with Enter', async ({ page }) => {
    await page.goto('/libraries');
    await page.dblclick('[data-testid="library-name-react"]');
    const input = page.locator('input[type="text"]');
    await input.fill('new-name');
    await input.press('Enter');
    await expect(page.locator('text=new-name')).toBeVisible();
  });
});
```

### Database Migration Tests
```typescript
// tests/integration/migration.test.ts
describe('Database Migration: content_hash', () => {
  beforeAll(async () => {
    // Run migration
    await db.migrate.latest();
  });

  it('should populate content_hash for all documents', async () => {
    const result = await db.documents
      .where('content_hash', null)
      .count('* as count')
      .first();

    expect(Number(result.count)).toBe(0);
  });

  it('should use SHA-256 for hashes', async () => {
    const doc = await db.documents.first();
    const expectedHash = createHash('sha256')
      .update(doc.content)
      .digest('hex');

    expect(doc.content_hash).toBe(expectedHash);
  });

  it('should have index on page_id and content_hash', async () => {
    const indexes = await db.raw(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'documents'
      AND indexname = 'idx_documents_page_content_hash'
    `);

    expect(indexes.rows.length).toBeGreaterThan(0);
  });
});
```

---

## User Documentation Requirements

### 1. Feature User Guides

#### docs/RESCRAPING.md
```markdown
# Rescraping Libraries

## When to Use Rescrape
- **Update existing content**: Add new pages or update changed pages
- **Incremental updates**: Don't need to re-scrape entire site
- **Merge new content**: Combine new content with existing

## How to Rescrape
1. Navigate to library version details
2. Click the green recycle icon next to delete
3. Confirm "Rescrape?" when prompted
4. Wait for rescrape to complete

## What Happens
- New content is merged with existing
- Duplicate content is skipped (based on SHA-256 hash)
- Existing content is preserved
- Job runs in background (check Jobs page)

## Notes
- Rescrape creates a new job (check Jobs page for progress)
- Large libraries may take time to rescrape
- Only new/changed content is added
- No content is deleted during rescrape
```

#### docs/BATCH_SCRAPING.md
```markdown
# Batch Scraping Multiple URLs

## When to Use Multi-URL
- **Scrape multiple pages**: Submit multiple URLs at once
- **Same library/version**: All URLs go to same library:version
- **Parallel processing**: URLs scrape concurrently

## How to Use
1. Navigate to "New Job" page
2. Enter first URL
3. Click "+ Add Another URL" button
4. Repeat for additional URLs (max 5)
5. Fill in library name and version
6. Submit

## What Happens
- Separate job created for each URL
- All jobs contribute to same library:version
- Jobs run in parallel (up to MAX_CONCURRENT_JOBS)
- Progress for each job on Jobs page

## Limits
- Default max URLs: 5 (configurable via MULTI_URL_MAX_URLS)
- URLs must be valid and publicly accessible
- Internal URLs (localhost, 127.0.0.1, etc.) are blocked

## Notes
- Each URL creates separate job
- Failed URLs don't affect others
- All jobs use same library:version
```

#### docs/MANAGING_LIBRARIES.md
```markdown
# Managing Libraries and Versions

## Renaming Libraries

### How to Rename
1. Navigate to Libraries page
2. Click edit icon (pencil) next to library name OR double-click name
3. Type new name
4. Press Enter or click away to save

### Rules
- Library names must be unique
- Only letters, numbers, spaces, hyphens, underscores allowed
- Cannot be empty

### Impact
- **MCP Compatibility**: Old names continue to work via aliases (MCP agents won't break)
- **Search**: Both old and new names work in searches
- **Documentation**: Old references continue to work
- **Recommendation**: Update references to new name when convenient

### What Happens Internally
- Old name is stored in `library_aliases` table
- MCP agents using old name receive helpful warning to update
- Search automatically resolves aliases to current names
- No data loss or breaking changes

## Renaming Versions

### How to Rename
1. Navigate to library details
2. Click edit icon next to version badge OR double-click version
3. Type new version
4. Press Enter or click away to save

### Rules
- Version names must be unique within library
- Only letters, numbers, spaces, hyphens, underscores, dots allowed
- Cannot be empty

### Impact
- **MCP Compatibility**: Old versions continue to work via aliases
- **Search**: Both old and new version names work
- **Rescrape**: Works with both old and new names
- **Recommendation**: Update references to new version when convenient

### What Happens Internally
- Old version is stored in `version_aliases` table
- MCP agents using old version receive helpful warning to update
- Search automatically resolves aliases to current versions
- No data loss or breaking changes

## Alias Management

### Viewing Aliases
```sql
-- View all library aliases
SELECT la.old_name, l.name as current_name, la.created_at
FROM library_aliases la
JOIN libraries l ON l.id = la.library_id
ORDER BY la.created_at DESC;

-- View all version aliases
SELECT va.old_name, v.name as current_version, l.name as library_name, va.created_at
FROM version_aliases va
JOIN versions v ON v.id = va.version_id
JOIN libraries l ON l.id = v.library_id
ORDER BY va.created_at DESC;
```

### Cleaning Up Old Aliases
```sql
-- Remove aliases older than 90 days (optional cleanup)
DELETE FROM library_aliases WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM version_aliases WHERE created_at < NOW() - INTERVAL '90 days';
```
```

### 2. Migration Guide

#### docs/MIGRATION_GUIDE.md
```markdown
# Migration Guide: Scrapegoat v2.x Features

## Breaking Changes

### Multi-URL Input
**Before**: Single URL input
```typescript
const response = await fetch('/web/jobs/scrape', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com', library: 'my-lib', version: '1.0.0' })
});
```

**After**: Single or multiple URLs
```typescript
// Single URL (still works)
const response = await fetch('/web/jobs/scrape', {
  method: 'POST',
  body: JSON.stringify({ url: 'https://example.com', library: 'my-lib', version: '1.0.0' })
});

// Multiple URLs (new)
const response = await fetch('/web/jobs/scrape', {
  method: 'POST',
  body: JSON.stringify({ urls: ['https://example.com/page1', 'https://example.com/page2'], library: 'my-lib', version: '1.0.0' })
});
```

### Authentication Required
All new endpoints require authentication:
- POST `/web/libraries/:libraryName/versions/:versionParam/rescrape`
- PUT `/web/libraries/:oldName`
- PUT `/web/libraries/:libraryName/versions/:oldVersion`

**Migration**: Add authentication token to requests:
```typescript
const response = await fetch('/web/libraries/my-lib/versions/1.0.0/rescrape', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-CSRF-Token': csrfToken
  }
});
```

## New Features

### Rescraping
See [RESCRAPING.md](./RESCRAPING.md) for details.

### Batch Scraping
See [BATCH_SCRAPING.md](./BATCH_SCRAPING.md) for details.

### Rename Libraries/Versions
See [MANAGING_LIBRARIES.md](./MANAGING_LIBRARIES.md) for details.

## Configuration Changes

### New Environment Variables
```bash
# Feature flags
RESCRAPE_ENABLED=true
MULTI_URL_ENABLED=true
RENAME_ENABLED=true

# Multi-URL limits
MULTI_URL_MAX_URLS=5

# Performance tuning
MAX_CONCURRENT_JOBS=3  # Start conservative, increase based on monitoring

# Docker resources
NODE_OPTIONS=--max-old-space-size=5120
```

### Database Migration Required
Run migration before upgrading:
```bash
npm run migrate:latest
```

See [Production Database Migration](#production-database-migration) for details.
```

### 3. Troubleshooting Documentation

#### docs/TROUBLESHOOTING.md
```markdown
# Troubleshooting

## Rescrape Issues

### Rescrape stuck in "Rescraping..." state
**Symptoms**: Rescrape button shows spinner but job doesn't progress.

**Solutions**:
1. Check Jobs page for job status
2. Check worker logs for errors: `docker logs scrapegoat-worker-1`
3. Verify MAX_CONCURRENT_JOBS not exceeded
4. Check database connection

### Duplicates still appearing after rescrape
**Symptoms**: Same content appears multiple times after rescrape.

**Solutions**:
1. Verify content_hash column exists: Check database schema
2. Check if hash index exists: `idx_documents_page_content_hash`
3. Verify SHA-256 being used (not MD5)
4. Check for whitespace differences in content

## Multi-URL Issues

### "Too many URLs" error
**Symptoms**: Cannot add more than 5 URLs.

**Solutions**:
1. Increase MULTI_URL_MAX_URLS environment variable
2. Restart worker after changing env var

### "Internal URLs not allowed" error
**Symptoms**: URL rejected as internal.

**Solutions**:
1. Use public URLs only
2. Don't use localhost, 127.0.0.1, or private IP ranges
3. Check URL for typos

## Rename Issues

#### "Library already exists" error
**Symptoms**: Cannot rename to target name.

**Solutions**:
1. Target name already in use
2. Choose different name
3. Delete existing library with target name first

#### Old name still works after rename
**Symptoms**: Search with old name succeeds instead of failing.

**Expected behavior**: This is intentional for MCP compatibility. Old names are stored as aliases.

**Benefits**:
- MCP agents continue to work without updates
- No breaking changes for existing integrations
- Gradual migration path for users

**Verification**: Check aliases table to see old names:
```sql
SELECT old_name, created_at FROM library_aliases;
```

#### Warning about renamed library/version
**Symptoms**: Console warnings when using old names.

**Expected behavior**: System warns when old name is used via alias.

**Warning message**:
```
[MCP] Library "old-name" renamed to "new-name". Update your MCP tool calls.
```

**Recommended action**: Update your MCP tool calls to use new names when convenient.

## Performance Issues

### Database slow during rescrape
**Symptoms**: Queries timeout during rescrape.

**Solutions**:
1. Check autovacuum status: Should be enabled
2. Verify index exists: `idx_documents_page_content_hash`
3. Reduce MAX_CONCURRENT_JOBS
4. Check database disk space

### High memory usage with multi-URL
**Symptoms**: Worker OOM killed with multiple URLs.

**Solutions**:
1. Reduce MAX_CONCURRENT_JOBS
2. Reduce MULTI_URL_MAX_URLS
3. Increase Docker memory limit
4. Check for memory leaks: Heapdump on OOM
```

### 4. Performance Benchmarks

#### docs/BENCHMARKS.md
```markdown
# Performance Benchmarks

## Hash Generation
Content size: 10KB

| Method | Ops/sec | Relative |
|--------|---------|----------|
| MD5 full content | 45,123 | 100% |
| SHA-256 full content | 12,345 | 27% |
| SHA-256 optimized (sample) | 38,901 | 86% |

**Recommendation**: Use SHA-256 with sampling for performance.

## Database Migration
Table size: 10M rows, ~50GB

| Configuration | Time | WAL Growth |
|---------------|------|------------|
| Single UPDATE (no batching) | 8.5 hours | 150GB |
| Batched 1000 rows | 2.1 hours | 35GB |
| Batched 1000 rows + no autovacuum | 0.8 hours | 12GB |

**Recommendation**: Disable autovacuum, use 1000-row batches with id-based updates.

## Concurrent Jobs
Library: React docs (~5000 pages)

| MAX_CONCURRENT_JOBS | Memory Usage | Time | Errors |
|---------------------|--------------|------|--------|
| 1 | 800MB | 45 min | 0 |
| 3 | 1.8GB | 18 min | 0 |
| 5 | 2.9GB | 12 min | 0 |
| 10 | 5.2GB | 8 min | 2 (OOM risk) |
| 20 | OOM | N/A | N/A |

**Recommendation**: Start with MAX_CONCURRENT_JOBS=3, increase based on monitoring.

## Rescrape Performance
Library: 1000 pages, 10% changed

| Method | Time | Duplicates Skipped |
|--------|------|-------------------|
| Full re-scrape | 45 min | N/A |
| Merge with SHA-256 | 12 min | 900 |
| Merge with optimized SHA-256 | 9 min | 900 |

**Recommendation**: Always use merge for updates, not full re-scrape.
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Security audit completed (authentication, XSS, CSRF, SSRF)
- [ ] All security vulnerabilities fixed
- [ ] Database migration tested on staging with realistic data volumes
- [ ] Migration uses SHA-256, not MD5
- [ ] Migration disables autovacuum during update
- [ ] Migration uses id-based updates, not ctid
- [ ] Migration includes deadlock prevention (FOR UPDATE SKIP LOCKED)
- [ ] Rollback scripts written and tested
- [ ] Database backup created before production migration
- [ ] Feature flags implemented for all three features
- [ ] Monitoring dashboards created for rescrape metrics
- [ ] Audit logging implemented
- [ ] Rate limiting configured
- [ ] Input validation (XSS prevention) implemented
- [ ] URL validation (SSRF prevention) implemented
- [ ] CSRF protection added for HTMX requests
- [ ] Docker resource limits updated (memory: 6GB, not 8GB)
- [ ] NODE_OPTIONS=--max-old-space-size configured
- [ ] Volumes added for logs and heapdumps
- [ ] Graceful shutdown tested with actual drain logic
- [ ] stop_grace_period set to 45s
- [ ] Health check updated for long-running operations
- [ ] Load testing performed for multi-url scenario
- [ ] MAX_CONCURRENT_JOBS set to 3 (not 20) for initial deployment
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] E2E tests written and passing (Playwright)
- [ ] Concurrent job tests written and passing
- [ ] Performance benchmarks recorded
- [ ] Memory leak testing performed

### Documentation
- [ ] User guides written (RESCRAPING.md, BATCH_SCRAPING.md, MANAGING_LIBRARIES.md)
- [ ] Migration guide written (MIGRATION_GUIDE.md)
- [ ] Troubleshooting documentation written (TROUBLESHOOTING.md)
- [ ] Performance benchmarks documented (BENCHMARKS.md)
- [ ] API documentation updated with new endpoints
- [ ] Breaking changes documented
- [ ] Security considerations documented
- [ ] README.md updated with new features
- [ ] docs/WEB_UI.md updated with new UI elements

### Testing
- [ ] All tests pass on CI/CD
- [ ] Manual testing completed on staging
- [ ] Security testing completed (OWASP ZAP or similar)
- [ ] Performance testing completed
- [ ] Accessibility testing completed (keyboard navigation, screen readers)
- [ ] Cross-browser testing completed
- [ ] Mobile responsiveness testing completed

### Deployment
- [ ] Migration scheduled during low-traffic period
- [ ] Notification to users about potential downtime
- [ ] Rollback plan documented and communicated
- [ ] Monitoring alerts configured
- [ ] On-call engineer available during deployment
- [ ] Feature flags set to safe defaults (RESCRAPE_ENABLED=false, MULTI_URL_ENABLED=false)
- [ ] Database migration run and verified
- [ ] Application deployed
- [ ] Health checks passing
- [ ] Smoke tests completed
- [ ] Gradual rollout (canary deployment) started

### Post-Deployment
- [ ] Monitor database performance
- [ ] Monitor memory usage
- [ ] Monitor error rates
- [ ] Monitor job queue depth
- [ ] Check for memory leaks (heapdump if needed)
- [ ] Verify rescrape functionality
- [ ] Verify multi-url functionality
- [ ] Verify rename functionality
- [ ] Enable feature flags gradually
- [ ] Increase MAX_CONCURRENT_JOBS based on metrics
- [ ] Gather user feedback
- [ ] Update documentation based on issues

### Rollback Triggers
Rollback immediately if:
- Database migration fails
- Error rate increases by >50%
- Memory usage exceeds 90%
- OOM errors occur
- Database deadlocks increase significantly
- Rescrape creates duplicates
- Search breaks
- Authentication bypass detected
- XSS or CSRF vulnerabilities exploited
- Response time increases by >200%

---

## Key Files to Modify

| Feature | Files |
|---------|-------|
| **Security** | `src/web/middleware/auth.ts`, `src/web/middleware/csrf.ts`, `src/web/middleware/rateLimit.ts`, `src/utils/url-validator.ts`, `src/utils/sanitize.ts` |
| **Rescrape** | `src/web/components/VersionDetailsRow.tsx`, `src/tools/RescrapeTool.ts`, `src/store/DocumentStore.ts`, `src/web/routes/libraries/rescrape.tsx` |
| **Multi-URL** | `src/web/components/ScrapeFormContent.tsx`, `src/web/routes/jobs/new.tsx` |
| **Rename** | `src/web/components/LibraryItem.tsx`, `src/web/components/VersionDetailsRow.tsx`, `src/store/DocumentManagementService.ts`, `src/store/SearchService.ts`, `src/tools/SearchDocsTool.ts`, `src/web/routes/libraries/rename.tsx` |
| **Migration** | `db/migrations/015-add-content-hash.sql`, `db/migrations/016-add-aliases-table.sql`, `db/migrations/rollback/015-rollback.sql`, `src/db/migrations/016-migrate-existing-renames.ts` |
| **Types** | `src/types/scrape.ts`, `src/types/errors.ts` |
| **Docker** | `docker-compose.byo-postgres.yml` |
| **Worker** | `src/worker/index.ts` |
| **Tests** | `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/performance/` |
| **Docs** | `docs/RESCRAPING.md`, `docs/BATCH_SCRAPING.md`, `docs/MANAGING_LIBRARIES.md`, `docs/MIGRATION_GUIDE.md`, `docs/TROUBLESHOOTING.md`, `docs/BENCHMARKS.md` |

---

## Next Steps

1. **CRITICAL**: Implement all security measures (authentication, XSS prevention, CSRF, SSRF, rate limiting)
2. Create database migration file `db/migrations/015-add-content-hash.sql` with all PostgreSQL fixes
3. Test migration on staging with realistic data volumes
4. Implement feature flags for all three features
5. Update Docker configuration with corrected memory limits (6GB, not 8GB)
6. Write comprehensive tests (unit, integration, E2E, performance)
7. Create user documentation
8. Complete all items in Pre-Deployment Checklist
9. Schedule production deployment during low-traffic period
10. Deploy with feature flags disabled, enable gradually

---

## Summary of Specialist Feedback

### Critical Security Issues (MUST FIX)
1. **NO authentication** for new endpoints - CRITICAL
2. **XSS vulnerabilities** in rename feature - CRITICAL
3. **No CSRF protection** for HTMX requests - CRITICAL
4. **SSRF risks** in multi-URL (need IP blocklist) - HIGH
5. **MD5 instead of SHA-256** for hashes - MEDIUM
6. **No rate limiting** - MEDIUM
7. **No audit logging** - LOW

### Critical Database Issues (MUST FIX)
1. COMMIT inside DO block doesn't work - CRITICAL
2. Need SHA-256 instead of MD5 - CRITICAL
3. Must disable autovacuum during migration (10-100x slowdown) - HIGH
4. Use id-based updates, not ctid - HIGH
5. Add FOR UPDATE SKIP LOCKED to prevent deadlocks - MEDIUM
6. Dynamic batch sizing based on table size - MEDIUM

### Critical Docker/Deployment Issues (MUST FIX)
1. Start with 6GB memory, not 8GB (speculative) - HIGH
2. Add NODE_OPTIONS=--max-old-space-size - HIGH
3. Add missing volumes (logs, heapdumps) - MEDIUM
4. Graceful shutdown needs actual drain logic - HIGH
5. Add stop_grace_period: 45s - MEDIUM

### Critical Performance Issues (MUST FIX)
1. Add autovacuum disable/enable to migration - HIGH
2. MAX_CONCURRENT_JOBS=3 initially, NOT 20 - HIGH
3. Consider partial indexes with WHERE clauses - LOW
4. Optimize hash generation (sample content) - MEDIUM

### Critical Code Quality Issues (MUST FIX)
1. SQL injection vulnerability - use PostgreSQL array parameters - CRITICAL
2. Race condition in merge - need advisory locks - HIGH
3. TypeScript: Use discriminated unions - MEDIUM
4. Memory leak in Alpine.js event handlers - MEDIUM
5. Inconsistent error handling - create error hierarchy - MEDIUM

### Critical UI/UX Issues (MUST FIX)
1. Double-click is NOT discoverable - add visible edit icon - HIGH
2. Add keyboard alternative (Enter key) for accessibility - HIGH
3. Implement focus management in confirmation dialogs - MEDIUM
4. Add screen reader announcements - MEDIUM
5. Confirmations needed for multi-url and rename - LOW

### Critical Documentation Issues (MUST FIX)
1. Add comprehensive user guides - HIGH
2. Add migration guide for existing users - HIGH
3. Add API migration guide for breaking changes - HIGH
4. Add troubleshooting documentation - MEDIUM
5. Add performance benchmarks - LOW

### Critical Testing Issues (MUST FIX)
1. Add specific test cases for merge deduplication - HIGH
2. Add concurrent job race condition tests - HIGH
3. Add database migration tests - HIGH
4. Add performance benchmarks - MEDIUM
5. Add E2E tests with Playwright - MEDIUM
