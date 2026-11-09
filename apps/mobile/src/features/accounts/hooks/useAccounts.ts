import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountApi } from '../api/accounts.api';
import type { CreateAccountInput, SetBalanceInput, UpdateAccountInput } from '../types';

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
    // Safe to Spend depends on which wallets count, and bills on their wallet.
    onSuccess: () => {
      [ACCOUNT_KEYS.all, ['dashboard'], ['bills']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
  });
}

export function useSetAccountBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetBalanceInput) => AccountApi.setBalance(input),
    onSuccess: () => {
      // An adjustment is a transaction, so everything built on them is stale.
      [ACCOUNT_KEYS.all, ['transactions'], ['dashboard'], ['budgets'], ['reports'], ['bills']].forEach((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAccountInput) => AccountApi.update(input),
    // Safe to Spend depends on which wallets count, and bills on their wallet.
    onSuccess: () => {
      [ACCOUNT_KEYS.all, ['dashboard'], ['bills']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => AccountApi.delete(id),
    // Safe to Spend depends on which wallets count, and bills on their wallet.
    onSuccess: () => {
      [ACCOUNT_KEYS.all, ['dashboard'], ['bills']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    },
  });
}
