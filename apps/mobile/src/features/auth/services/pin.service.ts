import * as Crypto from 'expo-crypto';
import { storage, StorageKeys } from '@/lib/storage';
import { AuthApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

// Wrong PINs lock the keypad for 30 seconds after the fifth, doubling each
// time, and the tenth requires a full sign-in.
const LOCK_AFTER_ATTEMPTS = 5;
const SIGN_IN_AFTER_ATTEMPTS = 10;
const BASE_LOCK_MS = 30 * 1000;

export interface PinLockState {
  remainingMs: number;
  mustSignIn: boolean;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class PinService {
  private static digest(value: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
  }

  /**
   * Saves a salted hash of the PIN for offline unlock.
   */
  static async storeLocalHash(pin: string): Promise<void> {
    const salt = toHex(Crypto.getRandomBytes(16));
    storage.set(StorageKeys.PIN_SALT, salt);
    storage.set(StorageKeys.PIN_HASH, await this.digest(`${salt}:${pin}`));
    storage.set(StorageKeys.HAS_PIN, 'true');
  }

  static getLockState(): PinLockState {
    const attempts = Number(storage.get(StorageKeys.PIN_FAILED_ATTEMPTS) ?? 0);
    const lockedUntil = Number(storage.get(StorageKeys.PIN_LOCKED_UNTIL) ?? 0);
    return {
      remainingMs: Math.max(lockedUntil - Date.now(), 0),
      mustSignIn: attempts >= SIGN_IN_AFTER_ATTEMPTS,
    };
  }

  static resetFailures(): void {
    storage.remove(StorageKeys.PIN_FAILED_ATTEMPTS);
    storage.remove(StorageKeys.PIN_LOCKED_UNTIL);
  }

  private static recordFailure(): void {
    const attempts = Number(storage.get(StorageKeys.PIN_FAILED_ATTEMPTS) ?? 0) + 1;
    storage.set(StorageKeys.PIN_FAILED_ATTEMPTS, String(attempts));
    if (attempts >= LOCK_AFTER_ATTEMPTS) {
      const lockMs = BASE_LOCK_MS * 2 ** (attempts - LOCK_AFTER_ATTEMPTS);
      storage.set(StorageKeys.PIN_LOCKED_UNTIL, String(Date.now() + lockMs));
    }
  }

  /**
   * Returns whether a PIN is configured for the current session/device.
   */
  static hasPin(): boolean {
    const hasPinFlag = storage.get(StorageKeys.HAS_PIN) === 'true';
    const hasLocalHash = !!storage.get(StorageKeys.PIN_HASH);
    const userHasPin = !!useAuthStore.getState().user?.hasPin;
    return hasPinFlag || hasLocalHash || userHasPin;
  }

  /**
   * Saves the PIN locally and on the server.
   */
  static async setPin(pin: string): Promise<void> {
    await this.storeLocalHash(pin);

    // Update user in auth store and storage so hasPin is reflected immediately
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, hasPin: true };
      useAuthStore.setState({ user: updatedUser });
      storage.set(StorageKeys.USER, JSON.stringify(updatedUser));
    }

    // Sync with backend API
    try {
      await AuthApi.setPin({ pin });
    } catch {
      // If offline or network issue, local PIN is still active
    }
  }

  /**
   * Verifies PIN against the local hash first, with fallback to backend verification.
   * Hashes saved before salts were added are upgraded after a correct entry.
   */
  static async verifyPin(pin: string): Promise<boolean> {
    const storedHash = storage.get(StorageKeys.PIN_HASH);
    if (storedHash) {
      const salt = storage.get(StorageKeys.PIN_SALT);
      const inputHash = await this.digest(salt ? `${salt}:${pin}` : pin);
      if (inputHash !== storedHash) {
        this.recordFailure();
        return false;
      }
      this.resetFailures();
      if (!salt) await this.storeLocalHash(pin);
      return true;
    }

    // If local hash is somehow missing but server has it, verify with server
    try {
      await AuthApi.verifyPin({ pin });
      await this.storeLocalHash(pin);
      this.resetFailures();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clears PIN data upon logout or reset.
   */
  static clearPin(): void {
    storage.remove(StorageKeys.PIN_HASH);
    storage.remove(StorageKeys.PIN_SALT);
    storage.remove(StorageKeys.HAS_PIN);
    this.resetFailures();
    storage.remove(StorageKeys.BIOMETRICS_ENABLED);
  }
}
