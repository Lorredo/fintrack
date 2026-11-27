import { formatCurrency } from '@/shared/utils/categories';
import type { PayPeriodSummary } from '../types';
import { formatShortDate } from './billLabels';

export type ResultTone = 'under' | 'over' | 'neutral';

/** The pill on a history row: under or over plan, or what was kept without one. */
export function periodResult(period: PayPeriodSummary): { label: string; tone: ResultTone } {
  if (!period.hasPlan) {
    return period.result >= 0
      ? { label: `Kept ${formatCurrency(period.result)}`, tone: 'neutral' }
      : { label: `${formatCurrency(-period.result)} more out than in`, tone: 'over' };
  }
  if (period.result >= 0) {
    return { label: `${formatCurrency(period.result)} ${period.current ? 'left' : 'under'}`, tone: 'under' };
  }
  return { label: `${formatCurrency(-period.result)} over`, tone: 'over' };
}

/** "Nov 13 – Nov 26", with the year when it isn't the current one. */
export function periodRange(period: PayPeriodSummary, currentYear = new Date().getFullYear()): string {
  const year = Number(period.end.slice(0, 4));
  const range = `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
  return year === currentYear ? range : `${range}, ${year}`;
}

/** How full the planned-vs-spent bar is, from 0 to 1, and whether spending went past the plan. */
export function spentShare(period: PayPeriodSummary): { share: number; over: boolean } {
  if (period.spendingMoney <= 0) return { share: period.spent > 0 ? 1 : 0, over: period.spent > 0 };
  return { share: Math.min(period.spent / period.spendingMoney, 1), over: period.spent > period.spendingMoney };
}
