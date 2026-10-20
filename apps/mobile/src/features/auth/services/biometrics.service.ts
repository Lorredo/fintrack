import * as LocalAuthentication from 'expo-local-authentication';
import { storage, StorageKeys } from '@/lib/storage';

export type BiometricAuthType = 'face' | 'fingerprint' | 'iris' | 'none';

export class BiometricsService {
  /**
   * Checks if biometric hardware is present and user has enrolled biometrics.
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return false;

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return isEnrolled;
    } catch {
      return false;
    }
  }

  /**
   * Returns human-readable biometric type supported by device (e.g., Face ID vs Fingerprint).
   */
  static async getBiometricType(): Promise<BiometricAuthType> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'face';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'fingerprint';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'iris';
      }
      return 'none';
    } catch {
      return 'none';
    }
  }

  /**
   * Prompts the native biometric authentication dialog.
   */
  static async authenticate(promptMessage: string = 'Unlock FinTrack'): Promise<boolean> {
    try {
      const isAvail = await this.isAvailable();
      if (!isAvail) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Enter PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true, // Use our app's PIN instead of OS system passcode fallback
      });

      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether the user has enabled biometrics in FinTrack settings.
   */
  static isEnabledInSettings(): boolean {
    return storage.get(StorageKeys.BIOMETRICS_ENABLED) === 'true';
  }

  /**
   * Toggles biometrics enablement in FinTrack settings.
   */
  static setEnabledInSettings(enabled: boolean): void {
    storage.set(StorageKeys.BIOMETRICS_ENABLED, enabled ? 'true' : 'false');
  }
}
