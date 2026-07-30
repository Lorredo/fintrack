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

export interface TrendsResponse {
  trends: MonthlyTrend[];
}

export interface CategoryComparisonResponse {
  categoryComparisons: CategoryComparison[];
}