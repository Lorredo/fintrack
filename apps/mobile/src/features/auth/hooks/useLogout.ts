import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AuthService } from '../services/auth.service';

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => AuthService.logout(),
    onSettled: () => {
      // Clear all cached queries so no stale data persists after logout
      queryClient.clear();
    },
  });
}
