import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountApi } from '../api/accounts.api';
import type { CreateAccountInput, UpdateAccountInput } from '../types';

export const ACCOUNT_KEYS = {
  all: ['accounts'] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: ACCOUNT_KEYS.all,
    queryFn: () => AccountApi.list(),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) => AccountApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.all });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAccountInput) => AccountApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.all });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => AccountApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.all });
    },
  });
}
