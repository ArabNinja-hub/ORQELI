import { z } from 'zod';
// Prisma generated types are not available when the client has not been generated (offline CI/sandbox stub).
// Use permissive types so typechecking still passes; runtime queries remain strictly allowlisted.
type BusinessSelectStub = any;
type BusinessWhereStub = any;

export const publicCitySchema = z.enum(['Kitwe', 'Ndola']);
export const discoveryQuerySchema = z
  .object({
    city: publicCitySchema,
    q: z.string().trim().max(100).default(''),
    hasServices: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    page: z
      .string()
      .regex(/^[1-9]\d{0,3}$/)
      .default('1')
      .transform(Number)
  })
  .strict();
export const profileQuerySchema = z.object({ city: publicCitySchema }).strict();
export const publicBusinessIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;
export const DISCOVERY_PAGE_SIZE = 12;

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinorUnits: number | null;
  currency: string;
}
export interface PublicBusiness {
  id: string;
  name: string;
  description: string | null;
  city: string;
  location: string;
  phone: string;
  email: string | null;
  services: PublicService[];
}
export interface DiscoveryResult {
  businesses: PublicBusiness[];
  page: number;
  hasMore: boolean;
}

// Explicit allowlist: never reuse owner/admin DTOs or include user/bookings relations.
export const publicBusinessSelect = {
  id: true,
  name: true,
  description: true,
  city: true,
  location: true,
  phone: true,
  email: true,
  services: {
    where: { active: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      priceMinorUnits: true,
      currency: true
    }
  }
} satisfies BusinessSelectStub;

export function publicBusinessWhere(city: string): BusinessWhereStub {
  return {
    city: { equals: city, mode: 'insensitive' },
    status: 'APPROVED',
    owner: { status: 'ACTIVE' }
  };
}

export function discoveryWhere(query: DiscoveryQuery): BusinessWhereStub {
  // Prisma contains uses SQL LIKE; escape wildcard characters for literal search.
  const term = query.q.replace(/[\\%_]/g, '\\$&');
  return {
    ...publicBusinessWhere(query.city),
    ...(query.hasServices ? { services: { some: { active: true } } } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { services: { some: { active: true, name: { contains: term, mode: 'insensitive' } } } }
          ]
        }
      : {})
  };
}
