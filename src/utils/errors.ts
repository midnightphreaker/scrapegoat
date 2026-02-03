class ScraperError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean = false,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

class NetworkError extends ScraperError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: Error,
  ) {
    super(message, true, cause);
  }
}

class RateLimitError extends ScraperError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message, true);
  }
}

class InvalidUrlError extends ScraperError {
  constructor(url: string, cause?: Error) {
    super(`Invalid URL: ${url}`, false, cause);
  }
}

class ParsingError extends ScraperError {
  constructor(message: string, cause?: Error) {
    super(`Failed to parse content: ${message}`, false, cause);
  }
}

class RedirectError extends ScraperError {
  constructor(
    public readonly originalUrl: string,
    public readonly redirectUrl: string,
    public readonly statusCode: number,
  ) {
    super(
      `Redirect detected from ${originalUrl} to ${redirectUrl} (status: ${statusCode})`,
      false,
    );
  }
}

class ChallengeError extends ScraperError {
  constructor(
    public readonly url: string,
    public readonly statusCode: number,
    public readonly challengeType: string,
  ) {
    super(
      `Challenge detected for ${url} (status: ${statusCode}, type: ${challengeType})`,
      false,
    );
  }
}

/**
 * Error thrown when an operation times out.
 * Timeouts are generally retryable, so isRetryable is set to true.
 */
class TimeoutError extends ScraperError {
  constructor(
    message: string,
    public readonly timeout?: number,
    cause?: Error,
  ) {
    super(message, true, cause);
    this.name = "TimeoutError";
  }
}

/**
 * Error thrown when input validation fails.
 * Validation errors are not retryable as the input needs to be fixed.
 */
class ValidationError extends ScraperError {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly reason: string,
  ) {
    super(`Validation failed for ${field}: ${reason}`, false);
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when an external service is unavailable.
 * Service unavailability is generally retryable (isRetryable: true).
 */
class ServiceUnavailableError extends ScraperError {
  constructor(
    public readonly service: string,
    cause?: Error,
  ) {
    super(`Service ${service} is unavailable`, true, cause);
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Error thrown when authentication fails.
 */
class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Error thrown when an authentication token is invalid or expired.
 */
class InvalidTokenError extends AuthenticationError {
  constructor(
    message: string,
    public readonly tokenType?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "InvalidTokenError";
  }
}

/**
 * Error thrown when configuration is invalid or missing.
 */
class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly missingFields?: string[],
  ) {
    let fullMessage = message;
    if (missingFields && missingFields.length > 0) {
      fullMessage += `\nMissing fields: ${missingFields.join(", ")}`;
    }
    super(fullMessage);
    this.name = "ConfigurationError";
  }
}

/**
 * Error thrown when a pipeline operation fails.
 */
class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage?: string,
    public readonly cause?: unknown,
  ) {
    let fullMessage = message;
    if (stage) {
      fullMessage = `Pipeline error at stage '${stage}': ${message}`;
    }
    super(fullMessage);
    this.name = "PipelineError";
  }
}

/**
 * Error thrown when a job is not found in the pipeline.
 */
class JobNotFoundError extends PipelineError {
  constructor(public readonly jobId: string) {
    super(`Job not found: ${jobId}`, undefined);
    this.name = "JobNotFoundError";
  }
}

/**
 * Error thrown when a job is in an invalid state for the requested operation.
 */
class JobStateError extends PipelineError {
  constructor(
    public readonly jobId: string,
    public readonly currentState: string,
    public readonly expectedStates: string[],
    message?: string,
  ) {
    const msg =
      message ||
      `Job ${jobId} is in state '${currentState}', expected one of: ${expectedStates.join(", ")}`;
    super(msg, undefined);
    this.name = "JobStateError";
  }
}

/**
 * Error thrown when a file system operation fails.
 */
class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly cause?: unknown,
  ) {
    let fullMessage = message;
    if (path) {
      fullMessage = `${message}: ${path}`;
    }
    super(fullMessage);
    this.name = "FileSystemError";
  }
}

/**
 * Error thrown when a file or directory is not found.
 */
class FileNotFoundError extends FileSystemError {
  constructor(
    public readonly filePath: string,
    public readonly fileType: "file" | "directory" = "file",
  ) {
    super(`${fileType} not found`, filePath);
    this.name = "FileNotFoundError";
  }
}

/**
 * Error thrown when a URL is potentially malicious or contains dangerous content.
 */
class MaliciousUrlError extends ValidationError {
  constructor(
    url: string,
    public readonly reason: string,
    _cause?: Error,
  ) {
    super("url", url, reason);
    this.name = "MaliciousUrlError";
  }
}

/**
 * Error thrown when an HTTP header is invalid.
 */
class InvalidHeaderError extends ValidationError {
  constructor(
    public readonly headerName: string,
    public readonly headerValue: string,
    reason: string,
  ) {
    super(headerName, headerValue, reason);
    this.name = "InvalidHeaderError";
  }
}

/**
 * Error thrown when a parser encounters unexpected or invalid content.
 */
class ParserError extends Error {
  constructor(
    message: string,
    public readonly parserType?: string,
    public readonly cause?: unknown,
  ) {
    let fullMessage = message;
    if (parserType) {
      fullMessage = `${parserType} parser error: ${message}`;
    }
    super(fullMessage);
    this.name = "ParserError";
  }
}

export {
  ScraperError,
  NetworkError,
  RateLimitError,
  InvalidUrlError,
  ParsingError,
  RedirectError,
  ChallengeError,
  TimeoutError,
  ValidationError,
  ServiceUnavailableError,
  AuthenticationError,
  InvalidTokenError,
  ConfigurationError,
  PipelineError,
  JobNotFoundError,
  JobStateError,
  FileSystemError,
  FileNotFoundError,
  MaliciousUrlError,
  InvalidHeaderError,
  ParserError,
};
