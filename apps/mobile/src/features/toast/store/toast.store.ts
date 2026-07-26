import { create } from 'zustand';
import type { ToastData, ToastType } from '@/components/ui/Toast/Toast.types';

interface ToastState {
  toasts: ToastData[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let idCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = String(++idCounter);
    const toast: ToastData = { id, message, type };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));