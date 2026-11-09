export type BillFrequency = 'weekly' | 'monthly' | 'yearly';
export type BillStatus = 'overdue' | 'due_soon' | 'upcoming' | 'paused';
export type PaySchedule = 'semi_monthly' | 'irregular';

export interface Bill {
  id: string;
  accountId: string | null;
  name: string;
  category: string;
  amount: number;
  frequency: BillFrequency;
  /** The first due date, YYYY-MM-DD. */
  startDate: string;
  remindDaysBefore: number;
  active: boolean;
  notes: string | null;
  /** The earliest unpaid due date, which may be overdue. */
  nextDue: string;
  /** Days from today to nextDue, negative when overdue. */
  daysUntil: number;
  overdueCount: number;
  status: BillStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillInput {
  accountId?: string | null;
  name: string;
  category?: string;
  amount: number;
  frequency: BillFrequency;
  startDate: string;
  remindDaysBefore?: number;
  notes?: string | null;
}

export interface UpdateBillInput extends Partial<CreateBillInput> {
  id: string;
  active?: boolean;
}

export interface PayBillInput {
  id: string;
  dueDate: string;
  date: string;
  amount?: number;
  accountId?: string;
}

export interface SkipBillInput {
  id: string;
  dueDate: string;
}

/** Pay besides the salary that arrives every month, such as an allowance. */
export interface RegularIncome {
  name: string;
  amount: number;
  /** 'day': on day `day` of the month. 'weekday': the `nth` `weekday`, where nth 5 is the last. */
  kind: 'day' | 'weekday';
  day?: number;
  nth?: number;
  /** 0 is Sunday. */
  weekday?: number;
}

export interface ExpectedIncome {
  name: string;
  amount: number;
  date: string;
}

export interface PaySettings {
  paySchedule: PaySchedule | null;
  savingsPerPayday: number;
  billReminders: boolean;
  /** 0 means Safe to Spend uses wallet balances only. */
  salaryPerPayday: number;
  /** Share of income above the salary (overtime, bonuses) that goes to savings. */
  extraToSavingsPercent: 0 | 50 | 100;
  regularIncomes: RegularIncome[];
}

export interface ReservedBill {
  billId: string;
  name: string;
  dueDate: string;
  amount: number;
  overdue: boolean;
}

export interface SafeToSpend {
  configured: boolean;
  paySchedule: PaySchedule | null;
  today: string;
  nextPayday: string;
  daysLeft: number;
  balance: number;
  billsReserved: number;
  savingsTarget: number;
  savingsMoved: number;
  savingsReserved: number;
  spendable: number;
  perDay: number;
  bills: ReservedBill[];

  mode: 'salary' | 'balance';
  periodStart: string;
  /** The balance-based amount, which also caps the salary plan. */
  balanceLeft: number;
  limitedByBalance: boolean;

  // Salary mode.
  salary: number;
  incomeRecorded: number;
  /** True until the salary has been recorded as income this period. */
  payEstimated: boolean;
  /** Salary plus the regular income due this period. */
  expectedPay: number;
  regularIncome: ExpectedIncome[];
  pay: number;
  extraIncome: number;
  extraSaved: number;
  billsThisPeriod: number;
  periodBills: ReservedBill[];
  spendingMoney: number;
  spentSincePayday: number;
  plannedLeft: number;
}
