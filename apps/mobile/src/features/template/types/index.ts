/**
 * Template feature types.
 * Replace with actual feature types when scaffolding a new feature.
 */

export interface TemplateItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
}

export interface UpdateTemplateInput {
  id: string;
  name?: string;
}