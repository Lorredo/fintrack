import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { getLocalISODate } from '@/shared/utils/categories';
import { PaluwaganApi, UtangApi } from '../api/utang.api';
import type {
  CreateDebtInput,
  CreatePaluwaganInput,
  DebtPaymentInput,
  PaluwaganRoundInput,
  UpdateDebtInput,
  UpdatePaluwaganInput,
} from '../types';

export const UTANG_KEYS = {
  all: ['utang'] as const,
  paluwagan: ['paluwagan'] as const,
  paluwaganList: (today: string) => ['paluwagan', 'list', today] as const,
};

// Utang and paluwagan move wallet money and are set aside in Safe to Spend.
function refreshAll(queryClient: QueryClient) {
  [UTANG_KEYS.all, UTANG_KEYS.paluwagan, ['accounts'], ['transactions'], ['dashboard']].forEach((queryKey) =>
    queryClient.invalidateQueries({ queryKey }),
  );
}

function useRefreshingMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => refreshAll(queryClient) });
}

export function useDebts() {
  return useQuery({ queryKey: UTANG_KEYS.all, queryFn: () => UtangApi.list() });
}

export const useCreateDebt = () => useRefreshingMutation((input: CreateDebtInput) => UtangApi.create(input));
export const useUpdateDebt = () => useRefreshingMutation((input: UpdateDebtInput) => UtangApi.update(input));
export const useDeleteDebt = () => useRefreshingMutation((id: string) => UtangApi.delete(id));
export const useAddDebtPayment = () => useRefreshingMutation((input: DebtPaymentInput) => UtangApi.addPayment(input));
export const useDeleteDebtPayment = () =>
  useRefreshingMutation((input: { debtId: string; paymentId: string }) => UtangApi.deletePayment(input));

export function usePaluwagans() {
  const today = getLocalISODate();
  return useQuery({ queryKey: UTANG_KEYS.paluwaganList(today), queryFn: () => PaluwaganApi.list(today) });
}

export const useCreatePaluwagan = () =>
  useRefreshingMutation((input: CreatePaluwaganInput) => PaluwaganApi.create(input, getLocalISODate()));
export const useUpdatePaluwagan = () =>
  useRefreshingMutation((input: UpdatePaluwaganInput) => PaluwaganApi.update(input, getLocalISODate()));
export const useDeletePaluwagan = () => useRefreshingMutation((id: string) => PaluwaganApi.delete(id));
export const useContribute = () =>
  useRefreshingMutation((input: PaluwaganRoundInput) => PaluwaganApi.contribute(input, getLocalISODate()));
export const useReceivePayout = () =>
  useRefreshingMutation((input: PaluwaganRoundInput) => PaluwaganApi.payout(input, getLocalISODate()));
