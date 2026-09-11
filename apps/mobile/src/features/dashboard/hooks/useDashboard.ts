import { useQuery } from '@tanstack/react-query';
import { DashboardApi } from '../api/dashboard.api';

export const DASHBOARD_KEYS = {
  all: ['dashboard'] as const,
  summary: (month?: string, accountId?: string) => [...DASHBOARD_KEYS.all, 'summary', month, accountId] as const,
};

export function useDashboardSummary(month?: string, accountId?: string) {
  return useQuery({
    queryKey: DASHBOARD_KEYS.summary(month, accountId),
    queryFn: () => DashboardApi.getSummary(month, accountId),
  });
}
