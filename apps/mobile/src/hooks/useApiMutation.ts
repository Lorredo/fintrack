import {
  useMutation,
  type UseMutationOptions,
} from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AxiosError } from 'axios';

export function useApiMutation<TData, TVariables = unknown>(
  url: string,
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  options?: Omit<
    UseMutationOptions<TData, AxiosError, TVariables>,
    'mutationFn'
  >,
) {
  return useMutation<TData, AxiosError, TVariables>({
    mutationFn: async (variables) => {
      const { data } = await api[method]<TData>(url, variables);
      return data;
    },
    ...options,
  });
}