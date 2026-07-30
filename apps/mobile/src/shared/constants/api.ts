export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    ME: '/api/v1/auth/me',
  },
  TRANSACTIONS: {
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
