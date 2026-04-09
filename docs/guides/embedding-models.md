# Embedding Model Configuration

This guide details how to configure the embedding models used for vector search. You can set the embedding model using the `app.embeddingModel` configuration key, the `DOCS_MCP_EMBEDDING_MODEL` environment variable, or the `--embedding-model` CLI flag.

## Model Selection

If you leave the model empty but provide `OPENAI_API_KEY`, the server defaults to `text-embedding-3-small`.

**Supported Options:**

- `text-embedding-3-small` (default, OpenAI)
- `openai:snowflake-arctic-embed2` (OpenAI-compatible, e.g., Ollama)
- `vertex:text-embedding-004` (Google Vertex AI)
- `gemini:embedding-001` (Google Gemini)
- `aws:amazon.titan-embed-text-v1` (AWS Bedrock)
- `microsoft:text-embedding-ada-002` (Azure OpenAI)
- Or any OpenAI-compatible model name

## Provider Configuration

Provider credentials use the provider-specific environment variables listed below.

| Variable                           | Description                                           |
| ---------------------------------- | ----------------------------------------------------- |
| `DOCS_MCP_EMBEDDING_MODEL`         | Embedding model to use.                               |
| `OPENAI_API_KEY`                   | OpenAI API key for embeddings.                        |
| `OPENAI_API_BASE`                  | Custom OpenAI-compatible API endpoint (e.g., Ollama). |
| `GOOGLE_API_KEY`                   | Google API key for Gemini embeddings.                 |
| `GOOGLE_APPLICATION_CREDENTIALS`   | Path to Google service account JSON for Vertex AI.    |
| `AWS_ACCESS_KEY_ID`                | AWS key for Bedrock embeddings.                       |
| `AWS_SECRET_ACCESS_KEY`            | AWS secret for Bedrock embeddings.                    |
| `AWS_REGION`                       | AWS region for Bedrock.                               |
| `AZURE_OPENAI_API_KEY`             | Azure OpenAI API key.                                 |
| `AZURE_OPENAI_API_INSTANCE_NAME`   | Azure OpenAI instance name.                           |
| `AZURE_OPENAI_API_DEPLOYMENT_NAME` | Azure OpenAI deployment name.                         |
| `AZURE_OPENAI_API_VERSION`         | Azure OpenAI API version.                             |

## Throughput and Chunking Tuning

The shared configuration loader already exposes the most useful embedding and chunking knobs as environment variables. You do not need custom code to tune them.

| Variable | Default | What it tunes |
| --- | --- | --- |
| `DOCS_MCP_EMBEDDINGS_BATCH_SIZE` | `100` | Maximum number of chunks sent in a single embedding request before the batch is flushed. |
| `DOCS_MCP_EMBEDDINGS_BATCH_CHARS` | `50000` | Maximum total characters sent in a single embedding request. Lower this if your provider returns request-size errors. |
| `DOCS_MCP_EMBEDDINGS_REQUEST_TIMEOUT_MS` | `30000` | Per-request embedding timeout in milliseconds. Increase this for slower local or self-hosted embedding endpoints. |
| `DOCS_MCP_SPLITTER_PREFERRED_CHUNK_SIZE` | `1500` | Soft target for each chunk body in characters. Lower values create more, smaller chunks. |
| `DOCS_MCP_SPLITTER_MAX_CHUNK_SIZE` | `5000` | Hard upper bound for each chunk body in characters. Lower this for small-context embedding models. |
| `DOCS_MCP_SCRAPER_MAX_CONCURRENCY` | `3` | Number of pages fetched in parallel during scraping. Higher values can increase embedding throughput indirectly by feeding the indexer faster. |

### How These Knobs Interact

- `DOCS_MCP_EMBEDDINGS_BATCH_SIZE` and `DOCS_MCP_EMBEDDINGS_BATCH_CHARS` both limit the same request. The batch is flushed when either limit is reached first.
- `DOCS_MCP_SPLITTER_PREFERRED_CHUNK_SIZE` and `DOCS_MCP_SPLITTER_MAX_CHUNK_SIZE` change how many chunks are produced and how large each chunk body is. That directly affects embedding request count and token pressure.
- `DOCS_MCP_SCRAPER_MAX_CONCURRENCY` does not change the size of an embedding request, but it can raise overall ingestion throughput by making more pages available for chunking and embedding sooner.

### Recommended Starting Points

- **Local or self-hosted embedders**: start by increasing `DOCS_MCP_EMBEDDINGS_REQUEST_TIMEOUT_MS` before you increase batch size.
- **Small context-window models**: lower `DOCS_MCP_SPLITTER_MAX_CHUNK_SIZE` to leave room for the metadata header added before embedding.
- **Underutilized embedding servers**: raise `DOCS_MCP_EMBEDDINGS_BATCH_SIZE` and `DOCS_MCP_EMBEDDINGS_BATCH_CHARS` gradually while watching latency and error rates.

### Examples

Here are complete configuration examples for different embedding providers.

#### OpenAI (Default)

```bash
OPENAI_API_KEY="sk-proj-your-openai-api-key" \
DOCS_MCP_EMBEDDING_MODEL="text-embedding-3-small" \
npx @arabold/docs-mcp-server@latest
```

#### Ollama (Local)

Run local models compatible with the OpenAI API format.

```bash
OPENAI_API_KEY="ollama" \
OPENAI_API_BASE="http://localhost:11434/v1" \
DOCS_MCP_EMBEDDING_MODEL="openai:nomic-embed-text" \
npx @arabold/docs-mcp-server@latest
```

#### LM Studio (Local)

Connect to LM Studio's local inference server.

```bash
OPENAI_API_KEY="lmstudio" \
OPENAI_API_BASE="http://localhost:1234/v1" \
DOCS_MCP_EMBEDDING_MODEL="text-embedding-qwen3-embedding-4b" \
npx @arabold/docs-mcp-server@latest
```

#### Google Gemini

Use Google's Gemini API directly.

```bash
GOOGLE_API_KEY="your-google-api-key" \
DOCS_MCP_EMBEDDING_MODEL="gemini:embedding-001" \
npx @arabold/docs-mcp-server@latest
```

#### Google Vertex AI

For enterprise GCP deployments.

```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/gcp-service-account.json" \
DOCS_MCP_EMBEDDING_MODEL="vertex:text-embedding-004" \
npx @arabold/docs-mcp-server@latest
```

#### AWS Bedrock

Use Amazon Titan or other Bedrock-hosted models.

```bash
AWS_ACCESS_KEY_ID="your-aws-access-key-id" \
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key" \
AWS_REGION="us-east-1" \
DOCS_MCP_EMBEDDING_MODEL="aws:amazon.titan-embed-text-v1" \
npx @arabold/docs-mcp-server@latest
```

#### Azure OpenAI

Connect to your private Azure OpenAI deployment.

```bash
AZURE_OPENAI_API_KEY="your-azure-openai-api-key" \
AZURE_OPENAI_API_INSTANCE_NAME="your-instance-name" \
AZURE_OPENAI_API_DEPLOYMENT_NAME="your-deployment-name" \
AZURE_OPENAI_API_VERSION="2024-02-01" \
DOCS_MCP_EMBEDDING_MODEL="microsoft:text-embedding-ada-002" \
npx @arabold/docs-mcp-server@latest
```

## Changing the Embedding Model

When you change the embedding model or vector dimension after initial setup, existing embedding vectors become semantically incompatible with the new configuration. The server detects this automatically by tracking the active model identity in a metadata table.

### What Happens on Model Change

**Interactive mode (TTY connected):** The server displays a warning and prompts for confirmation before proceeding. Rejecting the prompt aborts startup with no changes made.

```
⚠️  Embedding model change detected:
   Previous: openai:text-embedding-3-small (1536 dimensions)
   Current:  openai:text-embedding-ada-002 (1536 dimensions)

   All existing embedding vectors will be invalidated.
   Libraries must be re-scraped to restore vector search.
   Full-text search will continue working for all existing documents.

   Proceed with model change? (y/N)
```

**Non-interactive mode (MCP/stdio, CI/CD):** The server fails startup entirely with a descriptive error message. To resolve the change, start the server interactively once to confirm the migration.

### After Confirming a Model Change

- All stored embedding vectors are set to NULL
- The vector search index (`documents_vec`) is recreated empty with the new dimension
- Full-text search continues working for all existing documents
- Libraries must be re-scraped to regenerate embeddings with the new model

### Vector Dimension Override

The vector dimension defaults to the model's native dimension (e.g., 1536 for `text-embedding-3-small`). You can override it with `embeddings.vectorDimension` in the config file or `DOCS_MCP_EMBEDDINGS_VECTOR_DIMENSION` as an environment variable. The value must be a positive integer (minimum 1).

## Environment Variable Reference

Every leaf value in `DEFAULT_CONFIG` is automatically exposed as a `DOCS_MCP_*` environment variable. The table below lists the variables most relevant to **embedding generation** and **search scoring** tuning. Provider credentials and scraper/splitter knobs are documented in their respective sections above.

| Variable | Default | Type | Description |
| --- | --- | --- | --- |
| `DOCS_MCP_EMBEDDINGS_STRIP_NEW_LINES` | `true` | boolean | Strip newlines from text before generating embeddings. Applies to all providers. |
| `DOCS_MCP_EMBEDDINGS_API_BATCH_SIZE` | `512` | number | SDK-level batch size per individual API call (OpenAI). Controls how many embeddings the provider's SDK sends in a single HTTP request. |
| `DOCS_MCP_EMBEDDINGS_ALLOW_TRUNCATE` | `true` | boolean | Allow truncating embedding vectors to the target dimension. Currently affects Gemini only. |
| `DOCS_MCP_EMBEDDINGS_BATCH_SIZE` | `100` | number | Application-level batch size — the maximum number of chunks the indexer queues before flushing an embedding request. |
| `DOCS_MCP_EMBEDDINGS_BATCH_CHARS` | `50000` | number | Maximum total characters in a single embedding batch. The batch is flushed when either this or `BATCH_SIZE` is reached first. |
| `DOCS_MCP_EMBEDDINGS_REQUEST_TIMEOUT_MS` | `30000` | number | Per-request embedding API timeout in milliseconds. |
| `DOCS_MCP_SEARCH_RRF_K` | `60` | number | Reciprocal Rank Fusion smoothing constant for hybrid search. Minimum value is 1 (enforced by schema) to prevent division issues in the RRF formula. |
| `DOCS_MCP_SEARCH_WEIGHT_VEC` | `1` | number | Weight multiplier applied to vector (semantic) search scores in hybrid ranking. |
| `DOCS_MCP_SEARCH_WEIGHT_FTS` | `1` | number | Weight multiplier applied to full-text search scores in hybrid ranking. |
| `DOCS_MCP_SEARCH_VECTOR_MULTIPLIER` | `10` | number | Overfetch multiplier for vector search candidates. Higher values retrieve more candidates before RRF merging, improving recall at the cost of latency. |

### BATCH_SIZE vs API_BATCH_SIZE

These two variables control batching at different layers and are easy to confuse:

- **`DOCS_MCP_EMBEDDINGS_BATCH_SIZE`** (default `100`) — **application-level**. The indexer accumulates up to this many chunks in memory before it flushes a batch to the embedding pipeline. Lower values reduce memory pressure; higher values improve throughput.
- **`DOCS_MCP_EMBEDDINGS_API_BATCH_SIZE`** (default `512`) — **SDK-level** (OpenAI only). Controls how many individual embeddings the provider's SDK packs into a single HTTP request. This maps directly to the OpenAI `embeddings.create({ input: [...] })` array size.

In practice, `BATCH_SIZE` determines *when* the app sends work, while `API_BATCH_SIZE` determines *how* the SDK packages that work into HTTP calls.

### Understanding RRF_K

The `DOCS_MCP_SEARCH_RRF_K` variable controls the smoothing behavior of Reciprocal Rank Fusion, the algorithm that merges vector and full-text search results. The RRF score for a document is:

```
score = Σ  1 / (k + rank)
```

- **Lower `k`** (e.g., 10): Top-ranked results dominate — good when you trust one ranking source.
- **Higher `k`** (e.g., 100): Scores are more evenly distributed — useful when vector and text rankings disagree frequently.

The minimum value is clamped to 1 to prevent division-by-zero in the formula.
