export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    ME: '/api/v1/auth/me',
    GOOGLE: '/api/v1/auth/google',
    APPLE: '/api/v1/auth/apple',
    PIN: '/api/v1/auth/pin',
    VERIFY_PIN: '/api/v1/auth/pin/verify',
    PIN_LOGIN: '/api/v1/auth/pin-login',
  },
  TRANSACTIONS: {
    CATEGORIES: '/api/v1/transactions/categories/all',
    LIST: '/api/v1/transactions',
    DETAIL: (id: string) => `/api/v1/transactions/${id}`,
    CREATE: '/api/v1/transactions',
    UPDATE: (id: string) => `/api/v1/transactions/${id}`,
    DELETE: (id: string) => `/api/v1/transactions/${id}`,
  },
  DASHBOARD: {
    SUMMARY: '/api/v1/dashboard/summary',
  },
  BUDGETS: {
    LIST: '/api/v1/budgets',
    DETAIL: (id: string) => `/api/v1/budgets/${id}`,
    CREATE: '/api/v1/budgets',
    UPDATE: (id: string) => `/api/v1/budgets/${id}`,
    DELETE: (id: string) => `/api/v1/budgets/${id}`,
  },
  REPORTS: {
    TRENDS: '/api/v1/reports/trends',
    CATEGORIES: '/api/v1/reports/categories',
    EXPORT: '/api/v1/reports/export',
  },
} as const;
