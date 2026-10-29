import { create } from 'zustand';
import { storage, StorageKeys } from '@/lib/storage';

interface LockState {
  isLocked: boolean;
  backgroundedAt: number | null;
  lock: () => void;
  unlock: () => void;
  recordBackground: () => void;
  checkLockTimeout: () => boolean;
}

// Auto-lock options chosen on the Security screen
const AUTO_LOCK_TIMEOUTS_MS: Record<string, number> = {
  '0s': 0,
  '30s': 30 * 1000,
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
};

// Default 30-second grace period before requiring PIN on app resume
const DEFAULT_GRACE_PERIOD_MS = AUTO_LOCK_TIMEOUTS_MS['30s'];

export function getAutoLockTimeoutMs(): number {
  const value = storage.get(StorageKeys.AUTO_LOCK_TIMEOUT);
  return (value ? AUTO_LOCK_TIMEOUTS_MS[value] : undefined) ?? DEFAULT_GRACE_PERIOD_MS;
}

export const useLockStore = create<LockState>((set, get) => ({
  isLocked: false,
  backgroundedAt: null,

  lock: () => set({ isLocked: true }),

  // Clearing backgroundedAt means a resume right after unlocking (e.g. once a
  // biometric prompt closes) doesn't lock the app again.
  unlock: () => set({ isLocked: false, backgroundedAt: null }),

  // Keep the earliest time so 'inactive' followed by 'background' counts from the first.
  recordBackground: () =>
    set((state) => ({ backgroundedAt: state.backgroundedAt ?? Date.now() })),

  checkLockTimeout: () => {
    const { backgroundedAt } = get();
    if (backgroundedAt === null) return false;

    const elapsed = Date.now() - backgroundedAt;
    set({ backgroundedAt: null });
    if (elapsed >= getAutoLockTimeoutMs()) {
      set({ isLocked: true });
      return true;
    }
    return false;
  },
}));
