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
  library: string;
  versions: Version[];
}

export interface Version {
  id: number;
  ref: { library: string; version: string | null };
  status: string;
  progress?: { pages: number; maxPages: number };
  counts: { documents: number; uniqueUrls: number };
  indexedAt: string | null;
  sourceUrl?: string | null;
}

export interface SearchResult {
  url: string;
  content: string;
  score: number | null;
}

export interface EnqueueJobInput {
  library: string;
  version?: string | null;
  options: {
    url: string;
    library: string;
    version: string;
    maxPages?: number;
    maxDepth?: number;
    scope?: "subpages" | "hostname" | "domain";
    followRedirects?: boolean;
    ignoreErrors?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    headers?: Record<string, string>;
    fetcher?: "auto" | "http" | "crawl4ai" | "file";
  };
}
