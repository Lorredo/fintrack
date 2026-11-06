export type AccountType = 'cash' | 'bank' | 'ewallet' | 'investment';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  color?: string;
  balance: number;
  lastAdjustedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  color?: string;
}

export interface UpdateAccountInput {
  id: string;
  name?: string;
  type?: AccountType;
  color?: string;
}

export interface SetBalanceInput {
  id: string;
  balance: number;
  date: string;
}

export interface SetBalanceResult {
  balance: number;
  adjusted: boolean;
}

export interface AccountResponse {
  message: string;
  data: Account;
}

export interface AccountListResponse {
  message: string;
  data: Account[];
}
