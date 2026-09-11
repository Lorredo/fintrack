export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  transferAccountId?: string;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  accountId: string;
  transferAccountId?: string;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export interface UpdateTransactionInput {
  id: string;
  accountId?: string;
  transferAccountId?: string;
  type?: TransactionType;
  amount?: number;
  category?: string;
  description?: string;
  date?: string;
}

export interface TransactionResponse {
  message: string;
  data: Transaction;
}

export interface TransactionListResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionListParams {
  accountId?: string;
  type?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}
