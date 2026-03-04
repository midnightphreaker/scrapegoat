import type { Document } from "@langchain/core/documents";
import { logger } from "../utils/logger.js";
import { createContentAssemblyStrategy } from "./assembly/ContentAssemblyStrategyFactory";
import type { DocumentStore } from "./DocumentStore";
import type { RerankerService } from "./RerankerService.js";
import type { StoreSearchResult } from "./types";

export class DocumentRetrieverService {
  private documentStore: DocumentStore;
  private reranker?: RerankerService;

  constructor(documentStore: DocumentStore, reranker?: RerankerService) {
    this.documentStore = documentStore;
    this.reranker = reranker;
  }

  /**
   * Searches for documents and expands the context around the matches using content-type-aware strategies.
   * @param library The library name.
   * @param version The library version.
   * @param query The search query.
   * @param limit The optional limit for the initial search results.
   * @returns An array of search results with content assembled according to content type.
   */
  async search(
    library: string,
    version: string | null | undefined,
    query: string,
    limit?: number,
  ): Promise<StoreSearchResult[]> {
    // Normalize version: null/undefined becomes empty string, then lowercase
    const normalizedVersion = (version ?? "").toLowerCase();
    const requestedLimit = limit ?? 10;

    // Determine retrieval multiplier based on reranker availability
    const retrieveLimit = this.reranker?.isReady() ? requestedLimit * 3 : requestedLimit;

    const initialResults = await this.documentStore.findByContent(
      library,
      normalizedVersion,
      query,
      retrieveLimit,
    );

    if (initialResults.length === 0) {
      return [];
    }

    // Apply reranking if available and we retrieved more documents
    if (this.reranker?.isReady() && initialResults.length > requestedLimit) {
      try {
        // Extract document texts for reranking
        const documents = initialResults.map((result) => result.pageContent);

        // Rerank documents
        const rerankedResults = await this.reranker.rerank(
          query,
          documents,
          requestedLimit,
        );

        // Map reranked results back to original documents with updated scores
        const rerankedDocuments = rerankedResults.map((result) => {
          const originalDoc = initialResults[result.index];
          // Update the score with the reranked relevance score
          return new Document({
            id: originalDoc.id,
            pageContent: originalDoc.pageContent,
            metadata: {
              ...originalDoc.metadata,
              score: result.relevanceScore,
              reranked: true,
            },
          });
        });

        // Replace initialResults with reranked documents
        initialResults.length = 0;
        initialResults.push(...rerankedDocuments);
      } catch (error) {
        logger.warn("Reranking failed, returning original order", error);
        // Continue with original results, sliced to requested limit
      }
    }

    // Group initial results by URL
    const resultsByUrl = this.groupResultsByUrl(initialResults);

    // Process each URL group with appropriate strategy
    const results: StoreSearchResult[] = [];
    for (const [url, urlResults] of resultsByUrl.entries()) {
      const result = await this.processUrlGroup(
        library,
        normalizedVersion,
        url,
        urlResults,
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Groups search results by URL.
   */
  private groupResultsByUrl(results: Document[]): Map<string, Document[]> {
    const resultsByUrl = new Map<string, Document[]>();

    for (const result of results) {
      const url = result.metadata.url as string;
      if (!resultsByUrl.has(url)) {
        resultsByUrl.set(url, []);
      }
      const urlResults = resultsByUrl.get(url);
      if (urlResults) {
        urlResults.push(result);
      }
    }

    return resultsByUrl;
  }

  /**
   * Processes a group of search results from the same URL using appropriate strategy.
   */
  private async processUrlGroup(
    library: string,
    version: string,
    url: string,
    initialChunks: Document[],
  ): Promise<StoreSearchResult> {
    // Extract mimeType from the first document's metadata
    const mimeType =
      initialChunks.length > 0
        ? (initialChunks[0]?.metadata.mimeType as string | undefined)
        : undefined;

    // Find the maximum score from the initial results
    const maxScore = Math.max(
      ...initialChunks.map((chunk) => chunk.metadata.score as number),
    );

    // Create appropriate assembly strategy based on content type
    const strategy = createContentAssemblyStrategy(mimeType);

    // Use strategy to select and assemble chunks
    const selectedChunks = await strategy.selectChunks(
      library,
      version,
      initialChunks,
      this.documentStore,
    );

    const content = strategy.assembleContent(selectedChunks);

    return {
      url,
      content,
      score: maxScore,
      mimeType,
    };
  }
}
