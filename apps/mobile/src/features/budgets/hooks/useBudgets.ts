import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { BudgetApi } from '../api/budgets.api';
import type { CreateBudgetInput, UpdateBudgetInput } from '../types';

export const BUDGET_KEYS = {
  all: ['budgets'] as const,
  list: (month?: string) => [...BUDGET_KEYS.all, 'list', month] as const,
  detail: (id: string) => [...BUDGET_KEYS.all, 'detail', id] as const,
};

export function useBudgetList(month?: string) {
  return useQuery({
    queryKey: BUDGET_KEYS.list(month),
    queryFn: () => BudgetApi.list(month),
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
      queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.all });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBudgetInput) => BudgetApi.update(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.all });
      queryClient.invalidateQueries({
        queryKey: BUDGET_KEYS.detail(variables.id),
      });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => BudgetApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_KEYS.all });
    },
  });
}