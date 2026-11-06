import axios from 'axios';

import { env } from '@/config/env';

import { storage, StorageKeys } from './storage';

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
