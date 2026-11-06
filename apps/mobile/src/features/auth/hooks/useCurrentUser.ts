import { useQuery } from '@tanstack/react-query';

import { AuthApi } from '../api/auth.api';
import type { User } from '../types/user.types';

export const CURRENT_USER_KEY = ['auth', 'me'] as const;

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: CURRENT_USER_KEY,
    queryFn: () => AuthApi.me(),
  });
}
