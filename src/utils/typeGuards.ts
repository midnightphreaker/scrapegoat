/**
 * Type guard utilities for discriminated unions and type narrowing.
 * Provides compile-time type safety for runtime type checks.
 */

import type { PipelineJobStatus } from "../pipeline/types.js";
import type { VersionRef, VersionStatus } from "../store/types.js";
import {
  FetcherType,
  type FetcherTypeValue,
  ScraperScope,
  type ScraperScopeValue,
} from "./constants.js";

/**
 * Result types for discriminated unions
 */

/**
 * Represents a successful operation result
 */
export interface SuccessResult<T = void> {
  success: true;
  data: T;
}

/**
 * Represents a failed operation result
 */
export interface ErrorResult {
  success: false;
  error: Error;
  code?: string;
}

/**
 * Union type for operation results
 */
export type Result<T = void> = SuccessResult<T> | ErrorResult;

/**
 * Database operation result types
 */
export interface DbSuccessResult<T = unknown> {
  ok: true;
  data: T;
  rows?: number;
}

export interface DbErrorResult {
  ok: false;
  error: Error;
  code?: string;
  detail?: string;
}

export type DbResult<T = unknown> = DbSuccessResult<T> | DbErrorResult;

// ============================================================================
// Type Guard Functions
// ============================================================================

/**
 * Type guard for VersionStatus enum values
 * @param value - Value to check
 * @returns True if value is a valid VersionStatus
 */
export function isVersionStatus(value: unknown): value is VersionStatus {
  const validValues = [
    "not_indexed",
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
    "updating",
  ] as const;
  return typeof value === "string" && validValues.includes(value as VersionStatus);
}

/**
 * Type guard for PipelineJobStatus enum values
 * @param value - Value to check
 * @returns True if value is a valid PipelineJobStatus
 */
export function isPipelineJobStatus(value: unknown): value is PipelineJobStatus {
  const validValues = ["queued", "running", "completed", "failed", "cancelled"] as const;
  return typeof value === "string" && validValues.includes(value as PipelineJobStatus);
}

/**
 * Type guard for FetcherType values
 * @param value - Value to check
 * @returns True if value is a valid FetcherType
 */
export function isFetcherType(value: unknown): value is FetcherTypeValue {
  const validValues = Object.values(FetcherType);
  return typeof value === "string" && validValues.includes(value as FetcherTypeValue);
}

/**
 * Type guard for ScraperScope values
 * @param value - Value to check
 * @returns True if value is a valid ScraperScope
 */
export function isScraperScope(value: unknown): value is ScraperScopeValue {
  const validValues = Object.values(ScraperScope);
  return typeof value === "string" && validValues.includes(value as ScraperScopeValue);
}

/**
 * Type guard for VersionRef object
 * @param value - Value to check
 * @returns True if value is a valid VersionRef
 */
export function isVersionRef(value: unknown): value is VersionRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "library" in value &&
    "version" in value &&
    typeof value.library === "string" &&
    typeof value.version === "string"
  );
}

/**
 * Type guard for successful Result type
 * @param result - Result to check
 * @returns True if result is a SuccessResult
 */
export function isSuccessResult<T>(result: Result<T>): result is SuccessResult<T> {
  return result.success === true;
}

/**
 * Type guard for error Result type
 * @param result - Result to check
 * @returns True if result is an ErrorResult
 */
export function isErrorResult(result: Result): result is ErrorResult {
  return result.success === false;
}

/**
 * Type guard for successful database operation result
 * @param result - Result to check
 * @returns True if result is a DbSuccessResult
 */
export function isDbSuccessResult<T>(result: DbResult<T>): result is DbSuccessResult<T> {
  return result.ok === true;
}

/**
 * Type guard for error database operation result
 * @param result - Result to check
 * @returns True if result is a DbErrorResult
 */
export function isDbErrorResult(result: DbResult): result is DbErrorResult {
  return result.ok === false;
}

/**
 * Type guard for successful ScraperJobResult
 * @param result - Result to check
 * @returns True if result is a ScraperJobSuccessResult
 */
export function isScraperSuccessResult(
  result: ScraperJobResult,
): result is ScraperJobSuccessResult {
  return result.status === "completed";
}

/**
 * Type guard for failed ScraperJobResult
 * @param result - Result to check
 * @returns True if result is a ScraperJobErrorResult
 */
export function isScraperErrorResult(
  result: ScraperJobResult,
): result is ScraperJobErrorResult {
  return result.status === "failed";
}

/**
 * Type guard for objects with a specific property
 * @param obj - Object to check
 * @param prop - Property name to check for
 * @returns True if object has the property
 */
export function hasProperty<T extends PropertyKey>(
  obj: unknown,
  prop: T,
): obj is Record<T, unknown> {
  return typeof obj === "object" && obj !== null && prop in obj;
}

/**
 * Type guard for non-null values
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Type guard for non-empty strings
 * @param value - Value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Type guard for array values
 * @param value - Value to check
 * @returns True if value is an array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard for plain objects (not null, not array)
 * @param value - Value to check
 * @returns True if value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for objects with error structure
 * @param value - Value to check
 * @returns True if value has error structure
 */
export function isErrorLike(
  value: unknown,
): value is { message: string; stack?: string; code?: string } {
  return isPlainObject(value) && typeof value.message === "string";
}

// ============================================================================
// Assertion Functions
// ============================================================================

/**
 * Asserts that a value is a VersionStatus
 * @throws TypeError if value is not a valid VersionStatus
 */
export function assertVersionStatus(value: unknown): asserts value is VersionStatus {
  if (!isVersionStatus(value)) {
    throw new TypeError(`Expected VersionStatus, got ${typeof value}: ${String(value)}`);
  }
}

/**
 * Asserts that a value is a FetcherType
 * @throws TypeError if value is not a valid FetcherType
 */
export function assertFetcherType(value: unknown): asserts value is FetcherTypeValue {
  if (!isFetcherType(value)) {
    throw new TypeError(`Expected FetcherType, got ${typeof value}: ${String(value)}`);
  }
}

/**
 * Asserts that a value is a ScraperScope
 * @throws TypeError if value is not a valid ScraperScope
 */
export function assertScraperScope(value: unknown): asserts value is ScraperScopeValue {
  if (!isScraperScope(value)) {
    throw new TypeError(`Expected ScraperScope, got ${typeof value}: ${String(value)}`);
  }
}

/**
 * Asserts that a Result is successful
 * @throws Error if result is an error
 */
export function assertSuccess<T>(result: Result<T>): asserts result is SuccessResult<T> {
  if (!isSuccessResult(result)) {
    throw result.error;
  }
}

/**
 * Asserts that a DbResult is successful
 * @throws Error if result is an error
 */
export function assertDbSuccess<T>(
  result: DbResult<T>,
): asserts result is DbSuccessResult<T> {
  if (!isDbSuccessResult(result)) {
    throw result.error;
  }
}
