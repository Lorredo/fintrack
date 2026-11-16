import type { CreateTransactionInput, Transaction, TransactionListParams, UpdateTransactionInput } from '../types';

// Changes saved on the phone while offline, waiting to be sent. There is at
// most one entry per transaction: later changes to the same transaction are
// merged into it, so the order between entries never matters.

export type SyncStatus = 'pending' | 'failed';

interface EntryBase {
  opId: string;
  transactionId: string;
  status: SyncStatus;
  /** Why the server refused it, when status is 'failed'. */
  error?: string;
  createdAt: number;
}

export interface CreateEntry extends EntryBase {
  kind: 'create';
  payload: CreateTransactionInput & { id: string };
}

export interface UpdateEntry extends EntryBase {
  kind: 'update';
  payload: UpdateTransactionInput;
  /** The saved transaction before this change. */
  original: Transaction;
}

export interface DeleteEntry extends EntryBase {
  kind: 'delete';
  original: Transaction;
}

export type OutboxEntry = CreateEntry | UpdateEntry | DeleteEntry;

export type OutboxChange =
  | { kind: 'create'; payload: CreateTransactionInput & { id: string } }
  | { kind: 'update'; payload: UpdateTransactionInput; original: Transaction }
  | { kind: 'delete'; transactionId: string; original: Transaction };

/** A transaction as the app shows it, with its sync state when not yet saved. */
export type ShownTransaction = Transaction & { syncStatus?: SyncStatus; syncError?: string };

function changeId(change: OutboxChange) {
  return change.kind === 'create' ? change.payload.id : change.kind === 'update' ? change.payload.id : change.transactionId;
}

/** Adds a change, merging it with an earlier unsent change to the same transaction. */
export function addChange(entries: OutboxEntry[], change: OutboxChange, opId: string, now: number): OutboxEntry[] {
  const transactionId = changeId(change);
  const index = entries.findIndex((entry) => entry.transactionId === transactionId);
  const existing = index >= 0 ? entries[index] : undefined;
  const replace = (entry: OutboxEntry | null) =>
    entry ? entries.map((item, i) => (i === index ? entry : item)) : entries.filter((_, i) => i !== index);
  // A changed entry is tried again, even if it failed before.
  const fresh = { status: 'pending' as const, error: undefined };

  if (change.kind === 'create') {
    return [...entries, { opId, kind: 'create', transactionId, payload: change.payload, status: 'pending', createdAt: now }];
  }

  if (change.kind === 'update') {
    const { id: _id, ...fields } = change.payload;
    if (existing?.kind === 'create') return replace({ ...existing, ...fresh, payload: { ...existing.payload, ...fields } });
    if (existing?.kind === 'update') return replace({ ...existing, ...fresh, payload: { ...existing.payload, ...fields } });
    if (existing?.kind === 'delete') return entries;
    return [...entries, { opId, kind: 'update', transactionId, payload: change.payload, original: change.original, status: 'pending', createdAt: now }];
  }

  // Deleting something never sent just forgets it.
  if (existing?.kind === 'create') return replace(null);
  if (existing?.kind === 'update') {
    return replace({ opId: existing.opId, kind: 'delete', transactionId, original: existing.original, ...fresh, createdAt: existing.createdAt });
  }
  if (existing?.kind === 'delete') return entries;
  return [...entries, { opId, kind: 'delete', transactionId, original: change.original, status: 'pending', createdAt: now }];
}

function shownFromCreate(entry: CreateEntry): ShownTransaction {
  const { fee: _fee, id, ...fields } = entry.payload;
  const created = new Date(entry.createdAt).toISOString();
  return { ...fields, id, userId: '', createdAt: created, updatedAt: created, syncStatus: entry.status, syncError: entry.error };
}

function matches(transaction: Transaction, params?: Omit<TransactionListParams, 'page' | 'limit'>) {
  if (!params) return true;
  if (params.accountId && transaction.accountId !== params.accountId && transaction.transferAccountId !== params.accountId) return false;
  if (params.type && transaction.type !== params.type) return false;
  if (params.category && transaction.category !== params.category) return false;
  if (params.dateFrom && transaction.date < params.dateFrom) return false;
  if (params.dateTo && transaction.date > params.dateTo) return false;
  if (params.search) {
    const text = `${transaction.description ?? ''} ${transaction.category}`.toLowerCase();
    if (!text.includes(params.search.toLowerCase())) return false;
  }
  return true;
}

/**
 * Shows unsent changes on top of a list from the server: deleted rows are
 * hidden, edited rows show their new values, and new ones come first.
 */
export function applyOutbox(
  transactions: Transaction[],
  entries: OutboxEntry[],
  params?: Omit<TransactionListParams, 'page' | 'limit'>,
): ShownTransaction[] {
  if (entries.length === 0) return transactions;
  const byId = new Map(entries.map((entry) => [entry.transactionId, entry]));
  const shown: ShownTransaction[] = [];
  for (const transaction of transactions) {
    const entry = byId.get(transaction.id);
    if (!entry) {
      shown.push(transaction);
    } else if (entry.kind === 'update') {
      const updated = { ...transaction, ...entry.payload, syncStatus: entry.status, syncError: entry.error };
      if (matches(updated, params)) shown.push(updated);
    } else if (entry.kind === 'delete' && entry.status === 'failed') {
      shown.push({ ...transaction, syncStatus: 'failed', syncError: entry.error });
    }
  }
  const created = entries
    .filter((entry): entry is CreateEntry => entry.kind === 'create')
    .map(shownFromCreate)
    .filter((transaction) => matches(transaction, params))
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  return [...created, ...shown];
}

type Moves = Pick<Transaction, 'type' | 'amount' | 'accountId' | 'transferAccountId'> & { fee?: number };

// The same rules as the server's balance: income adds, expense takes away,
// and a transfer moves money (plus any fee) out of one wallet into another.
function addMoves(deltas: Map<string, number>, moves: Moves, sign: 1 | -1) {
  const add = (accountId: string | undefined, amount: number) => {
    if (!accountId || !amount) return;
    deltas.set(accountId, (deltas.get(accountId) ?? 0) + sign * amount);
  };
  switch (moves.type) {
    case 'income':
    case 'adjust_in':
    case 'loan_in':
      add(moves.accountId, moves.amount);
      break;
    case 'expense':
    case 'adjust_out':
    case 'loan_out':
      add(moves.accountId, -moves.amount);
      break;
    case 'transfer':
      add(moves.accountId, -(moves.amount + (moves.fee ?? 0)));
      add(moves.transferAccountId, moves.amount);
      break;
  }
}

/** How much each wallet's balance changes once the unsent changes are saved. */
export function balanceDeltas(entries: OutboxEntry[]): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const entry of entries) {
    // A refused change isn't saved anywhere, so it doesn't move money.
    if (entry.status === 'failed') continue;
    if (entry.kind === 'create') {
      addMoves(deltas, entry.payload, 1);
    } else if (entry.kind === 'update') {
      addMoves(deltas, entry.original, -1);
      addMoves(deltas, { ...entry.original, ...entry.payload }, 1);
    } else {
      addMoves(deltas, entry.original, -1);
    }
  }
  for (const [accountId, delta] of deltas) deltas.set(accountId, Math.round(delta * 100) / 100);
  return deltas;
}
