import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthHydration } from '@/features/auth/hooks/useAuthHydration';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useLockStore } from '@/features/auth/store/lock.store';
import { PinService } from '@/features/auth/services/pin.service';

export default function AuthInitializer() {
  useAuthHydration();

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        const isAuthenticated = !!useAuthStore.getState().accessToken;
        if (isAuthenticated && PinService.hasPin()) {
          useLockStore.getState().checkLockTimeout();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        useLockStore.getState().recordActive();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}