import type { Account } from '@/features/accounts/types';
import type { Transaction, TransactionType } from '../types';

export function isAdjustment(type: TransactionType): boolean {
  return type === 'adjust_in' || type === 'adjust_out';
}

export function getWalletLabel(transaction: Transaction, accounts?: Account[]): string {
  const walletName = (id?: string) => accounts?.find((account) => account.id === id)?.name || 'Wallet';
  return transaction.type === 'transfer'
    ? `${walletName(transaction.accountId)} → ${walletName(transaction.transferAccountId)}`
    : walletName(transaction.accountId);
}

const NEUTRAL_COLOR = '#6B7280';

export function getAmountDisplay(type: TransactionType): { prefix: string; color: string } {
  switch (type) {
    case 'transfer':
      return { prefix: '⇄ ', color: NEUTRAL_COLOR };
    case 'adjust_in':
      return { prefix: '+', color: NEUTRAL_COLOR };
    case 'adjust_out':
      return { prefix: '-', color: NEUTRAL_COLOR };
    case 'expense':
      return { prefix: '-', color: '#EF4444' };
    default:
      return { prefix: '+', color: '#22C55E' };
  }
}
