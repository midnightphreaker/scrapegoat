import { Embeddings } from "@langchain/core/embeddings";
import { validateImageSize } from "../../utils/validation";
import { DimensionError } from "../errors";

/**
 * Size limits for image buffer validation to prevent API failures and excessive memory usage
 */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB - maximum buffer size for base64 conversion

/**
 * Wrapper around an Embeddings implementation that ensures vectors have a fixed dimension.
 * - If a vector's dimension is greater than the target and truncation is allowed,
 *   the vector is truncated (e.g., for models that support MRL - Matryoshka
 *   Representation Learning).
 * - If a vector's dimension is greater than the target and truncation is not
 *   allowed, a DimensionError is thrown.
 * - If a vector's dimension is less than the target, it is padded with zeros.
 */
export class FixedDimensionEmbeddings extends Embeddings {
  private provider: string;
  private model: string;

  constructor(
    private readonly embeddings: Embeddings,
    private readonly targetDimension: number,
    providerAndModel: string,
    private readonly allowTruncate: boolean = false,
  ) {
    super({});
    // Parse provider and model from string (e.g., "gemini:embedding-001" or just "text-embedding-3-small")
    const [providerOrModel, modelName] = providerAndModel.split(":");

    // Ensure we always have valid strings
    this.provider = modelName && providerOrModel ? providerOrModel : "openai";
    this.model = modelName || providerOrModel || "unknown";
  }

  /**
   * Normalize a vector to the target dimension by truncating (for MRL models) or padding.
   * @throws {DimensionError} If vector is too large and provider doesn't support MRL
   */
  private normalizeVector(vector: number[]): number[] {
    const dimension = vector.length;

    if (dimension > this.targetDimension) {
      // If truncation is allowed (e.g., for MRL models like Gemini), truncate the vector
      if (this.allowTruncate) {
        return vector.slice(0, this.targetDimension);
      }
      // Otherwise, throw an error
      throw new DimensionError(
        `${this.provider}:${this.model}`,
        dimension,
        this.targetDimension,
      );
    }

    if (dimension < this.targetDimension) {
      // Pad with zeros to reach target dimension
      return [...vector, ...new Array(this.targetDimension - dimension).fill(0)];
    }

    return vector;
  }

  async embedQuery(text: string): Promise<number[]> {
    const vector = await this.embeddings.embedQuery(text);
    return this.normalizeVector(vector);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const vectors = await this.embeddings.embedDocuments(documents);
    return vectors.map((vector) => this.normalizeVector(vector));
  }
}

/**
 * Image embedding input type
 */
export interface ImageInput {
  /** Image buffer (PNG, JPEG, etc.) */
  buffer: Buffer;
  /** Optional text description/caption for the image */
  description?: string;
  /** Source URL for reference */
  url?: string;
}

/**
 * Multimodal embedding result containing both text and image embeddings
 */
export interface MultimodalEmbeddingResult {
  /** Text embedding vector */
  textEmbedding: number[];
  /** Image embedding vector (if image provided) */
  imageEmbedding?: number[];
}

/**
 * MultimodalEmbeddings - Extended Embeddings class supporting both text and image embeddings.
 *
 * This class wraps standard text embeddings with optional image embedding capabilities,
 * enabling multimodal semantic search. Compatible with LangChain's Embeddings interface
 * for text while adding image support.
 *
 * @example
 * ```ts
 * const embeddings = new MultimodalEmbeddings(baseEmbeddings, imageEmbeddingModel);
 * const textResult = await embeddings.embedDocuments(["hello"]);
 * const imageResult = await embeddings.embedImages([{ buffer: imageBuffer }]);
 * const hybridResult = await embeddings.embedMultimodal({
 *   text: "hello",
 *   image: { buffer: imageBuffer }
 * });
 * ```
 */
export class MultimodalEmbeddings extends Embeddings {
  private imageEmbeddings?: Embeddings;
  private imageEmbeddingEnabled: boolean;

  /**
   * Creates a new MultimodalEmbeddings instance
   *
   * @param textEmbeddings - Base text embeddings (required)
   * @param imageEmbeddings - Optional image embeddings model
   * @param imageEmbeddingEnabled - Whether image embedding is active (default: true if model provided)
   */
  constructor(
    private readonly textEmbeddings: Embeddings,
    imageEmbeddings?: Embeddings,
    imageEmbeddingEnabled = true,
  ) {
    super({});
    this.imageEmbeddings = imageEmbeddings;
    this.imageEmbeddingEnabled = imageEmbeddingEnabled && !!imageEmbeddings;
  }

  /**
   * Embeds a single text query using text embeddings
   * @param text - Text to embed
   * @returns Text embedding vector
   */
  async embedQuery(text: string): Promise<number[]> {
    return await this.textEmbeddings.embedQuery(text);
  }

  /**
   * Embeds multiple documents using text embeddings
   * @param documents - Array of texts to embed
   * @returns Array of text embedding vectors
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return await this.textEmbeddings.embedDocuments(documents);
  }

  /**
   * Embeds images using the image embedding model.
   * Images are converted to base64 and sent as text input to vision-language models.
   *
   * @param images - Array of image inputs to embed
   * @returns Array of image embedding vectors
   * @throws Error if image embedding is not enabled
   */
  async embedImages(images: ImageInput[]): Promise<number[][]> {
    if (!this.imageEmbeddingEnabled || !this.imageEmbeddings) {
      throw new Error(
        "Image embedding is not enabled. Provide an image embedding model.",
      );
    }

    // Convert images to base64 format for vision-language models
    // Models like qwen3-text-embedding accept images as base64 data URIs
    const imageInputs = images.map((img) => {
      // Validate buffer size before base64 conversion (which increases size by ~33%)
      validateImageSize(img.buffer, MAX_IMAGE_SIZE, "Image buffer");

      const base64 = img.buffer.toString("base64");
      // Detect format from buffer magic bytes
      const format = detectImageFormat(img.buffer);
      return `<image:${format}>data:image/${format};base64,${base64}</image>${img.description ? ` ${img.description}` : ""}`;
    });

    return this.imageEmbeddings.embedDocuments(imageInputs);
  }

  /**
   * Embeds a single image using the image embedding model
   * @param image - Image input to embed
   * @returns Image embedding vector
   */
  async embedImage(image: ImageInput): Promise<number[]> {
    const results = await this.embedImages([image]);
    const result = results[0];
    if (!result) {
      throw new Error("Failed to embed image");
    }
    return result;
  }

  /**
   * Embeds multimodal content (text + optional image) as combined result
   * @param input - Multimodal input with text and optional image
   * @returns Combined embedding result with both text and image vectors
   */
  async embedMultimodal(input: {
    text: string;
    image?: ImageInput;
  }): Promise<MultimodalEmbeddingResult> {
    const textEmbedding = await this.embedQuery(input.text);
    let imageEmbedding: number[] | undefined;

    if (input.image && this.imageEmbeddingEnabled) {
      imageEmbedding = await this.embedImage(input.image);
    }

    return { textEmbedding, imageEmbedding };
  }

  /**
   * Checks if image embedding is enabled
   */
  get isImageEmbeddingEnabled(): boolean {
    return this.imageEmbeddingEnabled;
  }

  /**
   * Enables or disables image embedding
   */
  setImageEmbeddingEnabled(enabled: boolean): void {
    this.imageEmbeddingEnabled = enabled && !!this.imageEmbeddings;
  }
}

/**
 * Detects image format from buffer magic bytes
 * @param buffer - Image buffer
 * @returns Image format (png, jpeg, webp, gif, etc.)
 */
function detectImageFormat(buffer: Buffer): string {
  if (buffer.length < 4) return "png";

  const b0 = buffer[0];
  const b1 = buffer[1];
  const b2 = buffer[2];
  const b3 = buffer[3];

  // PNG magic bytes: 89 50 4E 47
  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) {
    return "png";
  }
  // JPEG magic bytes: FF D8 FF
  if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) {
    return "jpeg";
  }
  // GIF magic bytes: 47 49 46 38
  if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38) {
    return "gif";
  }
  // WebP magic bytes: 52 49 46 46 ... 57 45 42 50
  if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46 && buffer.length > 11) {
    const b8 = buffer[8];
    const b9 = buffer[9];
    const b10 = buffer[10];
    const b11 = buffer[11];
    if (b8 === 0x57 && b9 === 0x45 && b10 === 0x42 && b11 === 0x50) {
      return "webp";
    }
  }

  return "png"; // Default to PNG
}
