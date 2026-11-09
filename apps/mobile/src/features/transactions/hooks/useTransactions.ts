import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { TransactionApi } from '../api/transactions.api';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionListParams,
} from '../types';

export const TRANSACTION_KEYS = {
  all: ['transactions'] as const,
  list: (params?: TransactionListParams) =>
    [...TRANSACTION_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...TRANSACTION_KEYS.all, 'detail', id] as const,
};

// Keys for related queries that depend on transaction data
const RELATED_QUERY_KEYS = [
  ['budgets'],
  ['dashboard'],
  ['accounts'],
  ['reports'],
  // Deleting a bill's expense reopens that due date.
  ['bills'],
] as const;

export function useTransactionCategories(type?: string) {
  return useQuery({
    queryKey: [...TRANSACTION_KEYS.all, 'categories', type],
    queryFn: () => TransactionApi.getCategories(type),
  });
}

export function useTransactionList(params?: TransactionListParams) {
  return useQuery({
    queryKey: TRANSACTION_KEYS.list(params),
    queryFn: () => TransactionApi.list(params),
  });
}

export function useInfiniteTransactionList(params?: Omit<TransactionListParams, 'page'>) {
  return useInfiniteQuery({
    queryKey: [...TRANSACTION_KEYS.all, 'infinite', params],
    queryFn: ({ pageParam }) => TransactionApi.list({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

export function useTransactionDetail(id: string) {
  return useQuery({
    queryKey: TRANSACTION_KEYS.detail(id),
    queryFn: () => TransactionApi.getById(id),
    enabled: !!id,
    select: (data) => data.data,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => TransactionApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.all });
      RELATED_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => TransactionApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.all });
      RELATED_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => TransactionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.all });
      RELATED_QUERY_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}
