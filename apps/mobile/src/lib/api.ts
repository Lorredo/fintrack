import axios from 'axios';

import { env } from '@/config/env';

import { storage, StorageKeys } from './storage';
import { isOffline, OFFLINE_MESSAGE } from '@/shared/utils/apiErrors';

export const api = axios.create({
  baseURL: env.API_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =============================
// REQUEST INTERCEPTOR
// =============================

api.interceptors.request.use(
  (config) => {
    const method = (config.method ?? 'get').toLowerCase();
    if (method !== 'get' && isOffline()) {
      return Promise.reject(new Error(OFFLINE_MESSAGE));
    }

    if (__DEV__) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }

    const token = storage.get(StorageKeys.ACCESS_TOKEN);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);
