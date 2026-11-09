import { Platform } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import { createMMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

// Must stay MMKV's default id, which is where existing data already lives.
const STORAGE_ID = 'mmkv.default';
const ENCRYPTION_KEY_NAME = 'fintrack_storage_key';
const ENCRYPTION_TYPE = 'AES-256';
const KEYCHAIN_OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

function createEncryptionKey(): string {
  return Array.from(getRandomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Tokens and the PIN hash live here, so the data is encrypted with a key held
// by the OS keystore. Without a readable key (first launch after this update,
// or a restored backup, whose keys don't survive) it opens plain: older data
// is then encrypted in place, and data that can't be read is discarded, which
// just means signing in again.
function createStorage() {
  if (Platform.OS === 'web') return createMMKV();

  let encryptionKey: string | null = null;
  try {
    encryptionKey = SecureStore.getItem(ENCRYPTION_KEY_NAME, KEYCHAIN_OPTIONS);
  } catch {
    encryptionKey = null;
  }
  if (encryptionKey) {
    return createMMKV({ id: STORAGE_ID, encryptionKey, encryptionType: ENCRYPTION_TYPE });
  }

  const instance = createMMKV();
  const newKey = createEncryptionKey();
  SecureStore.setItem(ENCRYPTION_KEY_NAME, newKey, KEYCHAIN_OPTIONS);
  instance.encrypt(newKey, ENCRYPTION_TYPE);
  return instance;
}

const mmkv = createStorage();

export const storage = {
  get: (key: string) => mmkv.getString(key),

  set: (key: string, value: string) => mmkv.set(key, value),

  remove: (key: string) => mmkv.remove(key),

  clear: () => mmkv.clearAll(),
};

export const StorageKeys = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  PIN_HASH: 'pin_hash',
  PIN_SALT: 'pin_salt',
  PIN_FAILED_ATTEMPTS: 'pin_failed_attempts',
  PIN_LOCKED_UNTIL: 'pin_locked_until',
  BIOMETRICS_ENABLED: 'biometrics_enabled',
  HAS_PIN: 'has_pin',
  REMEMBERED_EMAIL: 'remembered_email',
  PIN_SETUP_DISMISSED: 'pin_setup_dismissed',
  RECENT_GOOGLE_ACCOUNTS: 'recent_google_accounts',
  AUTO_LOCK_TIMEOUT: 'FINTRACK_AUTOLOCK_TIMEOUT',
  QUERY_CACHE: 'query_cache',
} as const;