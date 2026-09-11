export type PeriodType = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Budget {
  id: string;
  userId: string;
  accountId: string;
  category: string;
  amount: number;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  spent: number;
  remaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetInput {
  accountId: string;
  category: string;
  amount: number;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
}

export interface UpdateBudgetInput {
  id: string;
  accountId?: string;
  category?: string;
  amount?: number;
  periodType?: PeriodType;
  startDate?: string;
  endDate?: string;
}

export interface BudgetResponse {
  message: string;
  data?: Budget;
}

export interface BudgetListResponse {
  data: Budget[];
  total: number;
}
