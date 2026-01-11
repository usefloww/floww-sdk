/**
 * Base class for all API client errors
 */
export class ClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when authentication is required or has failed (401)
 */
export class UnauthenticatedError extends ClientError {
  constructor(message: string, details?: any) {
    super(message, 401, details);
  }
}

/**
 * Thrown when the user is authenticated but not authorized (403)
 */
export class ForbiddenError extends ClientError {
  constructor(message: string = "Access forbidden", details?: any) {
    super(message, 403, details);
  }
}

/**
 * Thrown when a resource is not found (404)
 */
export class NotFoundError extends ClientError {
  constructor(message: string = "Resource not found", details?: any) {
    super(message, 404, details);
  }
}

/**
 * Thrown when there is a conflict with existing resource (409)
 */
export class ConflictError extends ClientError {
  constructor(message: string = "Resource already exists", details?: any) {
    super(message, 409, details);
  }
}

/**
 * Thrown when a network error occurs
 */
export class NetworkError extends ClientError {
  constructor(message: string = "Network error occurred", details?: any) {
    super(message, undefined, details);
  }
}

/**
 * Generic API error for other HTTP errors
 */
export class ApiError extends ClientError {
  constructor(statusCode: number, message: string, details?: any) {
    super(message, statusCode, details);
  }
}

/**
 * Extract a user-friendly error message from an API error
 * Prioritizes detailed error descriptions from the API response
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ClientError) {
    // Check for detailed error message in details.detail.description
    if (error.details?.detail?.description) {
      return error.details.detail.description;
    }
    // Fall back to title if available
    if (error.details?.detail?.title) {
      return error.details.detail.title;
    }
    // Use the error message if no detailed description
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}
