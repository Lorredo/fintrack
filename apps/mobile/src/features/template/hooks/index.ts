/**
 * Template feature hooks.
 * Replace with actual hooks when scaffolding a new feature.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TemplateApi } from '../api';
import type { CreateTemplateInput, UpdateTemplateInput } from '../types';

export const TEMPLATE_KEYS = {
  all: ['templates'] as const,
  list: () => [...TEMPLATE_KEYS.all, 'list'] as const,
  detail: (id: string) => [...TEMPLATE_KEYS.all, 'detail', id] as const,
};

export function useTemplateList() {
  return useQuery({
    queryKey: TEMPLATE_KEYS.list(),
    queryFn: TemplateApi.getAll,
  });
}

export function useTemplateDetail(id: string) {
  return useQuery({
    queryKey: TEMPLATE_KEYS.detail(id),
    queryFn: () => TemplateApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTemplateInput) => TemplateApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.list() });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTemplateInput) => TemplateApi.update(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.detail(variables.id) });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => TemplateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_KEYS.list() });
    },
  });
}