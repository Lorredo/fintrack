import { api } from '@/lib/api';
import { API_ENDPOINTS } from '@/shared/constants/api';

import type { TrendsResponse, CategoryComparisonResponse, ExportRow, ExportRowsResponse } from '../types';

// An export is often the first request after the free Render instance sleeps.
const EXPORT_TIMEOUT_MS = 90_000;

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

  async getExportRows(filters: ReportFilters): Promise<ExportRow[]> {
    const { data } = await api.get<ExportRowsResponse>(
      API_ENDPOINTS.REPORTS.EXPORT,
      {
        params: { ...filters, format: 'rows' },
        timeout: EXPORT_TIMEOUT_MS,
      },
    );
    return data.rows;
  },

  async getWorkbook(filters: ReportFilters): Promise<ArrayBuffer> {
    const { data } = await api.get<ArrayBuffer>(
      API_ENDPOINTS.REPORTS.EXPORT,
      {
        params: { ...filters, format: 'xlsx' },
        responseType: 'arraybuffer',
        timeout: EXPORT_TIMEOUT_MS,
      },
    );
    return data;
  },
};