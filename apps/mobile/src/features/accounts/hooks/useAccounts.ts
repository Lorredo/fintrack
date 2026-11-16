import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountApi } from '../api/accounts.api';
import { useCallback } from 'react';

import { useOutbox } from '@/features/transactions/offline/outbox';
import { balanceDeltas } from '@/features/transactions/offline/outbox.logic';
import type { Account, CreateAccountInput, SetBalanceInput, UpdateAccountInput } from '../types';

export const ACCOUNT_KEYS = {
  all: ['accounts'] as const,
};

export function useAccounts() {
  const entries = useOutbox((state) => state.entries);
  // Wallet balances include changes saved offline that haven't synced yet.
  const select = useCallback(
    (accounts: Account[]) => {
      if (entries.length === 0) return accounts;
      const deltas = balanceDeltas(entries);
      return accounts.map((account) => {
        const delta = deltas.get(account.id);
        return delta ? { ...account, balance: Math.round((account.balance + delta) * 100) / 100 } : account;
      });
    },
    [entries],
  );
  return useQuery({
    queryKey: ACCOUNT_KEYS.all,
    queryFn: () => AccountApi.list(),
    select,
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
