import { describe, expect, it } from '@jest/globals';

import type { Transaction } from '../types';
import { addChange, applyOutbox, balanceDeltas, type OutboxEntry } from './outbox.logic';

const NOW = Date.UTC(2026, 10, 16, 2, 0);

function saved(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'saved-1',
    userId: 'u1',
    accountId: 'gcash',
    type: 'expense',
    amount: 100,
    category: 'Food & Drinks',
    date: '2026-11-15',
    createdAt: '2026-11-15T01:00:00Z',
    updatedAt: '2026-11-15T01:00:00Z',
    ...overrides,
  };
}

const lunch = { id: 'new-1', accountId: 'gcash', type: 'expense' as const, amount: 85, category: 'Food & Drinks', date: '2026-11-16' };

describe('addChange', () => {
  it('folds an edit into a create that has not been sent', () => {
    let entries = addChange([], { kind: 'create', payload: lunch }, 'op1', NOW);
    entries = addChange(entries, { kind: 'update', payload: { id: 'new-1', amount: 95 }, original: saved() }, 'op2', NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'create', opId: 'op1', payload: { amount: 95, category: 'Food & Drinks' } });
  });

  it('forgets a create that is deleted before it is sent', () => {
    let entries = addChange([], { kind: 'create', payload: lunch }, 'op1', NOW);
    entries = addChange(entries, { kind: 'delete', transactionId: 'new-1', original: saved({ id: 'new-1' }) }, 'op2', NOW);
    expect(entries).toEqual([]);
  });

  it('merges edits, and turns edit then delete into one delete of the original', () => {
    const original = saved();
    let entries = addChange([], { kind: 'update', payload: { id: 'saved-1', amount: 120 }, original }, 'op1', NOW);
    entries = addChange(entries, { kind: 'update', payload: { id: 'saved-1', description: 'Jollibee' }, original: saved({ amount: 120 }) }, 'op2', NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'update', payload: { id: 'saved-1', amount: 120, description: 'Jollibee' }, original });

    entries = addChange(entries, { kind: 'delete', transactionId: 'saved-1', original: saved({ amount: 120 }) }, 'op3', NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'delete', original: { amount: 100 } });
  });

  it('sends a failed change again once it is edited', () => {
    const failed: OutboxEntry[] = [
      { opId: 'op1', kind: 'create', transactionId: 'new-1', payload: lunch, status: 'failed', error: 'Wallet not found', createdAt: NOW },
    ];
    const entries = addChange(failed, { kind: 'update', payload: { id: 'new-1', accountId: 'bank' }, original: saved() }, 'op2', NOW);
    expect(entries[0]).toMatchObject({ status: 'pending', error: undefined, payload: { accountId: 'bank' } });
  });
});

describe('applyOutbox', () => {
  const list = [saved(), saved({ id: 'saved-2', amount: 50, category: 'Transportation' })];

  it('puts new ones first, shows edits, and hides deletes', () => {
    let entries = addChange([], { kind: 'create', payload: lunch }, 'op1', NOW);
    entries = addChange(entries, { kind: 'update', payload: { id: 'saved-1', amount: 130 }, original: list[0] }, 'op2', NOW);
    entries = addChange(entries, { kind: 'delete', transactionId: 'saved-2', original: list[1] }, 'op3', NOW);

    const shown = applyOutbox(list, entries);
    expect(shown.map((item) => [item.id, item.amount, item.syncStatus])).toEqual([
      ['new-1', 85, 'pending'],
      ['saved-1', 130, 'pending'],
    ]);
  });

  it('keeps a row whose delete was refused, marked failed', () => {
    const entries: OutboxEntry[] = [
      { opId: 'op1', kind: 'delete', transactionId: 'saved-2', original: list[1], status: 'failed', error: 'Nope', createdAt: NOW },
    ];
    expect(applyOutbox(list, entries)[1]).toMatchObject({ id: 'saved-2', syncStatus: 'failed', syncError: 'Nope' });
  });

  it('only adds new ones that match the list filters', () => {
    const entries = addChange([], { kind: 'create', payload: lunch }, 'op1', NOW);
    expect(applyOutbox([], entries, { type: 'income' })).toEqual([]);
    expect(applyOutbox([], entries, { accountId: 'bank' })).toEqual([]);
    expect(applyOutbox([], entries, { search: 'food' })).toHaveLength(1);
    expect(applyOutbox([], entries, { dateFrom: '2026-11-01', dateTo: '2026-11-30' })).toHaveLength(1);
  });
});

describe('balanceDeltas', () => {
  it('takes an expense, and a transfer with its fee, out of the right wallets', () => {
    let entries = addChange([], { kind: 'create', payload: lunch }, 'op1', NOW);
    entries = addChange(
      entries,
      { kind: 'create', payload: { id: 'new-2', accountId: 'gcash', transferAccountId: 'bank', type: 'transfer', amount: 500, fee: 15, category: 'Transfer', date: '2026-11-16' } },
      'op2',
      NOW,
    );
    expect(Object.fromEntries(balanceDeltas(entries))).toEqual({ gcash: -600, bank: 500 });
  });

  it('undoes the original of an edit or delete', () => {
    const transfer = saved({ id: 't1', type: 'transfer', amount: 200, transferAccountId: 'bank' });
    let entries = addChange([], { kind: 'update', payload: { id: 't1', amount: 250 }, original: transfer }, 'op1', NOW);
    entries = addChange(entries, { kind: 'delete', transactionId: 'saved-1', original: saved() }, 'op2', NOW);
    // Transfer +50 more out of GCash into Bank; the deleted expense gives 100 back.
    expect(Object.fromEntries(balanceDeltas(entries))).toEqual({ gcash: 50, bank: 50 });
  });

  it('ignores changes the server refused', () => {
    const entries: OutboxEntry[] = [
      { opId: 'op1', kind: 'create', transactionId: 'new-1', payload: lunch, status: 'failed', createdAt: NOW },
    ];
    expect(balanceDeltas(entries).size).toBe(0);
  });
});
