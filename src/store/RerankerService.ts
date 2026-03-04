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

    if (documents.length === 0 || topN <= 0) {
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseURL}/rerank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          query,
          documents,
          top_n: Math.min(topN, documents.length),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`Reranker returned ${response.status}, using original order`);
        return documents.slice(0, topN).map((doc, idx) => ({
          index: idx,
          relevanceScore: 0.5,
          document: { text: doc },
        }));
      }

      const data: RerankResponse = await response.json();

      return data.results.map((result) => ({
        index: result.index,
        relevanceScore: result.relevance_score,
        document: result.document,
      }));
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.warn(`Reranker timeout after ${this.config.timeout}ms, using original order`);
        } else {
          logger.warn(`Reranker failed: ${error.message}, using original order`);
        }
      }

      return documents.slice(0, topN).map((doc, idx) => ({
        index: idx,
        relevanceScore: 0.5,
        document: { text: doc },
      }));
    }
  }
}
