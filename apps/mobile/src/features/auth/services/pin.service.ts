import * as Crypto from 'expo-crypto';
import { storage, StorageKeys } from '@/lib/storage';
import { AuthApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export class PinService {
  /**
   * Hashes the 4-digit PIN using SHA-256 for secure local storage and offline unlock.
   */
  static async hashPin(pin: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
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
    const hash = await this.hashPin(pin);
    storage.set(StorageKeys.PIN_HASH, hash);
    storage.set(StorageKeys.HAS_PIN, 'true');

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
   * Verifies PIN against local SHA-256 hash first, with fallback to backend verification.
   */
  static async verifyPin(pin: string): Promise<boolean> {
    const storedHash = storage.get(StorageKeys.PIN_HASH);
    if (storedHash) {
      const inputHash = await this.hashPin(pin);
      if (inputHash === storedHash) {
        return true;
      }
      return false;
    }

    // If local hash is somehow missing but server has it, verify with server
    try {
      await AuthApi.verifyPin({ pin });
      const hash = await this.hashPin(pin);
      storage.set(StorageKeys.PIN_HASH, hash);
      storage.set(StorageKeys.HAS_PIN, 'true');
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
    storage.remove(StorageKeys.HAS_PIN);
    storage.remove(StorageKeys.BIOMETRICS_ENABLED);
  }
}
