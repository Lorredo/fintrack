import { describe, expect, it } from '@jest/globals';

import { convertForSchedule, extraIncomeHelp, switchPrompt } from './payScheduleLabels';

describe('convertForSchedule', () => {
  it('doubles per-payday amounts for a month and halves them back', () => {
    expect(convertForSchedule(15000, 'semi_monthly', 'irregular')).toBe(30000);
    expect(convertForSchedule(30000, 'irregular', 'semi_monthly')).toBe(15000);
    expect(convertForSchedule(1000.01, 'irregular', 'semi_monthly')).toBe(500.01);
    expect(convertForSchedule(15000, 'semi_monthly', 'semi_monthly')).toBe(15000);
  });
});

describe('switchPrompt', () => {
  it('offers converted amounts', () => {
    const prompt = switchPrompt('semi_monthly', 'irregular', 15000, 2000);
    expect(prompt?.salary).toBe(30000);
    expect(prompt?.savings).toBe(4000);
    expect(prompt?.message).toContain('₱15,000.00 each payday → ₱30,000.00 a month');
  });

  it('asks nothing when there are no amounts or no change', () => {
    expect(switchPrompt('semi_monthly', 'irregular', 0, 0)).toBeNull();
    expect(switchPrompt('irregular', 'irregular', 30000, 0)).toBeNull();
  });
});

describe('extraIncomeHelp', () => {
  it('explains each schedule its own way', () => {
    expect(extraIncomeHelp('irregular', 50)).toContain('expected monthly income');
    expect(extraIncomeHelp('semi_monthly', 100)).toContain('Overtime');
  });
});
