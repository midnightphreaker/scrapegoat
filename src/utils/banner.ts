/**
 * ASCII art banner for console startup display.
 * Uses ANSI colors: gray (dim) top line, bright white bottom line.
 */
export const BANNER = [
  "\x1b[97mPHrK.org's\x1b[0m",
  "\x1b[90m ▄▄▄▄  ▄▄▄▄ ▄▄▄▄   ▄▄▄  ▄▄▄▄  ▄▄▄▄▄  ▄▄▄▄  ▄▄▄   ▄▄▄ ▄▄▄▄▄▄ \x1b[0m",
  "\x1b[97m███▄▄ ██▀▀▀ ██▄█▄ ██▀██ ██▄█▀ ██▄▄  ██ ▄▄ ██▀██ ██▀██  ██   \x1b[0m",
  "\x1b[90m▄▄██▀ ▀████ ██ ██ ██▀██ ██    ██▄▄▄ ▀███▀ ▀███▀ ██▀██  ██    \x1b[0m",
  "\x1b[90m                                                                \x1b[0m",
  "\x1b[90m      an opinionated fork of Grounded.Tools docs-mcp-server     \x1b[0m",
  "\x1b[90m                                      thank You grounded <3    \x1b[0m",
].join("\n");

/**
 * Prints the startup banner to console.
 * Only call this for HTTP server startup, not stdio mode.
 */
export function printBanner(): void {
  console.log(); // Blank line before banner
  console.log(BANNER);
  console.log(); // Blank line after banner
}
