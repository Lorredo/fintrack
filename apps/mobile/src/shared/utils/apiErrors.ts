import type { AxiosError } from 'axios';

export interface ApiError {
  status: number | null;
  message: string;
  code?: string;
}

export function parseApiError(error: unknown): ApiError {
  const err = error as AxiosError<{ message?: string; code?: string }>;

  if (!err.response) {
    return {
      status: null,
      message: 'Network error. Please check your connection.',
    };
  }

  const status = err.response.status;
  const serverMessage = err.response.data?.message;

  const messages: Record<number, string> = {
    400: serverMessage ?? 'Invalid request.',
    401: 'Session expired. Please log in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    422: serverMessage ?? 'Validation failed. Please check your input.',
    429: 'Too many requests. Please try again later.',
    500: 'Server error. Please try again later.',
  };

  return {
    status,
    message: messages[status] ?? serverMessage ?? 'An unexpected error occurred.',
    code: err.response.data?.code,
  };
}

export function isUnauthorized(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 401;
}

export function isNotFound(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 404;
}

export function isValidationError(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 422;
}

export function isForbidden(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 403;
}

export function isServerError(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 500;
}

export function isNetworkError(error: unknown): boolean {
  return !(error as AxiosError)?.response;
}

export function isRateLimited(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 429;
}

export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  return parseApiError(error).message;
}