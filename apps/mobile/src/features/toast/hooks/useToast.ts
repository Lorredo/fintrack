import { useMemo } from 'react';
import { useToastStore } from '../store/toast.store';
import type { ToastType } from '@/components/ui/Toast/Toast.types';

// Returns a stable object and doesn't subscribe to the toast list, so showing
// a toast never re-renders the caller (and never re-fires effects that
// depend on it).
export function useToast() {
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  return useMemo(() => {
    const toast = (message: string, type: ToastType = 'info') => addToast(message, type);
    return {
      toast,
      success: (message: string) => toast(message, 'success'),
      error: (message: string) => toast(message, 'error'),
      warning: (message: string) => toast(message, 'warning'),
      info: (message: string) => toast(message, 'info'),
      dismiss: removeToast,
    };
  }, [addToast, removeToast]);
}
