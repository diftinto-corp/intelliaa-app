import { NextResponse } from 'next/server';

export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  warnings?: string[];
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
  code?: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data?: T,
  status: number = 200,
  message?: string,
  warnings?: string[]
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      warnings
    },
    { status }
  );
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: any,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      details,
      code
    },
    { status }
  );
}

/**
 * Transform server action error to API response
 */
export function transformServerActionError(error: any): NextResponse<ApiErrorResponse> {
  // Handle custom error types from server actions
  if (error?.success === false) {
    // Server action returned error response
    return NextResponse.json(error, { status: 400 });
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }

  // Unknown error
  return errorResponse('Error desconocido', 500, error);
}

/**
 * Transform validation error (Zod) to API response
 */
export function validationErrorResponse(issues: any[]): NextResponse<ApiErrorResponse> {
  return errorResponse(
    'Validación fallida',
    400,
    issues,
    'VALIDATION_ERROR'
  );
}
