import { formatCurrency } from '@/shared/utils/categories';
import { formatShortDate } from '@/features/bills/utils/billLabels';
import type { Debt, PaluwaganFrequency } from '../types';

export const FREQUENCY_LABELS: Record<PaluwaganFrequency, string> = {
  weekly: 'Every week',
  semi_monthly: 'Every 15th and 30th',
  monthly: 'Every month',
};

/** Days from today (YYYY-MM-DD) to a date, negative when past. */
export function daysFromToday(isoDate: string, today: string): number {
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = isoDate.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function dueLabel(debt: Debt, today: string): { text: string; overdue: boolean } | null {
  if (debt.settled) return { text: 'Paid in full', overdue: false };
  if (!debt.dueDate) return null;
  const days = daysFromToday(debt.dueDate, today);
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: false };
  if (days === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${formatShortDate(debt.dueDate)}`, overdue: false };
}

/** A friendly reminder to send through Messenger, SMS or Viber. */
export function reminderMessage(personName: string, debts: Debt[]): string {
  const owed = debts.filter((debt) => debt.direction === 'lent' && !debt.settled);
  const total = owed.reduce((sum, debt) => sum + debt.remaining, 0);
  const firstName = personName.trim().split(/\s+/)[0];
  const since = owed.length === 1 ? ` from ${formatShortDate(owed[0].date)}` : '';
  return `Hi ${firstName}! Friendly reminder about the ${formatCurrency(total)}${since}. No rush, just let me know when you can. Thank you! 😊`;
}
