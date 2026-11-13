import { api } from '@/lib/api';
import type { Transaction } from '@/features/transactions/types';
import type {
  Bill,
  CreateBillInput,
  PayBillInput,
  PaySettings,
  PendingPay,
  RecordPayInput,
  SafeToSpend,
  SkipBillInput,
  UpdateBillInput,
} from '../types';

// Every call that depends on the date sends the phone's local date, because
// the server runs on UTC and its "today" can be a day off.
export const BillApi = {
  list: async (today: string): Promise<Bill[]> => {
    const { data } = await api.get<{ data: Bill[] }>('/api/v1/bills', { params: { today } });
    return data.data;
  },

  create: async (input: CreateBillInput, today: string): Promise<Bill> => {
    const { data } = await api.post<{ data: Bill }>('/api/v1/bills', input, { params: { today } });
    return data.data;
  },

  update: async ({ id, ...rest }: UpdateBillInput, today: string): Promise<Bill> => {
    const { data } = await api.put<{ data: Bill }>(`/api/v1/bills/${id}`, rest, { params: { today } });
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/bills/${id}`);
  },

  pay: async ({ id, ...rest }: PayBillInput): Promise<Transaction> => {
    const { data } = await api.post<{ data: Transaction }>(`/api/v1/bills/${id}/pay`, rest);
    return data.data;
  },

  skip: async ({ id, dueDate }: SkipBillInput): Promise<void> => {
    await api.post(`/api/v1/bills/${id}/skip`, { dueDate });
  },

  getSettings: async (): Promise<PaySettings> => {
    const { data } = await api.get<{ data: PaySettings }>('/api/v1/settings');
    return data.data;
  },

  updateSettings: async (input: Partial<PaySettings>): Promise<PaySettings> => {
    const { data } = await api.put<{ data: PaySettings }>('/api/v1/settings', input);
    return data.data;
  },

  pendingPay: async (today: string): Promise<PendingPay> => {
    const { data } = await api.get<{ data: PendingPay }>('/api/v1/pay/pending', { params: { today } });
    return data.data;
  },

  recordPay: async (input: RecordPayInput): Promise<Transaction> => {
    const { data } = await api.post<{ data: Transaction }>('/api/v1/pay/record', input);
    return data.data;
  },

  skipPay: async (input: { key: string; payDate: string }): Promise<void> => {
    await api.post('/api/v1/pay/skip', input);
  },

  safeToSpend: async (today: string): Promise<SafeToSpend> => {
    const { data } = await api.get<{ data: SafeToSpend }>('/api/v1/dashboard/safe-to-spend', { params: { today } });
    return data.data;
  },
};
