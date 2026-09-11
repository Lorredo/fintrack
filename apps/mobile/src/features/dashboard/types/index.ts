import type { Transaction } from '@/features/transactions/types';
import type { Budget } from '@/features/budgets/types';

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
  activeBudgets: Budget[];
}
export interface DashboardSummaryResponse {
  message: string;
  data: DashboardSummary;
}
