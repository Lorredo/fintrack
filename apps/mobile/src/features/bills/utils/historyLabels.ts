import { formatCurrency } from '@/shared/utils/categories';
import type { PayPeriodSummary } from '../types';
import { formatShortDate } from './billLabels';

export type ResultTone = 'under' | 'over' | 'neutral';

/**
 * The pill on a history row: how spending compared with the plan. Null
 * without a plan (no salary or regular income), when there's nothing to
 * compare with.
 */
export function periodResult(period: PayPeriodSummary): { label: string; tone: ResultTone } | null {
  if (!period.hasPlan) return null;
  if (period.current) {
    return period.result >= 0
      ? { label: 'On track', tone: 'under' }
      : { label: `${formatCurrency(-period.result)} over plan`, tone: 'over' };
  }
  return period.result >= 0
    ? { label: `${formatCurrency(period.result)} under plan`, tone: 'under' }
    : { label: `${formatCurrency(-period.result)} over plan`, tone: 'over' };
}

/** Money from a period's pay that wasn't used: received − bills − saved − spent. */
export function leftOver(period: PayPeriodSummary): number {
  return Math.round((period.received - period.bills - period.movedToSavings - period.spent) * 100) / 100;
}

export interface Figure {
  label: string;
  amount: number;
  tone: ResultTone;
}

/**
 * The two figures at the bottom of a row: what was saved, and what was left.
 * For the period in progress with a plan, "left" is what's left to spend, as
 * on the Safe to Spend card.
 */
export function periodOutcome(period: PayPeriodSummary): { saved: Figure; left: Figure } {
  const saved: Figure = {
    label: period.current ? 'Saved so far' : 'Saved',
    amount: period.movedToSavings,
    tone: period.movedToSavings > 0 ? 'under' : 'neutral',
  };
  if (period.current && period.hasPlan) {
    return {
      saved,
      left:
        period.result >= 0
          ? { label: 'Left to spend', amount: period.result, tone: 'under' }
          : { label: 'Over plan by', amount: -period.result, tone: 'over' },
    };
  }
  const left = leftOver(period);
  return {
    saved,
    left:
      left >= 0
        ? { label: period.current ? 'Left so far' : 'Left over', amount: left, tone: left > 0 ? 'under' : 'neutral' }
        : { label: 'Short', amount: -left, tone: 'over' },
  };
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
