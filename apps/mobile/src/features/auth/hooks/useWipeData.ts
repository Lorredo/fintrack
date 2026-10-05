import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useWipeData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await api.delete('/api/v1/auth/wipe-data');
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all queries to refetch empty state
      queryClient.invalidateQueries();
    },
  });
}
