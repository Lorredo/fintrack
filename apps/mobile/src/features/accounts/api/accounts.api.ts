import { api } from '@/lib/api';
import type { Account, CreateAccountInput, UpdateAccountInput, AccountListResponse, AccountResponse } from '../types';

export const AccountApi = {
  list: async (): Promise<Account[]> => {
    const { data } = await api.get<AccountListResponse>('/api/v1/accounts');
    return data.data;
  },

  create: async (input: CreateAccountInput): Promise<AccountResponse> => {
    const { data } = await api.post<AccountResponse>('/api/v1/accounts', input);
    return data;
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
