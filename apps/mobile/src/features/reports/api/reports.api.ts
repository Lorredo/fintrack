import { api } from '@/lib/api';
import { API_ENDPOINTS } from '@/shared/constants/api';

import type { TrendsResponse, CategoryComparisonResponse } from '../types';

export const ReportsApi = {
  async getTrends(months?: number): Promise<TrendsResponse> {
    const { data } = await api.get<TrendsResponse>(
      API_ENDPOINTS.REPORTS.TRENDS,
      { params: months ? { months } : undefined },
    );
    return data;
  },

  async getCategoryComparison(month?: string): Promise<CategoryComparisonResponse> {
    const { data } = await api.get<CategoryComparisonResponse>(
      API_ENDPOINTS.REPORTS.CATEGORIES,
      { params: month ? { month } : undefined },
    );
    return data;
  },

  async exportCSV(month?: string): Promise<string> {
    const { data } = await api.get<string>(
      API_ENDPOINTS.REPORTS.EXPORT,
      {
        params: { ...(month ? { month } : {}), format: 'json' },
      },
    );
    return data;
  },
};