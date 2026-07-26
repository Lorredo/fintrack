import {
  useInfiniteQuery,
} from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AxiosError } from 'axios';

export function useInfiniteApiQuery<TData>(
  key: string[],
  url: string,
  getNextPageParam: (lastPage: TData, pages: TData[]) => string | undefined,
) {
  return useInfiniteQuery<TData, AxiosError>({
    queryKey: key,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<TData>(url, {
        params: { cursor: pageParam },
      });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam,
  });
}