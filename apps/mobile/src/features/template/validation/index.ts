/**
 * Template feature validation schemas.
 * Replace with actual validation when scaffolding a new feature.
 */

export const TEMPLATE_VALIDATION = {
  name: {
    required: 'Name is required',
    minLength: { value: 2, message: 'Name must be at least 2 characters' },
    maxLength: { value: 100, message: 'Name must be at most 100 characters' },
  },
} as const;