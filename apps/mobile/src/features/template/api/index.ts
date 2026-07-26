/**
 * Template feature API.
 * Replace with actual API calls when scaffolding a new feature.
 */

import type { TemplateItem, CreateTemplateInput, UpdateTemplateInput } from '../types';

export const TemplateApi = {
  async getAll(): Promise<TemplateItem[]> {
    const response = await fetch('/api/templates');
    return response.json();
  },

  async getById(id: string): Promise<TemplateItem> {
    const response = await fetch(`/api/templates/${id}`);
    return response.json();
  },

  async create(input: CreateTemplateInput): Promise<TemplateItem> {
    const response = await fetch('/api/templates', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.json();
  },

  async update(input: UpdateTemplateInput): Promise<TemplateItem> {
    const response = await fetch(`/api/templates/${input.id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return response.json();
  },

  async delete(id: string): Promise<void> {
    await fetch(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  },
};