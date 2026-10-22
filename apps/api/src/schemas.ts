import { z } from 'zod';
import { normalizeEmail, normalizePhone } from './repository.js';

const phoneRegex = /^[0-9+()\-\s]+$/;

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(25, 'Phone number must be 25 characters or fewer.')
  .refine((val) => val.length === 0 || (val.length >= 7 && phoneRegex.test(val)), {
    message: 'Phone number must be 7 to 25 characters and contain only digits or standard phone symbols.'
  })
  .optional()
  .nullable()
  .transform((val) => normalizePhone(val ?? null));

const requiredPhoneSchema = z
  .string()
  .trim()
  .min(7, 'Phone number must be at least 7 characters.')
  .max(25, 'Phone number must be 25 characters or fewer.')
  .regex(phoneRegex, 'Phone number contains invalid characters.')
  .transform((val) => val.replace(/\s+/g, ' '));

const optionalEmailSchema = z
  .string()
  .trim()
  .max(254, 'Email address must be 254 characters or fewer.')
  .refine((val) => val.length === 0 || z.string().email().safeParse(val).success, {
    message: 'Please provide a valid email address.'
  })
  .optional()
  .nullable()
  .transform((val) => (val && val.trim().length > 0 ? normalizeEmail(val) : null));

export const businessOnboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Business name must be at least 2 characters.')
    .max(120, 'Business name must be 120 characters or fewer.'),
  description: z
    .string()
    .trim()
    .max(600, 'Description must be 600 characters or fewer.')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  city: z
    .string()
    .trim()
    .min(2, 'City must be at least 2 characters.')
    .max(80, 'City must be 80 characters or fewer.'),
  location: z
    .string()
    .trim()
    .min(2, 'Location must be at least 2 characters.')
    .max(160, 'Location must be 160 characters or fewer.'),
  phone: requiredPhoneSchema,
  email: optionalEmailSchema
});

export const registerSchema = z
  .object({
    role: z.enum(['CUSTOMER', 'BUSINESS_OWNER']).default('CUSTOMER'),
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters.')
      .max(120, 'Name must be 120 characters or fewer.'),
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address.')
      .max(254, 'Email address must be 254 characters or fewer.')
      .transform(normalizeEmail),
    phone: optionalPhoneSchema,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password must be 128 characters or fewer.')
      .refine((val) => val.trim().length >= 8, {
        message: 'Password cannot consist only of whitespace.'
      }),
    business: businessOnboardingSchema.optional(),
    businessName: z.string().trim().optional(),
    businessDescription: z.string().trim().optional(),
    city: z.string().trim().optional(),
    location: z.string().trim().optional(),
    businessPhone: z.string().trim().optional(),
    businessEmail: z.string().trim().optional()
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'BUSINESS_OWNER') {
      return;
    }

    if (data.business) {
      return;
    }

    const fallbackCandidate = {
      name: data.businessName ?? '',
      description: data.businessDescription ?? null,
      city: data.city ?? '',
      location: data.location ?? '',
      phone: data.businessPhone ?? data.phone ?? '',
      email: data.businessEmail ?? null
    };

    const parsedFallback = businessOnboardingSchema.safeParse(fallbackCandidate);
    if (!parsedFallback.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['business'],
        message:
          'Business owners must provide valid business onboarding details (name, city, location, phone).'
      });
    }
  })
  .transform((data) => {
    if (data.role === 'BUSINESS_OWNER') {
      const resolvedBusiness =
        data.business ??
        businessOnboardingSchema.parse({
          name: data.businessName ?? '',
          description: data.businessDescription ?? null,
          city: data.city ?? '',
          location: data.location ?? '',
          phone: data.businessPhone ?? data.phone ?? '',
          email: data.businessEmail ?? null
        });
      return {
        role: 'BUSINESS_OWNER' as const,
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        business: resolvedBusiness
      };
    }

    return {
      role: 'CUSTOMER' as const,
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
      business: undefined
    };
  });

export const loginSchema = z.object({
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
});

export const ownerBusinessUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Business name must be at least 2 characters.')
      .max(120, 'Business name must be 120 characters or fewer.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(600, 'Description must be 600 characters or fewer.')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
    city: z
      .string()
      .trim()
      .min(2, 'City must be at least 2 characters.')
      .max(80, 'City must be 80 characters or fewer.')
      .optional(),
    location: z
      .string()
      .trim()
      .min(2, 'Location must be at least 2 characters.')
      .max(160, 'Location must be 160 characters or fewer.')
      .optional(),
    phone: requiredPhoneSchema.optional(),
    email: optionalEmailSchema
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.city !== undefined ||
      data.location !== undefined ||
      data.phone !== undefined ||
      data.email !== undefined,
    { message: 'At least one business field must be provided for update.' }
  );

export const adminBusinessStatusFilterSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional()
});

export const adminUpdateBusinessStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'])
});

export const adminUpdateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED'])
});
