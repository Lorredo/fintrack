import {
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AxiosError } from 'axios';

export function useApiQuery<TData>(
  key: QueryKey,
  url: string,
  options?: Omit<
    UseQueryOptions<TData, AxiosError>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<TData, AxiosError>({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get<TData>(url);
      return data;
    },
    ...options,
  });
}