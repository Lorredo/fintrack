import { AppState, Platform } from 'react-native';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import * as Network from 'expo-network';

import { storage, StorageKeys } from './storage';

const DAY = 1000 * 60 * 60 * 24;

// Saved data is kept for a week, so the app opens with it while offline or
// while the server wakes up. gcTime must be at least this long, or queries are
// dropped from memory before they are saved.
export const CACHE_MAX_AGE = 7 * DAY;

// Bump when the shape of cached data changes, to discard old saved caches.
export const CACHE_BUSTER = 'v1';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      gcTime: CACHE_MAX_AGE,
    },
    mutations: {
      // Saving while offline should fail straight away with a clear message,
      // not sit paused with a spinner until the connection returns.
      networkMode: 'always',
    },
  },
});

// The cache is stored in the app's encrypted storage, next to the session.
export const queryPersister = createAsyncStoragePersister({
  key: StorageKeys.QUERY_CACHE,
  storage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => {
      storage.remove(key);
    },
  },
});

// Removes one user's cached data, in memory and on disk, so the next person to
// sign in on this phone never sees it.
export function clearUserCache() {
  queryClient.clear();
  storage.remove(StorageKeys.QUERY_CACHE);
}

function isOnline(state: Network.NetworkState) {
  // isInternetReachable can be missing while Android is still checking, so
  // only treat a definite "no" as offline.
  return state.isConnected !== false && state.isInternetReachable !== false;
}

let listenersStarted = false;

// Lets queries pause while offline and refetch when the connection or the app
// comes back, which React Native doesn't report to TanStack on its own.
export function startQueryListeners() {
  if (listenersStarted || Platform.OS === 'web') return;
  listenersStarted = true;

  onlineManager.setEventListener((setOnline) => {
    Network.getNetworkStateAsync()
      .then((state) => setOnline(isOnline(state)))
      .catch(() => {});
    const subscription = Network.addNetworkStateListener((state) => setOnline(isOnline(state)));
    return () => subscription.remove();
  });

  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}
