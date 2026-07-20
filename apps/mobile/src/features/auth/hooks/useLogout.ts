import { useMutation } from '@tanstack/react-query';

import { AuthService } from '../services/auth.service';

export function useLogout() {
  return useMutation({
    mutationFn: () => AuthService.logout(),
  });
}