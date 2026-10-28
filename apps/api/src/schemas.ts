import { z } from 'zod';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const resourceIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{1,128}$/, 'Invalid identifier format.');

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address.')
      .max(254, 'Email address must be 254 characters or fewer.')
      .transform(normalizeEmail),
    password: z
      .string()
      .min(1, 'Password is required.')
      .max(128, 'Password must be 128 characters or fewer.')
  })
  .strict();

export const markEntryItemSchema = z
  .object({
    learnerId: resourceIdSchema,
    subjectId: resourceIdSchema,
    status: z.enum(['PENDING', 'PRESENT', 'ABSENT', 'EXEMPT']),
    score: z
      .number()
      .int('Score must be a whole number.')
      .min(0, 'Score cannot be negative.')
      .max(1000, 'Score exceeds permitted maximum.')
      .nullable(),
    teacherComment: z
      .string()
      .trim()
      .max(240, 'Teacher comment must be 240 characters or fewer.')
      .optional()
      .nullable()
      .transform((value) => (value && value.length > 0 ? value : null))
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.status === 'PRESENT' && entry.score === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: 'A numeric score is required when mark status is PRESENT.'
      });
    }
    if (entry.status !== 'PRESENT' && entry.score !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score'],
        message: 'Score must be null when mark status is PENDING, ABSENT, or EXEMPT.'
      });
    }
  });

export const recordMarksSchema = z
  .object({
    entries: z
      .array(markEntryItemSchema)
      .min(1, 'At least one mark entry must be provided.')
      .max(100, 'Cannot submit more than 100 mark entries in a single request.')
  })
  .strict();

export const requestRevisionSchema = z
  .object({
    reviewNotes: z
      .string()
      .trim()
      .min(5, 'Please provide clear revision notes of at least 5 characters.')
      .max(500, 'Revision notes must be 500 characters or fewer.')
  })
  .strict();
