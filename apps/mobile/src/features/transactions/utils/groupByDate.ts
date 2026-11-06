import { formatDate, getLocalISODate } from '@/shared/utils/categories';
import type { Transaction } from '../types';

export interface TransactionSection {
  title: string;
  data: Transaction[];
}

function getDateTitle(date: string): string {
  const today = new Date();
  if (date === getLocalISODate(today)) return 'Today';
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date === getLocalISODate(yesterday)) return 'Yesterday';
  return formatDate(date);
}

/** Expects transactions sorted by date, as the API returns them. */
export function groupByDate(transactions: Transaction[]): TransactionSection[] {
  const sections: (TransactionSection & { date: string })[] = [];
  for (const transaction of transactions) {
    const last = sections[sections.length - 1];
    if (last?.date === transaction.date) {
      last.data.push(transaction);
    } else {
      sections.push({ date: transaction.date, title: getDateTitle(transaction.date), data: [transaction] });
    }
  }
  return sections;
}
