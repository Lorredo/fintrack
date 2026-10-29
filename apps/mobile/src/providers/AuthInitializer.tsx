import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthHydration } from '@/features/auth/hooks/useAuthHydration';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useLockStore } from '@/features/auth/store/lock.store';
import { PinService } from '@/features/auth/services/pin.service';

export default function AuthInitializer() {
  useAuthHydration();

  const appState = useRef(AppState.currentState);
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        const isAuthenticated = !!useAuthStore.getState().accessToken;
        if (isAuthenticated && PinService.hasPin() && useLockStore.getState().checkLockTimeout()) {
          // AuthGuard only covers the (app) tab group, so screens outside it
          // (security, forms) need an explicit redirect to the lock screen.
          const [group] = segmentsRef.current;
          if (group !== '(app)' && group !== 'pin-lock') {
            if (router.canDismiss()) router.dismissAll();
            router.replace('/pin-lock');
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        useLockStore.getState().recordBackground();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return null;
}