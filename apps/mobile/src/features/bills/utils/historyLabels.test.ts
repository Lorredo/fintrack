import { describe, expect, it } from '@jest/globals';

import { periodRange, periodResult, spentShare } from './historyLabels';
import type { PayPeriodSummary } from '../types';

const base: PayPeriodSummary = {
  start: '2026-11-13',
  end: '2026-11-26',
  current: false,
  daysLeft: 0,
  hasPlan: true,
  planEstimated: false,
  received: 17000,
  extraIncome: 2000,
  pay: 17000,
  payEstimated: false,
  bills: 3000,
  savingsTarget: 3000,
  movedToSavings: 3000,
  spendingMoney: 11000,
  spent: 10100,
  result: 900,
};

describe('periodResult', () => {
  it('shows under and over plan', () => {
    expect(periodResult(base)).toEqual({ label: '₱900.00 under', tone: 'under' });
    expect(periodResult({ ...base, result: -600 })).toEqual({ label: '₱600.00 over', tone: 'over' });
  });

  it('says "left" for the period in progress', () => {
    expect(periodResult({ ...base, current: true }).label).toBe('₱900.00 left');
  });

  it('shows what was kept without a plan', () => {
    expect(periodResult({ ...base, hasPlan: false, result: 2500 })).toEqual({ label: 'Kept ₱2,500.00', tone: 'neutral' });
  });
});

describe('periodRange', () => {
  it('adds the year only for other years', () => {
    expect(periodRange(base, 2026)).toBe('Nov 13 – Nov 26');
    expect(periodRange(base, 2027)).toBe('Nov 13 – Nov 26, 2026');
  });
});

describe('spentShare', () => {
  it('caps the bar and flags overspending', () => {
    expect(spentShare({ ...base, spent: 5500 })).toEqual({ share: 0.5, over: false });
    expect(spentShare({ ...base, spent: 12000 })).toEqual({ share: 1, over: true });
  });
});
