# Connecting MCP Clients

ScrapeGoat is compatible with any client that supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Below are configuration instructions for popular AI assistants and IDEs.

## General Configuration

Most clients support two connection modes:
1.  **Remote/HTTP**: Connects to a running server instance (e.g., via Docker).
    *   **SSE URL**: `http://localhost:6280/sse`
    *   **HTTP URL**: `http://localhost:6280/mcp` (Streamable HTTP)
2.  **Local/Stdio**: Spawns the server process directly.
    *   **Command**: `npx`
    *   **Args**: `["-y", "@midnightphreaker/scrapegoat@latest"]`

---

## 🤖 Desktop Apps

### Claude Desktop
Edit your configuration file:
*   **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
*   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Remote (Recommended if running Docker):**
```json
{
  "mcpServers": {
    "scrapegoat": {
      "type": "sse",
      "url": "http://localhost:6280/sse"
    }
  }
}
```

**Local (Embedded):**
```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Cursor
1. Go to **Settings** → **Cursor Settings** → **MCP**.
2. Click **Add new MCP server**.

**Remote:**
*   **Type**: SSE (or streamableHttp)
*   **URL**: `http://localhost:6280/mcp` (for streamableHttp) or `http://localhost:6280/sse`

**Local:**
*   **Type**: stdio
*   **Command**: `npx -y @midnightphreaker/scrapegoat@latest`

### Windsurf
Open your Windsurf MCP configuration:
*   **macOS**: `~/.windsurf/mcp.json`
*   **Windows**: `%APPDATA%\Windsurf\mcp.json`

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Zed
Add to your Zed `settings.json`:

```json
{
  "context_servers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### LM Studio
Go to **Program** → **Install** → **Edit mcp.json**:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

---

## 💻 VS Code Extensions

### Cline
1. Open **Cline**.
2. Click the **MCP Servers** icon.
3. Choose **Remote Servers** (if running Docker) or **Local Servers**.

**Remote:**
```json
{
  "mcpServers": {
    "scrapegoat": {
      "url": "http://localhost:6280/mcp",
      "type": "streamableHttp"
    }
  }
}
```

**Local:**
```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Roo Code
Edit your Roo Code MCP config:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Continue.dev
Edit `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "scrapegoat",
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  ]
}
```

### Trae
See [Trae documentation](https://docs.trae.ai/ide/model-context-protocol) for details.

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

---

## 🛠️ CLI Tools

### Claude Code
```bash
# Current project
claude mcp add scrapegoat -- npx -y @midnightphreaker/scrapegoat@latest

# Global (all projects)
claude mcp add --scope user scrapegoat -- npx -y @midnightphreaker/scrapegoat@latest
```

### Opencode
```json
{
  "mcp": {
    "scrapegoat": {
      "type": "local",
      "command": ["npx", "-y", "@midnightphreaker/scrapegoat@latest"],
      "enabled": true
    }
  }
}
```

### Gemini CLI
Open `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Amazon Q Developer CLI
See [Amazon Q Developer docs](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-configuration.html).

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Copilot CLI
Open `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

---

## ☁️ Other Integrations

### JetBrains AI Assistant
1. Go to **Settings** → **Tools** → **AI Assistant** → **Model Context Protocol**.
2. Click **+ Add**.
3. Select **As JSON**:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Visual Studio 2022
See [Microsoft Docs](https://learn.microsoft.com/visualstudio/ide/mcp-servers).

```json
{
  "servers": {
    "scrapegoat": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat@latest"]
    }
  }
}
```

### Smithery
To install via Smithery:

```bash
npx -y @smithery/cli@latest install @midnightphreaker/scrapegoat --client <CLIENT_NAME>
```

---

## 🐋 Docker Configuration

If you prefer using Docker for the client connection:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "docs-mcp-data:/data",
        "ghcr.io/midnightphreaker/scrapegoat:latest"
      ]
    }
  }
}
```
