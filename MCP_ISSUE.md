# MCP Tool Schema Validation Issue

**Date**: 2025-11-12
**Status**: 🔴 BLOCKING - MCP tools not loading in haxxcode
**Severity**: High - Prevents all Scrapegoat tools from being used

## Summary

Scrapegoat MCP server successfully connects to haxxcode but fails during tool discovery with schema validation errors. All 9 tools are rejected because their `inputSchema` definitions are missing the required `"type": "object"` property.

## Error Details

### Connection Status
✅ HTTP connection: **SUCCESS** (StreamableHTTP on port 6280)
✅ MCP handshake: **SUCCESS**
❌ Tool loading: **FAILED** - Schema validation error

### Error Log
```
ERROR service=mcp key=scrapegoat error=Failed to parse server response
Caused by: [
  {
    "code": "invalid_value",
    "values": ["object"],
    "path": ["tools", 0, "inputSchema", "type"],
    "message": "Invalid input: expected \"object\""
  },
  ... (repeats for all 9 tools)
]
```

### Log File
`/home/mp/.local/share/haxxcode/log/2025-11-12T214243.log`

## Root Cause

### Current Tool Schema (INVALID)
```json
{
  "name": "scrape_docs",
  "description": "Scrape and index documentation...",
  "inputSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#"
  }
}
```

### Required Tool Schema (VALID)
```json
{
  "name": "scrape_docs",
  "description": "Scrape and index documentation...",
  "inputSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      // ... tool parameters
    },
    "required": ["..."]
  }
}
```

## Affected Tools

All 9 Scrapegoat MCP tools are affected:

1. ❌ `scrape_docs` - Scrape and index documentation
2. ❌ `search_docs` - Search library documentation
3. ❌ `list_libraries` - List indexed libraries
4. ❌ `find_version` - Find matching library version
5. ❌ `list_jobs` - List indexing jobs
6. ❌ `get_job_info` - Get job details
7. ❌ `cancel_job` - Cancel indexing job
8. ❌ `remove_docs` - Remove indexed docs
9. ❌ `fetch_url` - Fetch URL as Markdown

## Testing Evidence

### Manual curl Test (SUCCESS)
```bash
curl -X POST http://docs.den.lan:6280/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
```

Response: HTTP 200 with 9 tools, but schemas are incomplete.

### haxxcode Connection Test (PARTIAL SUCCESS)
```
✅ Connection: StreamableHTTP connected
✅ Protocol: MCP handshake successful
❌ Validation: Tool schemas rejected by SDK
```

## Solution

### Step 1: Locate Tool Definitions
Find where MCP tools are defined in the Scrapegoat codebase. Likely locations:
- `src/mcp/` directory
- `src/tools/` directory
- Files matching `*mcp*` or `*tools*`

### Step 2: Add `type` Property to All Schemas
For **each tool**, ensure the `inputSchema` includes:

```typescript
// Before (WRONG)
inputSchema: {
  $schema: "http://json-schema.org/draft-07/schema#"
}

// After (CORRECT)
inputSchema: {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    // Define your tool parameters here
    library: { type: "string", description: "..." },
    query: { type: "string", description: "..." }
  },
  required: ["library", "query"] // List required parameters
}
```

### Step 3: Define Complete Schemas
Each tool should have a proper JSON Schema v7 definition:

```typescript
{
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    // All tool parameters with types and descriptions
  },
  required: [/* required parameter names */],
  additionalProperties: false // Recommended for strict validation
}
```

## Example Fix

### Before: `scrape_docs` tool
```json
{
  "name": "scrape_docs",
  "description": "Scrape and index documentation from a URL",
  "inputSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#"
  }
}
```

### After: `scrape_docs` tool
```json
{
  "name": "scrape_docs",
  "description": "Scrape and index documentation from a URL",
  "inputSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "library": {
        "type": "string",
        "description": "Name of the library to scrape"
      },
      "url": {
        "type": "string",
        "format": "uri",
        "description": "Documentation URL to scrape"
      },
      "version": {
        "type": "string",
        "description": "Library version (optional)"
      }
    },
    "required": ["library", "url"],
    "additionalProperties": false
  }
}
```

## Verification Steps

1. **Update all tool schemas** with proper `type: "object"` and properties
2. **Restart Scrapegoat MCP server**
3. **Test with curl**:
   ```bash
   curl -X POST http://docs.den.lan:6280/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
   ```
4. **Verify response** includes `"type": "object"` in each tool's inputSchema
5. **Test in haxxcode**: Add to `haxxcode.jsonc` and verify tools load
6. **Check logs**: Should show `toolCount=9 create() successfully created client`

## Related Issues

### Issue 1: HTTP 406 Error (FIXED)
- **Problem**: Missing Accept header caused HTTP 406
- **Solution**: Fixed in haxxcode by adding `Accept: application/json, text/event-stream`
- **Status**: ✅ Resolved in haxxcode v0.0.0-main-202511122120

### Issue 2: Schema Validation (CURRENT)
- **Problem**: Missing `type` property in inputSchemas
- **Solution**: Add proper JSON Schema definitions (this document)
- **Status**: 🔴 Requires fix in Scrapegoat

## References

- MCP Specification: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
- JSON Schema Draft 7: https://json-schema.org/draft-07/json-schema-release-notes.html
- haxxcode MCP Implementation: `/home/mp/Workspace/haxxcode/packages/haxxcode/src/mcp/index.ts`

## Timeline

- **2025-11-12 21:13**: Identified HTTP 406 error
- **2025-11-12 21:16**: Fixed Accept header in haxxcode
- **2025-11-12 21:20**: Rebuilt and deployed haxxcode
- **2025-11-12 21:42**: Discovered schema validation issue
- **2025-11-12 21:42**: Created this issue document

## Next Actions

1. [ ] Find tool definition code in Scrapegoat
2. [ ] Add `type: "object"` to all tool schemas
3. [ ] Add proper `properties` definitions for each tool
4. [ ] Test with curl to verify schema structure
5. [ ] Restart Scrapegoat MCP server
6. [ ] Test connection from haxxcode
7. [ ] Verify all 9 tools load successfully
8. [ ] Update Scrapegoat documentation with proper schema examples

---

**Need Help?**
Contact: haxxcode debugging session 2025-11-12
Context: MCP integration between Scrapegoat and haxxcode
