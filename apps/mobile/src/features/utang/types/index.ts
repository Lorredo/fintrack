export type DebtDirection = 'lent' | 'borrowed';

export interface DebtPayment {
  id: string;
  amount: number;
  date: string;
  accountId: string | null;
  transactionId: string | null;
}

export interface Debt {
  id: string;
  personName: string;
  /** 'lent': they owe you. 'borrowed': you owe them. */
  direction: DebtDirection;
  amount: number;
  accountId: string | null;
  date: string;
  dueDate: string | null;
  notes: string | null;
  paid: number;
  remaining: number;
  settled: boolean;
  payments: DebtPayment[];
}

export interface PersonBalance {
  personName: string;
  owedToYou: number;
  youOwe: number;
  /** Positive: they owe you. Negative: you owe them. */
  net: number;
}

export interface DebtSummary {
  debts: Debt[];
  people: PersonBalance[];
  owedToYou: number;
  youOwe: number;
}

export interface CreateDebtInput {
  personName: string;
  direction: DebtDirection;
  amount: number;
  accountId: string;
  date: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface UpdateDebtInput {
  id: string;
  personName?: string;
  dueDate?: string;
  clearDueDate?: boolean;
  notes?: string;
}

export interface DebtPaymentInput {
  id: string;
  amount: number;
  date: string;
  accountId?: string;
}

export type PaluwaganFrequency = 'weekly' | 'semi_monthly' | 'monthly';

export interface PaluwaganRound {
  round: number;
  date: string;
  contributed: boolean;
  isMyTurn: boolean;
  payoutReceived: boolean;
  isPast: boolean;
}

export interface Paluwagan {
  id: string;
  name: string;
  contribution: number;
  frequency: PaluwaganFrequency;
  startDate: string;
  members: number;
  myTurn: number;
  payoutAmount: number;
  accountId: string | null;
  active: boolean;
  rounds: PaluwaganRound[];
  nextContribution: PaluwaganRound | null;
  myPayoutDate: string;
  totalContributed: number;
  contributedCount: number;
  overdueCount: number;
  finished: boolean;
}

export interface CreatePaluwaganInput {
  name: string;
  contribution: number;
  frequency: PaluwaganFrequency;
  startDate: string;
  members: number;
  myTurn: number;
  payoutAmount?: number;
  accountId?: string | null;
}

export interface UpdatePaluwaganInput {
  id: string;
  name?: string;
  contribution?: number;
  myTurn?: number;
  payoutAmount?: number;
  accountId?: string;
  active?: boolean;
}

export interface PaluwaganRoundInput {
  id: string;
  round: number;
  date: string;
  amount?: number;
  accountId?: string;
}
