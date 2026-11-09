import type { Account } from '@/features/accounts/types';
import type { Transaction, TransactionType } from '../types';

export function isAdjustment(type: TransactionType): boolean {
  return type === 'adjust_in' || type === 'adjust_out';
}

export function isLoan(type: TransactionType): boolean {
  return type === 'loan_in' || type === 'loan_out';
}

/** Adjustments and utang/paluwagan entries are managed where they were made, not in the form. */
export function isEditableInForm(type: TransactionType): boolean {
  return !isAdjustment(type) && !isLoan(type);
}

export function getWalletLabel(transaction: Transaction, accounts?: Account[]): string {
  const walletName = (id?: string) => accounts?.find((account) => account.id === id)?.name || 'Wallet';
  return transaction.type === 'transfer'
    ? `${walletName(transaction.accountId)} → ${walletName(transaction.transferAccountId)}`
    : walletName(transaction.accountId);
}

const NEUTRAL_COLOR = '#6B7280';
const LOAN_COLOR = '#7C3AED';

export function getAmountDisplay(type: TransactionType): { prefix: string; color: string } {
  switch (type) {
    case 'transfer':
      return { prefix: '⇄ ', color: NEUTRAL_COLOR };
    case 'adjust_in':
      return { prefix: '+', color: NEUTRAL_COLOR };
    case 'adjust_out':
      return { prefix: '-', color: NEUTRAL_COLOR };
    case 'loan_in':
      return { prefix: '+', color: LOAN_COLOR };
    case 'loan_out':
      return { prefix: '-', color: LOAN_COLOR };
    case 'expense':
      return { prefix: '-', color: '#EF4444' };
    default:
      return { prefix: '+', color: '#22C55E' };
  }
}
