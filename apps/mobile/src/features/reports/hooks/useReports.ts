import { useQuery } from '@tanstack/react-query';

import { ReportsApi } from '../api/reports.api';
import type { MonthlyTrend, CategoryComparison } from '../types';

import type { ReportFilters } from '../api/reports.api';

export function useTrends(filters: ReportFilters) {
  return useQuery<MonthlyTrend[]>({
    queryKey: ['reports', 'trends', filters.startDate, filters.endDate, filters.accountId, filters.type],
    queryFn: async () => {
      const response = await ReportsApi.getTrends(filters);
      return response.trends;
    },
  });
}

export function useCategoryComparison(filters: ReportFilters) {
  return useQuery<CategoryComparison[]>({
    queryKey: ['reports', 'categories', filters.startDate, filters.endDate, filters.accountId, filters.type],
    queryFn: async () => {
      const response = await ReportsApi.getCategoryComparison(filters);
      return response.categoryComparisons;
    },
  });
}