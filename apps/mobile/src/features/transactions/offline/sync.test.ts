import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/storage', () => {
  const data = new Map<string, string>();
  return {
    storage: {
      get: (key: string) => data.get(key),
      set: (key: string, value: string) => data.set(key, value),
      remove: (key: string) => data.delete(key),
    },
    StorageKeys: { TRANSACTION_OUTBOX: 'transaction_outbox' },
  };
});

let mockNextId = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `op-${++mockNextId}` }));

const mockCreate = jest.fn<(input: unknown) => Promise<unknown>>();
const mockUpdate = jest.fn<(input: unknown) => Promise<unknown>>();
const mockRemove = jest.fn<(id: string) => Promise<unknown>>();
jest.mock('../api/transactions.api', () => ({
  TransactionApi: {
    create: (input: unknown) => mockCreate(input),
    update: (input: unknown) => mockUpdate(input),
    delete: (id: string) => mockRemove(id),
  },
}));

import type { Transaction } from '../types';
import { useOutbox } from './outbox';
import { flushOutbox } from './sync';

const original: Transaction = {
  id: 'saved-1',
  userId: 'u1',
  accountId: 'gcash',
  type: 'expense',
  amount: 100,
  category: 'Food & Drinks',
  date: '2026-11-15',
  createdAt: '2026-11-15T01:00:00Z',
  updatedAt: '2026-11-15T01:00:00Z',
};

const httpError = (status: number, message: string) => Object.assign(new Error(message), { response: { status, data: { message } } });

function queueThree() {
  const { add } = useOutbox.getState();
  add({ kind: 'create', payload: { id: 'new-1', accountId: 'gcash', type: 'expense', amount: 85, category: 'Food & Drinks', date: '2026-11-16' } });
  add({ kind: 'update', payload: { id: 'saved-1', amount: 120 }, original });
  add({ kind: 'delete', transactionId: 'saved-2', original: { ...original, id: 'saved-2' } });
}

beforeEach(() => {
  useOutbox.getState().clear();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockRemove.mockReset();
});

describe('flushOutbox', () => {
  it('sends changes oldest first and clears them', async () => {
    const order: string[] = [];
    mockCreate.mockImplementation(async () => {
      order.push('create');
      return { data: { ...original, id: 'new-1' } };
    });
    mockUpdate.mockImplementation(async () => order.push('update'));
    mockRemove.mockImplementation(async () => order.push('delete'));
    queueThree();

    await expect(flushOutbox()).resolves.toBe(true);
    expect(order).toEqual(['create', 'update', 'delete']);
    expect(useOutbox.getState().entries).toEqual([]);
  });

  it('stops and keeps everything when there is no reply', async () => {
    mockCreate.mockRejectedValue(new Error('Network Error'));
    queueThree();

    await expect(flushOutbox()).resolves.toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(useOutbox.getState().entries.map((entry) => entry.status)).toEqual(['pending', 'pending', 'pending']);
  });

  it('marks a refused change failed with the reason and carries on', async () => {
    mockCreate.mockRejectedValue(httpError(422, 'Insufficient balance in this wallet'));
    mockUpdate.mockResolvedValue({});
    // Already deleted on the server: that counts as done.
    mockRemove.mockRejectedValue(httpError(404, 'Transaction not found'));
    queueThree();

    await flushOutbox();
    expect(useOutbox.getState().entries).toEqual([
      expect.objectContaining({ kind: 'create', status: 'failed', error: 'Insufficient balance in this wallet' }),
    ]);
  });

  it('sends an edit made while the create was on its way', async () => {
    mockCreate.mockImplementation(async () => {
      useOutbox.getState().add({ kind: 'update', payload: { id: 'new-1', amount: 99 }, original });
      return { data: { ...original, id: 'new-1', amount: 85 } };
    });
    useOutbox.getState().add({ kind: 'create', payload: { id: 'new-1', accountId: 'gcash', type: 'expense', amount: 85, category: 'Food & Drinks', date: '2026-11-16' } });

    await flushOutbox();
    expect(useOutbox.getState().entries).toEqual([
      expect.objectContaining({ kind: 'update', status: 'pending', payload: expect.objectContaining({ id: 'new-1', amount: 99 }) }),
    ]);
  });
});
