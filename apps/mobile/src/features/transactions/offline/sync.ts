import type { AxiosError } from 'axios';

import { getErrorMessage } from '@/shared/utils/apiErrors';
import { TransactionApi } from '../api/transactions.api';
import type { Transaction } from '../types';
import type { OutboxEntry } from './outbox.logic';
import { useOutbox } from './outbox';

export type SyncResult = 'sent' | 'gone' | 'retry' | 'refused';

/**
 * Sorts a failed send: no reply or a server error is tried again later; any
 * other refusal is shown to the user to fix or discard.
 */
export function classifySyncError(entry: OutboxEntry, error: unknown): SyncResult {
  const status = (error as AxiosError)?.response?.status;
  if (status === undefined || status >= 500 || status === 401 || status === 408 || status === 429) return 'retry';
  // Already deleted, so the delete is done.
  if (entry.kind === 'delete' && status === 404) return 'gone';
  return 'refused';
}

async function send(entry: OutboxEntry): Promise<Transaction | null> {
  if (entry.kind === 'create') return (await TransactionApi.create(entry.payload)).data;
  if (entry.kind === 'update') await TransactionApi.update(entry.payload);
  else await TransactionApi.delete(entry.transactionId);
  return null;
}

let running: Promise<boolean> | null = null;

/**
 * Sends unsent changes, oldest first, one at a time. Resolves true when
 * anything was saved, so the caller can refresh.
 */
export function flushOutbox(): Promise<boolean> {
  running ??= (async () => {
    let saved = false;
    try {
      const pending = useOutbox.getState().entries.filter((entry) => entry.status === 'pending');
      for (const entry of pending) {
        // It may have been edited or discarded meanwhile.
        const current = useOutbox.getState().entries.find((item) => item.opId === entry.opId);
        if (!current || current.status !== 'pending') continue;
        try {
          const created = await send(current);
          saved = true;
          const latest = useOutbox.getState().entries.find((item) => item.opId === current.opId);
          if (latest === current) {
            useOutbox.getState().remove(current.opId);
          } else if (latest?.kind === 'create' && created) {
            // Edited while it was being sent: the new values go as an edit.
            const { fee: _fee, ...fields } = latest.payload;
            useOutbox.getState().replace(latest.opId, { ...latest, kind: 'update', payload: fields, original: created });
          }
        } catch (error) {
          const result = classifySyncError(current, error);
          if (result === 'retry') break;
          if (result === 'gone') {
            saved = true;
            useOutbox.getState().remove(current.opId);
          } else {
            useOutbox.getState().markFailed(current.opId, getErrorMessage(error) || "The server didn't accept this change");
          }
        }
      }
    } finally {
      running = null;
    }
    return saved;
  })();
  return running;
}
