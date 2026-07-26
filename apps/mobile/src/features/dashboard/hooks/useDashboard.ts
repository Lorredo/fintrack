import { useQuery } from '@tanstack/react-query';

import { DashboardApi } from '../api/dashboard.api';

export const DASHBOARD_KEYS = {
  all: ['dashboard'] as const,
  summary: (month?: string) => [...DASHBOARD_KEYS.all, 'summary', month] as const,
};

export function useDashboardSummary(month?: string) {
  return useQuery({
    queryKey: DASHBOARD_KEYS.summary(month),
    queryFn: () => DashboardApi.getSummary(month),
  });
}