import { useQuery } from '@tanstack/react-query';

import { ReportsApi } from '../api/reports.api';
import type { MonthlyTrend, CategoryComparison } from '../types';

export function useTrends(months?: number) {
  return useQuery<MonthlyTrend[]>({
    queryKey: ['reports', 'trends', months ?? 6],
    queryFn: async () => {
      const response = await ReportsApi.getTrends(months);
      return response.trends;
    },
  });
}

export function useCategoryComparison(month?: string) {
  return useQuery<CategoryComparison[]>({
    queryKey: ['reports', 'categories', month ?? new Date().toISOString().slice(0, 7)],
    queryFn: async () => {
      const response = await ReportsApi.getCategoryComparison(month);
      return response.categoryComparisons;
    },
  });
}