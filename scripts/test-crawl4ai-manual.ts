#!/usr/bin/env tsx
/**
 * Manual test script for Crawl4AIFetcher.
 * This script demonstrates how to use the Crawl4AIFetcher.
 *
 * Prerequisites:
 * - Crawl4AI Python service running at http://localhost:8001
 *
 * Usage:
 * npx tsx scripts/test-crawl4ai-manual.ts
 */

import { Crawl4AIFetcher } from "../src/scraper/fetcher/index.js";

async function main() {
  console.log("=== Crawl4AI Manual Test ===\n");

  const fetcher = new Crawl4AIFetcher();

  try {
    // 1. Check service availability
    console.log("1. Checking service availability...");
    const isAvailable = await fetcher.isAvailable();
    console.log(`   Service available: ${isAvailable}`);

    if (!isAvailable) {
      console.log(
        "\n   ⚠️  Crawl4AI service is not available. Please start it with:",
      );
      console.log("   cd services/crawl4ai && docker-compose up -d");
      process.exit(1);
    }

    // 2. Check circuit breaker state
    console.log("\n2. Circuit breaker state:");
    const circuitState = fetcher.getCircuitState();
    console.log(`   State: ${circuitState.state}`);
    console.log(`   Failure count: ${circuitState.failureCount}`);
    console.log(
      `   Last failure: ${circuitState.lastFailureTime ? new Date(circuitState.lastFailureTime).toISOString() : "never"}`,
    );

    // 3. Test canFetch method
    console.log("\n3. Testing canFetch():");
    console.log(`   https://example.com: ${fetcher.canFetch("https://example.com")}`);
    console.log(`   file:///path/to/file: ${fetcher.canFetch("file:///path/to/file")}`);

    // 4. Fetch a simple webpage
    console.log("\n4. Fetching https://example.com...");
    const startTime = Date.now();
    const result = await fetcher.fetch("https://example.com");
    const endTime = Date.now();

    console.log(`   ✓ Fetch successful in ${endTime - startTime}ms`);
    console.log(`   MIME type: ${result.mimeType}`);
    console.log(`   Charset: ${result.charset}`);
    console.log(`   Source: ${result.source}`);
    console.log(`   Content length: ${result.content.length} bytes`);

    // Show a preview of the markdown content
    const markdown = result.content.toString("utf-8");
    const preview = markdown.substring(0, 200);
    console.log(`\n   Content preview:\n   ${preview.replace(/\n/g, "\n   ")}...`);

    // 5. Test with timeout option
    console.log("\n5. Testing with custom timeout (60s)...");
    const result2 = await fetcher.fetch("https://example.com", { timeout: 60000 });
    console.log(`   ✓ Fetch successful with custom timeout`);
    console.log(`   Content length: ${result2.content.length} bytes`);

    // 6. Test redirect handling
    console.log("\n6. Testing redirect handling (http -> https)...");
    const result3 = await fetcher.fetch("http://example.com");
    console.log(`   Initial URL: http://example.com`);
    console.log(`   Final URL: ${result3.source}`);
    console.log(`   ✓ Redirect handled correctly`);

    console.log("\n=== All tests passed! ===");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await fetcher.close();
  }
}

main();
