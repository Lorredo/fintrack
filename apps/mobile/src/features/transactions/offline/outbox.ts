import { create } from 'zustand';
import { randomUUID } from 'expo-crypto';

import { storage, StorageKeys } from '@/lib/storage';
import { addChange, type OutboxChange, type OutboxEntry } from './outbox.logic';

function load(): OutboxEntry[] {
  try {
    const saved = storage.get(StorageKeys.TRANSACTION_OUTBOX);
    const entries = saved ? JSON.parse(saved) : [];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function save(entries: OutboxEntry[]) {
  try {
    if (entries.length === 0) storage.remove(StorageKeys.TRANSACTION_OUTBOX);
    else storage.set(StorageKeys.TRANSACTION_OUTBOX, JSON.stringify(entries));
  } catch {
    // Kept in memory; it is saved again on the next change.
  }
}

interface OutboxState {
  entries: OutboxEntry[];
  add: (change: OutboxChange) => void;
  remove: (opId: string) => void;
  markFailed: (opId: string, error: string) => void;
  replace: (opId: string, entry: OutboxEntry) => void;
  clear: () => void;
}

// Saved in the app's encrypted storage on every change, so nothing is lost if
// the app is closed before it syncs.
export const useOutbox = create<OutboxState>((set, get) => {
  const update = (entries: OutboxEntry[]) => {
    save(entries);
    set({ entries });
  };
  return {
    entries: load(),
    add: (change) => update(addChange(get().entries, change, randomUUID(), Date.now())),
    remove: (opId) => update(get().entries.filter((entry) => entry.opId !== opId)),
    markFailed: (opId, error) =>
      update(get().entries.map((entry) => (entry.opId === opId ? { ...entry, status: 'failed', error } : entry))),
    replace: (opId, entry) => update(get().entries.map((item) => (item.opId === opId ? entry : item))),
    clear: () => update([]),
  };
});

export function newTransactionId(): string {
  return randomUUID();
}

/** The unsent change to a transaction, if any. */
export function outboxEntryFor(transactionId: string): OutboxEntry | undefined {
  return useOutbox.getState().entries.find((entry) => entry.transactionId === transactionId);
}
