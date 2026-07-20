import { useMutation } from '@tanstack/react-query';

import { AuthService } from '../services/auth.service';

import type { LoginRequest } from '../types/auth.types';

export function useLogin() {
  const mutation = useMutation({
    mutationFn: (payload: LoginRequest) =>
      AuthService.login(payload),
  });

  return {
    login: mutation.mutate,
    loginAsync: mutation.mutateAsync,

    loading: mutation.isPending,

    error: mutation.error,

    isSuccess: mutation.isSuccess,

    reset: mutation.reset,
  };
}