import { api } from '@/lib/api';
import { API_ENDPOINTS } from '@/shared/constants/api';

import type { DashboardSummary } from '../types';

export const DashboardApi = {
  async getSummary(month?: string): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>(
      API_ENDPOINTS.DASHBOARD.SUMMARY,
      { params: month ? { month } : undefined },
    );
    return data;
  },
};