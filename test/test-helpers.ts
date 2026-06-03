
import fs from "node:fs";
import path from "node:path";

/**
 * Returns the command and arguments to run the CLI.
 * Prefers the built 'dist/index.js' if available for faster execution.
 * Falls back to 'npx vite-node src/index.ts' for development.
 */
export function getCliCommand(): { cmd: string; args: string[] } {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const distEntry = path.join(projectRoot, "dist", "index.js");

  // Check if dist/index.js exists
  if (fs.existsSync(distEntry)) {
    return { cmd: "node", args: [distEntry] };
  }

  // Fallback to vite-node
  const srcEntry = path.join(projectRoot, "src", "index.ts");
  return { cmd: "npx", args: ["vite-node", srcEntry] };
}

/**
 * Resolves the PostgreSQL base connection URL for tests.
 *
 * Resolution order:
 * 1. `DATABASE_URL` or `SCRAPEGOAT_DB_URL` environment variable (explicit URL)
 * 2. Constructed from individual `SCRAPEGOAT_DB_*` component env vars
 * 3. Throws if neither source is available
 *
 * Callers should ensure `dotenv.config()` has been called first if using `.env`.
 */
export function resolvePgBaseUrl(): string {
  const explicitUrl =
    process.env.DATABASE_URL ||
    process.env.SCRAPEGOAT_DB_URL ||
    process.env.SCRAPEGOAT_DATABASE_URL;

  if (explicitUrl) {
    return explicitUrl;
  }

  const user = process.env.SCRAPEGOAT_DB_USER;
  const password = process.env.SCRAPEGOAT_DB_PASSWORD;
  const host = process.env.SCRAPEGOAT_DB_HOST_ADDRESS;
  const port = process.env.SCRAPEGOAT_DB_HOST_PORT;
  const name = process.env.SCRAPEGOAT_DB_NAME;

  if (user && password && host && port && name) {
    return `postgresql://${user}:${password}@${host}:${port}/${name}`;
  }

  throw new Error(
    "No database URL configured for tests. Set DATABASE_URL or SCRAPEGOAT_DB_* components in .env",
  );
}
