import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useLockStore } from '@/features/auth/store/lock.store';
import { PinService } from '@/features/auth/services/pin.service';
import { storage, StorageKeys } from '@/lib/storage';

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isLocked = useLockStore((state) => state.isLocked);

  if (!hydrated) {
    return null;
  }

  if (!accessToken) {
    return <Redirect href="/login" />;
  }

  // If PIN exists and the app is locked, redirect to PIN lock screen
  if (PinService.hasPin() && isLocked) {
    return <Redirect href="/pin-lock" />;
  }

  // If user is authenticated, has no PIN set, and hasn't dismissed setup, prompt setup
  if (!PinService.hasPin() && storage.get(StorageKeys.PIN_SETUP_DISMISSED) !== 'true') {
    return <Redirect href="/pin-setup" />;
  }

  return <>{children}</>;
}