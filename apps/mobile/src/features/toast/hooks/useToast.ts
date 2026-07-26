import { useCallback } from 'react';
import { useToastStore } from '../store/toast.store';
import type { ToastType } from '@/components/ui/Toast/Toast.types';

export function useToast() {
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);
  const toasts = useToastStore((state) => state.toasts);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      addToast(message, type);
    },
    [addToast],
  );

  const success = useCallback(
    (message: string) => toast(message, 'success'),
    [toast],
  );

  const error = useCallback(
    (message: string) => toast(message, 'error'),
    [toast],
  );

  const warning = useCallback(
    (message: string) => toast(message, 'warning'),
    [toast],
  );

  const info = useCallback(
    (message: string) => toast(message, 'info'),
    [toast],
  );

  return {
    toasts,
    toast,
    success,
    error,
    warning,
    info,
    dismiss: removeToast,
  };
}