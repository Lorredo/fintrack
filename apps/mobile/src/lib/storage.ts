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
   USER: "user",
} as const;