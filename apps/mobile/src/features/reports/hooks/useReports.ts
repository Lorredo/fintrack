import { useQuery } from '@tanstack/react-query';

import { ReportsApi } from '../api/reports.api';
import type { MonthlyTrend, CategoryComparison } from '../types';

export function useTrends(months?: number, period: string = 'monthly') {
  return useQuery<MonthlyTrend[]>({
    queryKey: ['reports', 'trends', period, months ?? 6],
    queryFn: async () => {
      const response = await ReportsApi.getTrends(months, period);
      return response.trends;
    },
  });
}

export function useCategoryComparison(month?: string, period: string = 'monthly') {
  return useQuery<CategoryComparison[]>({
    queryKey: ['reports', 'categories', period, month ?? new Date().toISOString().slice(0, 10)],
    queryFn: async () => {
      const response = await ReportsApi.getCategoryComparison(month, period);
      return response.categoryComparisons;
    },
  });
}