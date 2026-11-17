import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { useLockStore } from './lock.store';

jest.mock('@/lib/storage', () => ({
  storage: { get: () => '0s' },
  StorageKeys: { AUTO_LOCK_TIMEOUT: 'auto_lock' },
}));


afterEach(() => {
  jest.useRealTimers();
  useLockStore.setState({ isLocked: false, backgroundedAt: null, expectedAwayUntil: null });
});

describe('auto-lock', () => {
  it('locks on return when the app really left', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    useLockStore.getState().recordBackground();
    jest.setSystemTime(1_005_000);
    expect(useLockStore.getState().checkLockTimeout()).toBe(true);
    expect(useLockStore.getState().isLocked).toBe(true);
  });

  it("doesn't lock after a picker FinTrack opened itself", () => {
    jest.useFakeTimers({ now: 1_000_000 });
    useLockStore.getState().expectAway();
    useLockStore.getState().recordBackground();
    jest.setSystemTime(1_020_000);
    expect(useLockStore.getState().checkLockTimeout()).toBe(false);
    expect(useLockStore.getState().isLocked).toBe(false);
    // The exception is used up: the next real trip away locks.
    useLockStore.getState().recordBackground();
    jest.setSystemTime(1_025_000);
    expect(useLockStore.getState().checkLockTimeout()).toBe(true);
  });

  it('still locks when the user stays away from the picker too long', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    useLockStore.getState().expectAway();
    useLockStore.getState().recordBackground();
    jest.setSystemTime(1_000_000 + 3 * 60 * 1000);
    expect(useLockStore.getState().checkLockTimeout()).toBe(true);
  });
});
