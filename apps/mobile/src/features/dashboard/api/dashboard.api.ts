import { api } from '@/lib/api';
import { API_ENDPOINTS } from '@/shared/constants/api';
import type { DashboardSummary, DashboardSummaryResponse } from '../types';

export const DashboardApi = {
  getSummary: async (month?: string, accountId?: string): Promise<DashboardSummary> => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (accountId) params.append('account_id', accountId);

    const { data } = await api.get<DashboardSummaryResponse>(
      `${API_ENDPOINTS.DASHBOARD.SUMMARY}?${params.toString()}`
    );
    return data.data;
  },
};
