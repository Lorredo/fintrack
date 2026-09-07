import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { BudgetApi } from '../api/budgets.api';
import type { CreateBudgetInput, UpdateBudgetInput } from '../types';

export const BUDGET_KEYS = {
  all: ['budgets'] as const,
  list: (date?: string) => [...BUDGET_KEYS.all, 'list', date] as const,
  detail: (id: string) => [...BUDGET_KEYS.all, 'detail', id] as const,
};

export function useBudgetList(date?: string) {
  return useQuery({
    queryKey: BUDGET_KEYS.list(date),
    queryFn: () => BudgetApi.list(date),
  });
}

export function useBudgetDetail(id: string) {
  return useQuery({
    queryKey: BUDGET_KEYS.detail(id),
    queryFn: () => BudgetApi.getById(id),
    enabled: !!id,
    select: (data) => data.data,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBudgetInput) => BudgetApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBudgetInput) => BudgetApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => BudgetApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
export function useRebalanceBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { fromBudgetId: string; toBudgetId: string; amount: number }) => 
      BudgetApi.rebalance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
