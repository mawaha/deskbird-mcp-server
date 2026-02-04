// Error handling utilities inspired by the Omni Administration SDK
export interface BusinessExceptionError extends Error {
  businessExceptionCode?: string;
  statusCode?: number;
  originalError?: any;
}

export class DeskbirdApiError extends Error implements BusinessExceptionError {
  public businessExceptionCode?: string;
  public statusCode?: number;
  public originalError?: any;

  constructor(
    message: string,
    statusCode?: number,
    businessExceptionCode?: string,
    originalError?: any
  ) {
    super(message);
    this.name = 'DeskbirdApiError';
    this.statusCode = statusCode;
    this.businessExceptionCode = businessExceptionCode;
    this.originalError = originalError;
  }
}

/**
 * Handles business exceptions from Deskbird API responses.
 * Similar to the Omni Administration SDK's error handling pattern.
 */
export function handleDeskbirdException(error: unknown, context?: string): never {
  if (error instanceof DeskbirdApiError) {
    throw error;
  }

  if (error instanceof Error) {
    // Try to extract business exception details from the error
    let businessExceptionCode: string | undefined;
    let statusCode: number | undefined;

    // Check if error has response data with business exception info
    const errorResponse = (error as any).response?.data;
    if (errorResponse) {
      businessExceptionCode = errorResponse.errorCode || errorResponse.code;
      statusCode = (error as any).response?.status;
    }

    throw new DeskbirdApiError(
      error.message,
      statusCode,
      businessExceptionCode,
      error
    );
  }

  // Fallback for unknown error types
  throw new DeskbirdApiError(
    error instanceof Error ? error.message : 'Unknown error occurred',
    undefined,
    undefined,
    error
  );
}
