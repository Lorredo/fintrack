import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { getLocalISODate } from '@/shared/utils/categories';
import { BillApi } from '../api/bills.api';
import type { CreateBillInput, PayBillInput, PaySettings, SkipBillInput, UpdateBillInput } from '../types';

export const BILL_KEYS = {
  all: ['bills'] as const,
  list: (today: string) => [...BILL_KEYS.all, 'list', today] as const,
  // Under 'dashboard', so anything that refreshes the dashboard refreshes this.
  safeToSpend: (today: string) => ['dashboard', 'safe-to-spend', today] as const,
  settings: ['settings', 'pay'] as const,
};

function refreshBills(queryClient: QueryClient) {
  [BILL_KEYS.all, ['dashboard']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}

// Paying a bill records an expense, so everything built on transactions changes.
function refreshAfterPayment(queryClient: QueryClient) {
  [BILL_KEYS.all, ['dashboard'], ['transactions'], ['accounts'], ['budgets'], ['reports']].forEach((queryKey) =>
    queryClient.invalidateQueries({ queryKey }),
  );
}

export function useBills() {
  const today = getLocalISODate();
  return useQuery({
    queryKey: BILL_KEYS.list(today),
    queryFn: () => BillApi.list(today),
  });
}

export function useSafeToSpend() {
  const today = getLocalISODate();
  return useQuery({
    queryKey: BILL_KEYS.safeToSpend(today),
    queryFn: () => BillApi.safeToSpend(today),
  });
}

export function usePaySettings() {
  return useQuery({
    queryKey: BILL_KEYS.settings,
    queryFn: () => BillApi.getSettings(),
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBillInput) => BillApi.create(input, getLocalISODate()),
    onSuccess: () => refreshBills(queryClient),
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBillInput) => BillApi.update(input, getLocalISODate()),
    onSuccess: () => refreshBills(queryClient),
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => BillApi.delete(id),
    onSuccess: () => refreshBills(queryClient),
  });
}

export function usePayBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PayBillInput) => BillApi.pay(input),
    onSuccess: () => refreshAfterPayment(queryClient),
  });
}

export function useSkipBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SkipBillInput) => BillApi.skip(input),
    onSuccess: () => refreshBills(queryClient),
  });
}

export function useUpdatePaySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PaySettings>) => BillApi.updateSettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(BILL_KEYS.settings, settings);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
