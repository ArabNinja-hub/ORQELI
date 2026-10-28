import { z } from 'zod';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAdmissionNumber(value: string): string {
  return value.trim().toUpperCase();
}

export const resourceIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{1,128}$/, 'Invalid identifier format.');

export const schoolLookupParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]{1,128}$/, 'Invalid school lookup identifier.');

export const publicSchoolSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120, 'Search query must be 120 characters or fewer.')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  province: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  sector: z
    .enum(['GOVERNMENT', 'PRIVATE', 'COMMUNITY'])
    .optional(),
  portalOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true')
});

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

export const studentRegistrationSchema = z
  .object({
    schoolId: resourceIdSchema,
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters.')
      .max(120, 'Full name must be 120 characters or fewer.'),
    admissionNumber: z
      .string()
      .trim()
      .min(2, 'Learner admission number is required.')
      .max(64, 'Learner admission number must be 64 characters or fewer.')
      .regex(
        /^[A-Za-z0-9/_-]+$/,
        'Admission number may only contain letters, digits, hyphens, underscores, or slashes.'
      )
      .transform(normalizeAdmissionNumber),
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address for your student login.')
      .max(254, 'Email address must be 254 characters or fewer.')
      .transform(normalizeEmail),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long.')
      .max(128, 'Password must be 128 characters or fewer.')
      .refine(
        (val) => /[A-Za-z]/.test(val) && /[^A-Za-z\s]/.test(val),
        'Password must contain at least one letter and one number or symbol.'
      ),
    verificationMode: z.enum(['ENROLMENT_CODE', 'STAFF_APPROVAL']),
    enrolmentCode: z
      .string()
      .trim()
      .max(64)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    classHint: z
      .string()
      .trim()
      .max(64, 'Class note must be 64 characters or fewer.')
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null))
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.verificationMode === 'ENROLMENT_CODE' && !input.enrolmentCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enrolmentCode'],
        message: 'Enter the single-use enrolment code issued by your school.'
      });
    }
    if (input.verificationMode === 'STAFF_APPROVAL' && input.enrolmentCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enrolmentCode'],
        message: 'Omit enrolment code when submitting a staff approval request.'
      });
    }
  });

export const createLearnerSchema = z
  .object({
    admissionNumber: z
      .string()
      .trim()
      .min(2, 'Admission number must be at least 2 characters.')
      .max(64, 'Admission number must be 64 characters or fewer.')
      .regex(
        /^[A-Za-z0-9/_-]+$/,
        'Admission number may only contain letters, digits, hyphens, underscores, or slashes.'
      )
      .transform(normalizeAdmissionNumber),
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required.')
      .max(80, 'First name must be 80 characters or fewer.'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required.')
      .max(80, 'Last name must be 80 characters or fewer.'),
    schoolClassId: resourceIdSchema,
    preferredChannel: z
      .enum(['PRINT_REPORT', 'SMS_SUMMARY', 'GUARDIAN_PORTAL'])
      .default('PRINT_REPORT')
  })
  .strict();

export const issueEnrolmentCodeSchema = z
  .object({
    expiresInDays: z.coerce.number().int().min(1).max(90).default(14)
  })
  .strict();

export const approveStudentRegistrationSchema = z
  .object({
    learnerId: resourceIdSchema,
    decisionNotes: z
      .string()
      .trim()
      .max(300, 'Decision notes must be 300 characters or fewer.')
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null))
  })
  .strict();

export const rejectStudentRegistrationSchema = z
  .object({
    decisionNotes: z
      .string()
      .trim()
      .min(5, 'Provide a clear reason of at least 5 characters when declining a request.')
      .max(300, 'Decision notes must be 300 characters or fewer.')
  })
  .strict();

export const createAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Announcement title must be at least 3 characters.')
      .max(140, 'Announcement title must be 140 characters or fewer.'),
    body: z
      .string()
      .trim()
      .min(5, 'Announcement message must be at least 5 characters.')
      .max(1200, 'Announcement message must be 1200 characters or fewer.'),
    audience: z
      .enum(['STUDENTS_AND_STAFF', 'STAFF_ONLY'])
      .default('STUDENTS_AND_STAFF')
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
