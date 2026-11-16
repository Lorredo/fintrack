import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';

import { RELATED_QUERY_KEYS, TRANSACTION_KEYS } from '../hooks/useTransactions';
import { useOutbox } from './outbox';
import { flushOutbox } from './sync';

/**
 * Sends changes saved offline when the connection comes back, when the app
 * returns to the foreground, and as soon as one is added while online.
 * Mounted in the signed-in, unlocked part of the app.
 */
export function OutboxSync() {
  const queryClient = useQueryClient();
  const hasPending = useOutbox((state) => state.entries.some((entry) => entry.status === 'pending'));

  useEffect(() => {
    const sync = () => {
      if (!onlineManager.isOnline() || !useOutbox.getState().entries.some((entry) => entry.status === 'pending')) return;
      void flushOutbox().then((saved) => {
        if (!saved) return;
        queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.all });
        RELATED_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      });
    };

    if (hasPending) sync();
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) sync();
    });
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') sync();
    });
    // A server that was asleep or briefly unreachable: try again now and then.
    const timer = hasPending ? setInterval(sync, 60_000) : undefined;
    return () => {
      unsubscribeOnline();
      appState.remove();
      if (timer) clearInterval(timer);
    };
  }, [hasPending, queryClient]);

  return null;
}
