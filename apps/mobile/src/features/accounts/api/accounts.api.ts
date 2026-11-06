import { api } from '@/lib/api';
import type { Account, CreateAccountInput, UpdateAccountInput, AccountListResponse, AccountResponse, SetBalanceInput, SetBalanceResult } from '../types';

export const AccountApi = {
  list: async (): Promise<Account[]> => {
    const { data } = await api.get<AccountListResponse>('/api/v1/accounts');
    return data.data;
  },

  create: async (input: CreateAccountInput): Promise<AccountResponse> => {
    const { data } = await api.post<AccountResponse>('/api/v1/accounts', input);
    return data;
  },

  setBalance: async ({ id, ...rest }: SetBalanceInput): Promise<SetBalanceResult> => {
    const { data } = await api.post<{ data: SetBalanceResult }>(`/api/v1/accounts/${id}/balance`, rest);
    return data.data;
  },

  update: async (input: UpdateAccountInput): Promise<AccountResponse> => {
    const { id, ...rest } = input;
    const { data } = await api.put<AccountResponse>(`/api/v1/accounts/${id}`, rest);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/accounts/${id}`);
  },
};
