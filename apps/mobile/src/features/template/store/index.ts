/**
 * Template feature store (Zustand).
 * Replace with actual store when scaffolding a new feature.
 */

import { create } from 'zustand';

interface TemplateState {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}));