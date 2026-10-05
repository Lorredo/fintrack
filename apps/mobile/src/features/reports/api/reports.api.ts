import { api } from '@/lib/api';
import { API_ENDPOINTS } from '@/shared/constants/api';

import type { TrendsResponse, CategoryComparisonResponse } from '../types';

export interface ReportFilters {
  startDate: string;
  endDate: string;
  accountId?: string;
  type?: string;
}

export const ReportsApi = {
  async getTrends(filters: ReportFilters): Promise<TrendsResponse> {
    const { data } = await api.get<TrendsResponse>(
      API_ENDPOINTS.REPORTS.TRENDS,
      { params: filters },
    );
    return data;
  },

  async getCategoryComparison(filters: ReportFilters): Promise<CategoryComparisonResponse> {
    const { data } = await api.get<CategoryComparisonResponse>(
      API_ENDPOINTS.REPORTS.CATEGORIES,
      { params: filters },
    );
    return data;
  },

  async exportCSV(filters: ReportFilters): Promise<string> {
    const { data } = await api.get<string>(
      API_ENDPOINTS.REPORTS.EXPORT,
      {
        params: { ...filters, format: 'json' },
      },
    );
    return data;
  },
};