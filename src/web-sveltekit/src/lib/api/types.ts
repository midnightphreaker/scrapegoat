export interface Job {
  id: string;
  library: string;
  version: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: { pages: number; totalPages: number } | null;
  error: string | null;
  createdAt: string;
  sourceUrl: string;
}

export interface Library {
  name: string;
  versions: Version[];
}

export interface Version {
  version: string;
  status: string;
  documentCount: number;
  uniqueUrlCount: number;
  indexedAt: string | null;
  sourceUrl: string | null;
}

export interface SearchResult {
  url: string;
  content: string;
  score: number | null;
}

export interface EnqueueJobInput {
  url: string;
  library: string;
  version?: string | null;
  options?: {
    maxPages?: number;
    maxDepth?: number;
    scope?: "subpages" | "hostname" | "domain";
    followRedirects?: boolean;
    ignoreErrors?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    headers?: Record<string, string>;
  };
}
