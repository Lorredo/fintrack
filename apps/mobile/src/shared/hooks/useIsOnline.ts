import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

// Follows the same online state TanStack Query uses to pause and resume
// requests (fed by expo-network in src/lib/queryClient.ts).
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
