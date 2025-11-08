/**
 * Fetch URL command - Fetches a URL and converts its content to Markdown.
 */

import type { Command } from "commander";
import { AutoDetectFetcher } from "../../scraper/fetcher";
import type { FetcherType } from "../../scraper/fetcher/types";
import { analytics, TelemetryEvent } from "../../telemetry";
import { FetchUrlTool } from "../../tools";
import { parseHeaders } from "../utils";

export async function fetchUrlAction(
  url: string,
  options: { followRedirects: boolean; fetcher?: FetcherType; header: string[] },
) {
  await analytics.track(TelemetryEvent.CLI_COMMAND, {
    command: "fetch-url",
    url,
    fetcher: options.fetcher,
    followRedirects: options.followRedirects,
    hasHeaders: options.header.length > 0,
  });

  const headers = parseHeaders(options.header);
  const fetchUrlTool = new FetchUrlTool(new AutoDetectFetcher());

  const content = await fetchUrlTool.execute({
    url,
    followRedirects: options.followRedirects,
    fetcher: options.fetcher,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  console.log(content);
}

export function createFetchUrlCommand(program: Command): Command {
  return program
    .command("fetch-url <url>")
    .description("Fetch a URL and convert its content to Markdown")
    .option(
      "--no-follow-redirects",
      "Disable following HTTP redirects (default: follow redirects)",
    )
    .option(
      "--fetcher <type>",
      "Explicit fetcher selection: 'auto', 'http', 'crawl4ai', or 'file' (default: auto)",
      (value: string): FetcherType => {
        const validFetchers: FetcherType[] = ["auto", "http", "crawl4ai", "file"];
        if (!validFetchers.includes(value as FetcherType)) {
          console.warn(`Warning: Invalid fetcher type '${value}'. Using default 'auto'.`);
          return "auto";
        }
        return value as FetcherType;
      },
    )
    .option(
      "--header <name:value>",
      "Custom HTTP header to send with the request (can be specified multiple times)",
      (val: string, prev: string[] = []) => prev.concat([val]),
      [] as string[],
    )
    .action(fetchUrlAction);
}
