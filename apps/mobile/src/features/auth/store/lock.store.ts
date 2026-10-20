import { create } from 'zustand';

interface LockState {
  isLocked: boolean;
  lastActiveTimestamp: number;
  lock: () => void;
  unlock: () => void;
  recordActive: () => void;
  checkLockTimeout: (gracePeriodMs?: number) => boolean;
}

// Default 30-second grace period before requiring PIN on app resume
const DEFAULT_GRACE_PERIOD_MS = 30 * 1000;

export const useLockStore = create<LockState>((set, get) => ({
  isLocked: false,
  lastActiveTimestamp: Date.now(),

  lock: () => set({ isLocked: true }),

  unlock: () => set({ isLocked: false, lastActiveTimestamp: Date.now() }),

  recordActive: () => set({ lastActiveTimestamp: Date.now() }),

  checkLockTimeout: (gracePeriodMs = DEFAULT_GRACE_PERIOD_MS) => {
    const elapsed = Date.now() - get().lastActiveTimestamp;
    if (elapsed > gracePeriodMs) {
      set({ isLocked: true });
      return true;
    }
    return false;
  },
}));
