export type City = 'Kitwe' | 'Ndola';
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
export interface DiscoveryFilters {
  city: City;
  q: string;
  hasServices: boolean;
  page: number;
}

export function readDiscoveryFilters(params: URLSearchParams): DiscoveryFilters | null {
  const allowed = ['city', 'q', 'hasServices', 'page'];
  if ([...params.keys()].some((key) => !allowed.includes(key) || params.getAll(key).length !== 1))
    return null;
  const city = params.get('city') ?? 'Kitwe';
  const q = (params.get('q') ?? '').trim();
  const hasServices = params.get('hasServices') ?? 'false';
  const page = params.get('page') ?? '1';
  if (
    !['Kitwe', 'Ndola'].includes(city) ||
    q.length > 100 ||
    !['true', 'false'].includes(hasServices) ||
    !/^[1-9]\d{0,3}$/.test(page)
  )
    return null;
  return { city: city as City, q, hasServices: hasServices === 'true', page: Number(page) };
}
export function discoverySearch(filters: DiscoveryFilters): string {
  const params = new URLSearchParams({ city: filters.city });
  if (filters.q) params.set('q', filters.q);
  if (filters.hasServices) params.set('hasServices', 'true');
  if (filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}
export function formatServicePrice(service: PublicService): string | null {
  if (
    service.priceMinorUnits === null ||
    service.priceMinorUnits < 0 ||
    !Number.isSafeInteger(service.priceMinorUnits)
  )
    return null;
  // Unknown/invalid currency data must not crash the public profile or invent a unit.
  if (!/^[A-Z]{3}$/.test(service.currency)) return null;
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency: service.currency,
    currencyDisplay: 'code'
  }).format(service.priceMinorUnits / 100);
}
