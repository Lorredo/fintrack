import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
] as const;

export function useTransactionList(params?: TransactionListParams) {
  return useQuery({
    queryKey: TRANSACTION_KEYS.list(params),
    queryFn: () => TransactionApi.list(params),
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
      queryClient.invalidateQueries({ queryKey: RELATED_QUERY_KEYS[0] });
      queryClient.invalidateQueries({ queryKey: RELATED_QUERY_KEYS[1] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => TransactionApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: RELATED_QUERY_KEYS[0] });
      queryClient.invalidateQueries({ queryKey: RELATED_QUERY_KEYS[1] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => TransactionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: RELATED_QUERY_KEYS[0] });
      queryClient.invalidateQueries({ queryKey: RELATED_QUERY_KEYS[1] });
    },
  });
}
