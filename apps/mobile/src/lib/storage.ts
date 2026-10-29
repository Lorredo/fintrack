import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV();

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
  BIOMETRICS_ENABLED: 'biometrics_enabled',
  HAS_PIN: 'has_pin',
  REMEMBERED_EMAIL: 'remembered_email',
  PIN_SETUP_DISMISSED: 'pin_setup_dismissed',
  RECENT_GOOGLE_ACCOUNTS: 'recent_google_accounts',
  AUTO_LOCK_TIMEOUT: 'FINTRACK_AUTOLOCK_TIMEOUT',
} as const;