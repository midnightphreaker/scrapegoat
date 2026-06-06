import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Docker Compose local upload staging", () => {
  it.each(["docker-compose.yml", "docker-compose.postgres.yml"])(
    "%s shares local upload staging between web and worker",
    (composeFile) => {
      const content = readFileSync(composeFile, "utf8");

      expect(content).toContain("SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE: filesystem");
      expect(content).toContain(
        "SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH: /data/staging",
      );
      expect(content.match(/scrapegoat-staging:\/data\/staging/g)).toHaveLength(2);
      expect(content).toContain("scrapegoat-staging:\n    name: scrapegoat-staging");
    },
  );
});
