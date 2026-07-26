import { api } from '@/lib/api';
import { API_ENDPOINTS } from '@/shared/constants/api';

import type {
  BudgetListResponse,
  BudgetResponse,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '../types';

export const BudgetApi = {
  async list(month?: string): Promise<BudgetListResponse> {
    const { data } = await api.get<BudgetListResponse>(
      API_ENDPOINTS.BUDGETS.LIST,
      { params: month ? { month } : undefined },
    );
    return data;
  },

  async getById(id: string): Promise<BudgetResponse> {
    const { data } = await api.get<BudgetResponse>(
      API_ENDPOINTS.BUDGETS.DETAIL(id),
    );
    return data;
  },

  async create(input: CreateBudgetInput): Promise<BudgetResponse> {
    const { data } = await api.post<BudgetResponse>(
      API_ENDPOINTS.BUDGETS.CREATE,
      input,
    );
    return data;
  },

  async update(input: UpdateBudgetInput): Promise<BudgetResponse> {
    const { id, ...payload } = input;
    const { data } = await api.put<BudgetResponse>(
      API_ENDPOINTS.BUDGETS.UPDATE(id),
      payload,
    );
    return data;
  },

  async delete(id: string): Promise<BudgetResponse> {
    const { data } = await api.delete<BudgetResponse>(
      API_ENDPOINTS.BUDGETS.DELETE(id),
    );
    return data;
  },
};