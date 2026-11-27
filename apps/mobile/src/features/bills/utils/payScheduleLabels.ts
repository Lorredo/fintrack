import { formatCurrency } from '@/shared/utils/categories';
import type { PaySchedule, PaySettings } from '../types';

/** Two paydays make a month: amounts per payday double on Irregular and halve back. */
export function convertForSchedule(amount: number, from: PaySchedule, to: PaySchedule): number {
  if (from === to || amount <= 0) return amount;
  const converted = to === 'irregular' ? amount * 2 : amount / 2;
  return Math.round(converted * 100) / 100;
}

/** The short name shown on the Safe to Spend card. */
export function scheduleShortName(schedule: PaySchedule | null): string {
  return schedule === 'irregular' ? 'Irregular · monthly' : '15th & 30th';
}

/** What the schedule means, under the choice in Pay settings. */
export function scheduleSummary(schedule: PaySchedule | null): string {
  return schedule === 'irregular'
    ? 'Safe to Spend runs month to month, from the 1st to the last day. There are no fixed paydays, so FinTrack only asks you to record allowances on their days.'
    : 'Safe to Spend runs from payday to payday. When the 15th or 30th is a weekend or holiday, payday is the working day before. In February, the 30th is the last day of the month.';
}

export function amountLabel(schedule: PaySchedule | null): string {
  return schedule === 'irregular' ? 'Expected income per month' : 'Salary per payday';
}

export function savingsLabel(schedule: PaySchedule | null): string {
  return schedule === 'irregular' ? 'Set aside for savings each month' : 'Set aside for savings each payday';
}

/** How extra income is treated, which differs by schedule. */
export function extraIncomeHelp(schedule: PaySchedule | null, split: PaySettings['extraToSavingsPercent']): string {
  const where =
    split === 50
      ? 'half goes to savings and half to spending'
      : split === 100
        ? 'it all goes to savings'
        : 'it all goes to spending';
  return schedule === 'irregular'
    ? `All income counts toward your expected monthly income. Anything above it is extra: ${where}.`
    : `Income in Overtime, Bonus & Commission or any category other than Salary and Allowance is extra as soon as you record it, and so is salary above what you set: ${where}.`;
}

/**
 * The question asked when switching schedules with amounts already set, or
 * null when there's nothing to convert.
 */
export function switchPrompt(
  from: PaySchedule,
  to: PaySchedule,
  salary: number,
  savings: number,
): { title: string; message: string; salary: number; savings: number } | null {
  if (from === to || (salary <= 0 && savings <= 0)) return null;
  const newSalary = convertForSchedule(salary, from, to);
  const newSavings = convertForSchedule(savings, from, to);
  const fromUnit = from === 'irregular' ? 'a month' : 'each payday';
  const toUnit = to === 'irregular' ? 'a month' : 'each payday';
  const lines: string[] = [];
  if (salary > 0) lines.push(`Income: ${formatCurrency(salary)} ${fromUnit} → ${formatCurrency(newSalary)} ${toUnit}`);
  if (savings > 0) lines.push(`Savings: ${formatCurrency(savings)} ${fromUnit} → ${formatCurrency(newSavings)} ${toUnit}`);
  return {
    title: to === 'irregular' ? 'Switch to Irregular / freelance?' : 'Switch to 15th and 30th?',
    message: `Your amounts are ${from === 'irregular' ? 'per month' : 'per payday'}. ${
      to === 'irregular' ? 'Irregular pay plans a whole month' : 'The 15th and 30th plans each half month'
    }, so they should change too:\n\n${lines.join('\n')}`,
    salary: newSalary,
    savings: newSavings,
  };
}
