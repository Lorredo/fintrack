import type { TransactionType } from '@/features/transactions/types';

export interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface CategoryComparison {
  category: string;
  type: 'income' | 'expense';
  currentMonthTotal: number;
  previousMonthTotal: number;
  change: number;
  changePercent: number;
}

export interface ExportRow {
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  wallet: string;
}

export interface ExportRowsResponse {
  rows: ExportRow[];
}

export interface TrendsResponse {
  trends: MonthlyTrend[];
}

export interface CategoryComparisonResponse {
  categoryComparisons: CategoryComparison[];
}