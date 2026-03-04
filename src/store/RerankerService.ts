import type { RerankerConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export interface RerankResult {
  index: number;
  relevanceScore: number;
  document: { text: string };
}

export interface RerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
    document: { text: string };
  }>;
}

export class RerankerService {
  private config: RerankerConfig;
  private initialized = false;

  constructor(config: RerankerConfig) {
    this.config = config;
  }

  isReady(): boolean {
    return this.config.enabled && this.config.baseURL !== undefined && this.initialized;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled || !this.config.baseURL || !this.config.model) {
      logger.info("Reranker disabled or not configured");
      return;
    }

    logger.info(`Initializing reranker service at ${this.config.baseURL}`);
    this.initialized = true;
    logger.info("Reranker service initialized successfully");
  }

  async rerank(
    query: string,
    documents: string[],
    topN: number,
  ): Promise<RerankResult[]> {
    if (!this.isReady()) {
      throw new Error("Reranker service not ready");
    }

    throw new Error("Not implemented yet");
  }
}
