import { useCallback } from 'react';
import { useToast } from '@/features/toast/hooks/useToast';
import { parseApiError, isUnauthorized, isNotFound, isNetworkError } from '@/shared/utils/apiErrors';

/**
 * Hook that returns a helper to handle API errors with toast notifications.
 */
export function useApiErrorHandler() {
  const toast = useToast();

  const handleError = useCallback(
    (error: unknown, customMessage?: string) => {
      const parsed = parseApiError(error);
      toast.error(customMessage ?? parsed.message);
      return parsed;
    },
    [toast],
  );

  const handleMutationError = useCallback(
    (error: unknown) => {
      const parsed = parseApiError(error);

      if (isNetworkError(error)) {
        toast.error('Network error. Please check your connection.');
      } else if (isUnauthorized(error)) {
        toast.error('Session expired. Please log in again.');
      } else if (isNotFound(error)) {
        toast.error('The requested resource was not found.');
      } else {
        toast.error(parsed.message);
      }

      return parsed;
    },
    [toast],
  );

  return {
    handleError,
    handleMutationError,
    parseApiError,
    isUnauthorized,
    isNotFound,
    isNetworkError,
  };
}