import { api } from '@/lib/api';
import { API_ENDPOINTS } from '@/shared/constants/api';

import type {
//   Transaction,
  TransactionListResponse,
  TransactionListParams,
  TransactionResponse,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../types';

export const TransactionApi = {
  async list(params?: TransactionListParams): Promise<TransactionListResponse> {
    const { data } = await api.get<TransactionListResponse>(
      API_ENDPOINTS.TRANSACTIONS.LIST,
      { params },
    );
    return data;
  },

  async getById(id: string): Promise<TransactionResponse> {
    const { data } = await api.get<TransactionResponse>(
      API_ENDPOINTS.TRANSACTIONS.DETAIL(id),
    );
    return data;
  },

  async create(input: CreateTransactionInput): Promise<TransactionResponse> {
    const { data } = await api.post<TransactionResponse>(
      API_ENDPOINTS.TRANSACTIONS.CREATE,
      input,
    );
    return data;
  },

  async update(input: UpdateTransactionInput): Promise<TransactionResponse> {
    const { id, ...payload } = input;
    const { data } = await api.put<TransactionResponse>(
      API_ENDPOINTS.TRANSACTIONS.UPDATE(id),
      payload,
    );
    return data;
  },

//   async delete(id: string): Promise<TransactionResponse> {
//     const { data } = await api.delete<TransactionResponse>(
//       API_ENDPOINTS.TRANSACTIONS.DELETE(id),
//     );
//     return data;
//   },
async delete(id: string): Promise<TransactionResponse> {
  console.log('[delete] calling', API_ENDPOINTS.TRANSACTIONS.DELETE(id));
  const { data } = await api.delete<TransactionResponse>(
    API_ENDPOINTS.TRANSACTIONS.DELETE(id),
  );
  return data;
},
};