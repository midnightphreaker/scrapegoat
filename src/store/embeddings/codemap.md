# src/store/embeddings/

## Responsibility
Embedding model configuration, instantiation, and dimension management across multiple providers (OpenAI, Google Vertex/Gemini, AWS Bedrock, Azure OpenAI, SageMaker).

## Design
- **Factory pattern**: `EmbeddingFactory` creates `Embeddings` instances from `"provider:model"` spec strings
- **Configuration singleton**: `EmbeddingConfig` manages known model dimensions lookup (200+ models), parsing of provider:model specs, and dimension caching
- **Dimension adapter**: `FixedDimensionEmbeddings` wraps any `Embeddings` to normalize output vectors to a fixed database dimension (truncate for MRL models, pad with zeros for smaller models)
- **Credential detection**: `areCredentialsAvailable()` checks required env vars per provider without attempting API calls

**Providers supported:**
- `openai` — OpenAI + compatible APIs (Ollama, LMStudio) via `OPENAI_API_KEY` / `OPENAI_API_BASE`
- `vertex` — Google Cloud Vertex AI via `GOOGLE_APPLICATION_CREDENTIALS`
- `gemini` — Google Generative AI via `GOOGLE_API_KEY` (wrapped in `FixedDimensionEmbeddings` with truncation)
- `aws` — AWS Bedrock via `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `BEDROCK_AWS_REGION`
- `microsoft` — Azure OpenAI via `AZURE_OPENAI_API_KEY` + instance/deployment/version env vars
- `sagemaker` — AWS SageMaker hosted models

**Error types**: `UnsupportedProviderError`, `ModelConfigurationError`, `MissingCredentialsError`

## Flow
1. `EmbeddingConfig.parse(modelSpec)` → `EmbeddingModelConfig` (provider, model, known dimensions)
2. `createEmbeddingModel(modelSpec, runtime)` → `Embeddings` instance (may wrap in `FixedDimensionEmbeddings`)
3. `DocumentStore.initializeEmbeddings()` tests connectivity, detects actual dimensions, validates against DB dimension
4. Embeddings used for batch document embedding and query embedding during search

## Integration
- Consumed by: `src/store/DocumentStore` (embedding initialization and search)
- Depends on: `@langchain/openai`, `@langchain/google-genai`, `@langchain/google-vertexai`, `@langchain/aws` (provider-specific LangChain embedding implementations)
