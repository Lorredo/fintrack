import axios from 'axios';

import { env } from '@/config/env';

import { storage, StorageKeys } from './storage';

export const api = axios.create({
  baseURL: env.API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =============================
// REQUEST INTERCEPTOR
// =============================

api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    
    const token = storage.get(StorageKeys.ACCESS_TOKEN);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.log('[API Request Error]', error);
    return Promise.reject(error);
  },
);

// =============================
// RESPONSE INTERCEPTOR
// =============================

api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} =>`, response.data);
    return response;
  },
  (error) => {
    console.log('[API Response Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);