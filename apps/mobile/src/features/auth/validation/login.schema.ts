import { VALIDATION } from '@/shared/constants/validation';
import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase(),

  password: z
  .string()
  .min(
    VALIDATION.PASSWORD_MIN_LENGTH,
    `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`,
  )
});
export type LoginFormData = z.infer<typeof loginSchema>;