/**
 * Template feature service.
 * Replace with actual business logic when scaffolding a new feature.
 * Services encapsulate complex business logic not suitable for hooks or API layers.
 */

import type { TemplateItem } from '../types';

export function formatTemplateName(item: TemplateItem): string {
  return item.name.trim();
}

export function filterTemplates(items: TemplateItem[], query: string): TemplateItem[] {
  if (!query.trim()) return items;
  const lowerQuery = query.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(lowerQuery));
}