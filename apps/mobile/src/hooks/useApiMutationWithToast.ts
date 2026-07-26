import {
  useMutation,
  type UseMutationOptions,
} from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AxiosError } from 'axios';
import { useToast } from '@/features/toast/hooks/useToast';
import { parseApiError } from '@/shared/utils/apiErrors';

interface ToastOptions {
  /** Show a success toast with this message on success */
  successMessage?: string;
  /** Show an error toast on failure. Defaults to true */
  showErrorToast?: boolean;
}

/**
 * useApiMutation wrapper that integrates toast notifications
 * for success and error states.
 */
export function useApiMutationWithToast<TData, TVariables = unknown>(
  url: string,
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  toastOptions?: ToastOptions,
  mutationOptions?: Omit<
    UseMutationOptions<TData, AxiosError, TVariables>,
    'mutationFn'
  >,
) {
  const toast = useToast();
  const { successMessage, showErrorToast = true } = toastOptions ?? {};

  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables) => {
      const { data } = await api[method]<TData>(url, variables);
      return data;
    },
    ...mutationOptions,
  });
}