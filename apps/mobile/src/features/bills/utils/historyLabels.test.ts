import { describe, expect, it } from '@jest/globals';

import { periodOutcome, periodRange, periodResult, spentShare } from './historyLabels';
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
    expect(periodResult(base)).toEqual({ label: '₱900.00 under plan', tone: 'under' });
    expect(periodResult({ ...base, result: -600 })).toEqual({ label: '₱600.00 over plan', tone: 'over' });
  });

  it('says "On track" for the period in progress', () => {
    expect(periodResult({ ...base, current: true })?.label).toBe('On track');
  });

  it('has no pill without a plan', () => {
    expect(periodResult({ ...base, hasPlan: false })).toBeNull();
  });
});

describe('periodOutcome', () => {
  it('shows what was saved and left over', () => {
    // 17,000 received − 3,000 bills − 3,000 saved − 10,100 spent = 900 left.
    const { saved, left } = periodOutcome(base);
    expect(saved).toEqual({ label: 'Saved', amount: 3000, tone: 'under' });
    expect(left).toEqual({ label: 'Left over', amount: 900, tone: 'under' });
  });

  it('shows a shortfall when more went out than came in', () => {
    expect(periodOutcome({ ...base, spent: 12000 }).left).toEqual({ label: 'Short', amount: 1000, tone: 'over' });
  });

  it('uses what is left to spend for the period in progress', () => {
    const { saved, left } = periodOutcome({ ...base, current: true, result: 4200 });
    expect(saved.label).toBe('Saved so far');
    expect(left).toEqual({ label: 'Left to spend', amount: 4200, tone: 'under' });
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
