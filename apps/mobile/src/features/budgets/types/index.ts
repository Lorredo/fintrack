export interface Budget {
  id: string;
  userId: string;
  category: string;
  amount: number;
  month: string;
  spent: number;
  remaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetInput {
  category: string;
  amount: number;
  month: string;
}

export interface UpdateBudgetInput {
  id: string;
  category?: string;
  amount?: number;
  month?: string;
}

export interface BudgetResponse {
  message: string;
  data?: Budget;
}

export interface BudgetListResponse {
  data: Budget[];
  total: number;
}