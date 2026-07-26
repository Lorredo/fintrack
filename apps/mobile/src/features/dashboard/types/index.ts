import type { Transaction } from '@/features/transactions/types';

export interface CategorySummary {
  category: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  recentTransactions: Transaction[];
  categoryBreakdown: CategorySummary[];
}