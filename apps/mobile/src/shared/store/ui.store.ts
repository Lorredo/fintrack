import { create } from 'zustand';
import type { Transaction } from '@/features/transactions/types';
import type { Budget } from '@/features/budgets/types';

interface UIState {
  pendingAction: 'add_expense' | 'add_income' | 'add_budget' | null;
  setPendingAction: (action: 'add_expense' | 'add_income' | 'add_budget' | null) => void;
  
  editingTransaction: Transaction | null;
  setEditingTransaction: (transaction: Transaction | null) => void;
  
  editingBudget: Budget | null;
  setEditingBudget: (budget: Budget | null) => void;

  rebalancingBudget: Budget | null;
  setRebalancingBudget: (budget: Budget | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  pendingAction: null,
  setPendingAction: (action) => set({ pendingAction: action }),
  
  editingTransaction: null,
  setEditingTransaction: (transaction) => set({ editingTransaction: transaction }),
  
  editingBudget: null,
  setEditingBudget: (budget) => set({ editingBudget: budget }),

  rebalancingBudget: null,
  setRebalancingBudget: (budget) => set({ rebalancingBudget: budget }),
}));
