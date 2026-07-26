import { useRouter } from 'expo-router';

/**
 * Navigation route paths used throughout the app.
 * Centralized to avoid hardcoded strings.
 */
export const Routes = {
  // Auth
  LOGIN: '/login' as const,
  REGISTER: '/register' as const,

  // App (authenticated)
  HOME: '/' as const,
  DASHBOARD: '/' as const,
  TRANSACTIONS: '/transactions' as const,
  BUDGETS: '/budgets' as const,
  REPORTS: '/reports' as const,
  SETTINGS: '/settings' as const,
} as const;

export type RoutePath = (typeof Routes)[keyof typeof Routes];

/**
 * Hook that provides typed navigation helpers.
 */
export function useAppNavigation() {
  const router = useRouter();

  return {
    navigate: (path: RoutePath) => router.push(path),
    replace: (path: RoutePath) => router.replace(path),
    back: () => router.back(),
    canGoBack: () => true, // expo-router handles this internally

    // Convenience methods
    goToLogin: () => router.replace(Routes.LOGIN),
    goToRegister: () => router.push(Routes.REGISTER),
    goToHome: () => router.replace(Routes.HOME),
    goToSettings: () => router.push(Routes.SETTINGS),
  };
}