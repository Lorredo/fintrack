import type { AxiosError } from 'axios';

export interface ApiError {
  status: number | null;
  message: string;
  code?: string;
}

export function parseApiError(error: unknown): ApiError {
  if (typeof error === 'string') {
    return {
      status: null,
      message: error,
    };
  }

  const err = error as AxiosError<{ message?: string; code?: string }> & { message?: string };

  // 1. If server sent a JSON response with a specific message (e.g. "Incorrect PIN")
  const serverMessage = err?.response?.data?.message;
  if (serverMessage) {
    return {
      status: err.response?.status ?? null,
      message: serverMessage,
      code: err.response?.data?.code,
    };
  }

  // 2. If HTTP response was received with a status code
  if (err?.response) {
    const status = err.response.status;
    const messages: Record<number, string> = {
      400: 'Invalid request.',
      401: 'Incorrect credentials or session expired.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      422: 'Validation failed. Please check your input.',
      429: 'Too many requests. Please try again later.',
      500: 'Server error. Please try again later.',
    };

    return {
      status,
      message: messages[status] ?? 'An unexpected error occurred.',
      code: err.response.data?.code,
    };
  }

  // 3. If there is a standard Error message (e.g. from runtime or client validation)
  const rawMsg = err?.message;
  if (rawMsg && !rawMsg.toLowerCase().includes('network error') && !rawMsg.toLowerCase().includes('failed to fetch')) {
    return {
      status: null,
      message: rawMsg,
    };
  }

  return {
    status: null,
    message: 'Network error. Please check your connection.',
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