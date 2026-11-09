import { api } from '@/lib/api';
import type {
  CreateDebtInput,
  CreatePaluwaganInput,
  Debt,
  DebtPaymentInput,
  DebtSummary,
  Paluwagan,
  PaluwaganRoundInput,
  UpdateDebtInput,
  UpdatePaluwaganInput,
} from '../types';

export const UtangApi = {
  list: async (): Promise<DebtSummary> => {
    const { data } = await api.get<{ data: DebtSummary }>('/api/v1/debts');
    return data.data;
  },

  create: async (input: CreateDebtInput): Promise<Debt> => {
    const { data } = await api.post<{ data: Debt }>('/api/v1/debts', input);
    return data.data;
  },

  update: async ({ id, ...rest }: UpdateDebtInput): Promise<Debt> => {
    const { data } = await api.put<{ data: Debt }>(`/api/v1/debts/${id}`, rest);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/debts/${id}`);
  },

  addPayment: async ({ id, ...rest }: DebtPaymentInput): Promise<Debt> => {
    const { data } = await api.post<{ data: Debt }>(`/api/v1/debts/${id}/payments`, rest);
    return data.data;
  },

  deletePayment: async ({ debtId, paymentId }: { debtId: string; paymentId: string }): Promise<Debt> => {
    const { data } = await api.delete<{ data: Debt }>(`/api/v1/debts/${debtId}/payments/${paymentId}`);
    return data.data;
  },
};

// Paluwagan rounds depend on the phone's local date, which the server can't
// know (it runs on UTC).
export const PaluwaganApi = {
  list: async (today: string): Promise<Paluwagan[]> => {
    const { data } = await api.get<{ data: Paluwagan[] }>('/api/v1/paluwagans', { params: { today } });
    return data.data;
  },

  create: async (input: CreatePaluwaganInput, today: string): Promise<Paluwagan> => {
    const { data } = await api.post<{ data: Paluwagan }>('/api/v1/paluwagans', input, { params: { today } });
    return data.data;
  },

  update: async ({ id, ...rest }: UpdatePaluwaganInput, today: string): Promise<Paluwagan> => {
    const { data } = await api.put<{ data: Paluwagan }>(`/api/v1/paluwagans/${id}`, rest, { params: { today } });
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/paluwagans/${id}`);
  },

  contribute: async ({ id, ...rest }: PaluwaganRoundInput, today: string): Promise<Paluwagan> => {
    const { data } = await api.post<{ data: Paluwagan }>(`/api/v1/paluwagans/${id}/contribute`, rest, { params: { today } });
    return data.data;
  },

  payout: async ({ id, ...rest }: PaluwaganRoundInput, today: string): Promise<Paluwagan> => {
    const { data } = await api.post<{ data: Paluwagan }>(`/api/v1/paluwagans/${id}/payout`, rest, { params: { today } });
    return data.data;
  },
};
