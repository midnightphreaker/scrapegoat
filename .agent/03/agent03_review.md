# Agent 03 — Store Test Assertion Failures Review

## Issue 1: `src/store/applyMigrations.test.ts` — Migration count mismatch

### Investigation
- **Test**: "should track applied migrations in _schema_migrations table"
- **Error**: `AssertionError: expected [...] to have a length of 4 but got 5`
- **Root Cause**: A 5th migration file `004-fix-schema-mismatch.sql` was added to `db/migrations/`, but the test still asserted `toHaveLength(4)`. The test also didn't include the new migration in its `arrayContaining` assertion.
- **Files**: `src/store/applyMigrations.test.ts` (lines 206-214)

### Fix
- Added `"004-fix-schema-mismatch.sql"` to the `expect.arrayContaining([...])` list
- Changed `expect(appliedIds).toHaveLength(4)` → `expect(appliedIds).toHaveLength(5)`

### Test Results
- Before: 1 failure (7/8 passed)
- After: 8/8 passed

---

## Issue 2: `src/store/assembly/strategies/HierarchicalAssemblyStrategy.test.ts` — JSON path comparison failure

### Investigation
- **Test**: "selectChunks > should reconstruct complete hierarchy for single match"
- **Error**: `AssertionError: expected [...] to include '  export class UserService {'`
- **Root Cause**: Four methods in `DocumentStore.ts` (`findParentChunk`, `findChildChunks`, `findPrecedingSiblingChunks`, `findSubsequentSiblingChunks`) used PostgreSQL text comparison `(d.metadata)::jsonb->>'path' = $N` to match JSON array paths. This is fragile because:
  - PostgreSQL's `jsonb ->>` operator returns text with its own formatting (e.g., `["UserManagement", "UserService"]` — spaces after colons/commas)
  - Node.js `JSON.stringify()` produces compact output (e.g., `["UserManagement","UserService"]` — no spaces)
  - The text representations didn't match, so parent/child/sibling lookups silently returned `null`
  - This caused `HierarchicalAssemblyStrategy.selectChunks()` to fail to reconstruct the full hierarchy, missing the intermediate `UserService` class chunk

### Fix
Changed all four methods in `src/store/DocumentStore.ts` to use proper jsonb comparison operators:

1. **`findParentChunk`** (line ~1639): `(d.metadata)::jsonb->>'path' = $4` → `(d.metadata)::jsonb->'path' = $4::jsonb`
2. **`findChildChunks`** (line ~1479): `(d.metadata)::jsonb->>'path' LIKE $5 || '%'` → `(d.metadata)::jsonb->'path' @> $5::jsonb`
3. **`findPrecedingSiblingChunks`** (line ~1530): `(d.metadata)::jsonb->>'path' = $5` → `(d.metadata)::jsonb->'path' = $5::jsonb`
4. **`findSubsequentSiblingChunks`** (line ~1582): `(d.metadata)::jsonb->>'path' = $5` → `(d.metadata)::jsonb->'path' = $5::jsonb`

The `->` operator returns jsonb (not text), and comparing with `$N::jsonb` casts the parameter to jsonb, making the comparison format-agnostic.

For `findChildChunks`, the `LIKE` prefix match was replaced with `@>` (jsonb containment), which checks that the child's path starts with the parent's path elements. Combined with the existing `jsonb_array_length` constraint ensuring exactly one more path element, this correctly finds direct children.

### Test Results
- Before: 1 failure (11/12 passed)
- After: 12/12 passed

---

## Final Verification

```
npm run lint — passed (313 files, no issues)
npm run typecheck — passed
npm run build — passed
npx vitest run src/store/applyMigrations.test.ts — 8/8 passed
npx vitest run src/store/assembly/strategies/HierarchicalAssemblyStrategy.test.ts — 12/12 passed
Combined final run — 20/20 tests passed
```
