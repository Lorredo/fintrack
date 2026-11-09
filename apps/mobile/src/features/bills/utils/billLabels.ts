import type { Bill, BillFrequency, RegularIncome } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 15" from YYYY-MM-DD, without going through time zones. */
export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

export const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

/** "Due today", "Due in 3 days", "2 days overdue". */
export function dueLabel(bill: Bill): string {
  if (!bill.active) return 'Paused';
  const days = bill.daysUntil;
  if (days < 0) {
    const late = -days;
    const extra = bill.overdueCount > 1 ? ` · ${bill.overdueCount} unpaid` : '';
    return `${late} day${late === 1 ? '' : 's'} overdue${extra}`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days · ${formatShortDate(bill.nextDue)}`;
}

export const STATUS_COLORS: Record<Bill['status'], { text: string; bg: string }> = {
  overdue: { text: '#B91C1C', bg: '#FEE2E2' },
  due_soon: { text: '#B45309', bg: '#FEF3C7' },
  upcoming: { text: '#4B5563', bg: '#F3F4F6' },
  paused: { text: '#9CA3AF', bg: '#F3F4F6' },
};

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINALS = ['', 'First', 'Second', 'Third', 'Fourth', 'Last'];

function ordinalDay(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`;
}

/** "Every 15th" or "First Friday of the month". */
export function describeRegularIncome(income: RegularIncome): string {
  if (income.kind === 'weekday') {
    return `${ORDINALS[income.nth ?? 1]} ${WEEKDAY_NAMES[income.weekday ?? 0]} of the month`;
  }
  return `Every ${ordinalDay(income.day ?? 1)}`;
}
