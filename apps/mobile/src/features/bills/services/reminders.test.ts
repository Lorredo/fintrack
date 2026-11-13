import { describe, expect, it } from '@jest/globals';

import type { PayItem } from '../types';
import { planPayReminders } from './reminders';

const salary = (date: string): PayItem => ({ key: 'salary', name: 'Salary', kind: 'salary', amount: 7000, date, accountId: 'w1' });
const rice = (date: string): PayItem => ({
  key: 'income:rice allowance',
  name: 'Rice allowance',
  kind: 'allowance',
  amount: 1500,
  date,
  accountId: null,
});

describe('planPayReminders', () => {
  it('groups pay on the same day into one 9 AM reminder that opens the Dashboard', () => {
    const now = new Date(2026, 10, 15, 7, 0);
    const planned = planPayReminders({ pending: [salary('2026-11-15'), rice('2026-11-15')], upcoming: [salary('2026-11-30')] }, now);

    expect(planned.map((reminder) => reminder.identifier)).toEqual(['pay-2026-11-15', 'pay-2026-11-30']);
    expect(planned[0].date).toEqual(new Date(2026, 10, 15, 9, 0));
    expect(planned[0].title).toBe('Payday! Record your salary');
    expect(planned[0].body).toContain('Salary and Rice allowance');
    expect(planned[0].body).toContain('8,500');
    expect(planned[0].url).toBe('/');
  });

  it('names an allowance on its own and drops reminders already past', () => {
    const now = new Date(2026, 10, 15, 10, 0);
    const planned = planPayReminders({ pending: [salary('2026-11-15')], upcoming: [rice('2026-12-15')] }, now);

    expect(planned.map((reminder) => reminder.identifier)).toEqual(['pay-2026-12-15']);
    expect(planned[0].title).toBe('Rice allowance is in');
  });

  it('plans nothing before pay has loaded', () => {
    expect(planPayReminders(undefined)).toEqual([]);
  });
});
