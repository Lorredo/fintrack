import { ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { CACHE_BUSTER, CACHE_MAX_AGE, queryClient, queryPersister, startQueryListeners } from '@/lib/queryClient';

startQueryListeners();

interface Props {
  children: ReactNode;
}

export function QueryProvider({ children }: Props) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE, buster: CACHE_BUSTER }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
