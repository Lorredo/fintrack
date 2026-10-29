import { create } from 'zustand';
import type { ToastData, ToastType } from '@/components/ui/Toast/Toast.types';

const TOAST_DURATION_MS = 3000;
const MAX_VISIBLE_TOASTS = 3;

interface ToastState {
  toasts: ToastData[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let idCounter = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => {
  const scheduleRemoval = (id: string) => {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => get().removeToast(id), TOAST_DURATION_MS));
  };

  return {
    toasts: [],

    addToast: (message, type) => {
      // Showing the same message again just keeps the existing toast up.
      const existing = get().toasts.find((t) => t.message === message && t.type === type);
      if (existing) {
        scheduleRemoval(existing.id);
        return;
      }

      const id = String(++idCounter);
      const toasts = [...get().toasts, { id, message, type }];
      const dropped = toasts.slice(0, Math.max(0, toasts.length - MAX_VISIBLE_TOASTS));
      dropped.forEach((t) => {
        clearTimeout(timers.get(t.id));
        timers.delete(t.id);
      });
      set({ toasts: toasts.slice(dropped.length) });
      scheduleRemoval(id);
    },

    removeToast: (id) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    },

    clearToasts: () => {
      timers.forEach(clearTimeout);
      timers.clear();
      set({ toasts: [] });
    },
  };
});
