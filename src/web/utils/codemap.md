# src/web/utils/

## Responsibility
Client-facing version comparison utilities for the ScrapeGoat update notification system.

## Design

**versionCheck.ts** — Pure functions for semantic version parsing and comparison.
- `normalizeVersionTag(input)` — Strips `v`/`V` prefix, validates non-empty string input. Returns `null` for invalid input.
- `extractComparableSegments(version)` — Splits version on `.` (ignoring `+`/`-` build metadata), parses each segment as integer. Returns `null` if any segment is non-numeric.
- `isVersionNewer(latestVersion, currentVersion)` — Returns `true` only when latest is strictly greater than current. Compares segment-by-segment, treating missing segments as `0`. Returns `false` for equal or invalid inputs.
- `getComparableVersion(input)` — Normalizes and strips build metadata, returning the base version string.
- `fallbackReleaseLabel(input)` — Produces a `vX.Y.Z` display label from raw input.

All functions are defensive: they accept `unknown` input, return `null` for invalid values, and never throw.

## Flow
1. `main.client.ts` fetches GitHub Releases API → gets `tag_name`.
2. `isVersionNewer(tag_name, currentVersion)` determines if an update is available.
3. `fallbackReleaseLabel(tag_name)` produces the display string if `tag_name` isn't directly usable.

## Integration
- Consumed by: `src/web/main.client.ts` (version update Alpine component)
- Depends on: None (pure utility, no external dependencies)
