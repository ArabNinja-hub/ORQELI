import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Search,
  ShieldCheck,
  Store,
  CalendarDays
} from 'lucide-react';
import {
  discoverySearch,
  readDiscoveryFilters,
  formatServicePrice,
  type DiscoveryFilters,
  type DiscoveryResult,
  type PublicBusiness
} from './discovery';

function usePublicData<T>(url: string | null) {
  const [attempt, setAttempt] = useState(0);
  const key = `${url}:${attempt}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: number }>({ key: '' });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    setState({ key });
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          if (active) setState({ key, error: response.status });
          return;
        }
        const data = (await response.json()) as T;
        if (active) setState({ key, data });
      } catch {
        if (active) setState({ key, error: 503 });
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [url, key]);
  const current = state.key === key ? state : { key };
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}

function InvalidFilters() {
  return (
    <section className="portal">
      <div className="portal-card">
        <span className="eyebrow">BUSINESS DISCOVERY</span>
        <h1>Choose a supported city</h1>
        <p>Explore Kitwe or Ndola. This link contains an unsupported city or search filter.</p>
        <div className="workspace-actions">
          <Link className="primary-button" to="/discover?city=Kitwe">
            Explore Kitwe
          </Link>
          <Link className="secondary-button" to="/discover?city=Ndola">
            Explore Ndola
          </Link>
        </div>
      </div>
    </section>
  );
}

function RequestError({ status, retry }: { status: number; retry: () => void }) {
  return (
    <div className="discovery-empty" role="alert">
      <h2>{status === 404 ? 'Business not available' : 'We couldn’t load these details'}</h2>
      <p>
        {status === 404
          ? 'This business may no longer be listed, or the city in the link may not match. Only approved businesses appear on ORQELI.'
          : 'Please check your connection and try again. Your search has been kept.'}
      </p>
      {status !== 404 && (
        <button className="secondary-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const filters = readDiscoveryFilters(params);
  const search = filters ? discoverySearch(filters) : null;
  const { data, error, retry } = usePublicData<DiscoveryResult>(
    search === null ? null : `/api/businesses?${search}`
  );
  if (!filters) return <InvalidFilters />;
  return (
    <section className="marketplace" aria-labelledby="discovery-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LOCAL BUSINESS DISCOVERY</span>
          <h1 id="discovery-heading">Explore {filters.city}</h1>
        </div>
        <p>
          Discover approved local businesses and their listed services. Online booking is coming
          soon.
        </p>
      </div>
      <DiscoveryForm
        key={search}
        filters={filters}
        onSearch={(next) => setParams(discoverySearch(next))}
      />
      <div className="marketplace-note">
        <ShieldCheck size={18} />
        <span>Every business shown has passed ORQELI’s manual approval process.</span>
      </div>
      {error ? (
        <RequestError status={error} retry={retry} />
      ) : !data ? (
        <p className="loading-state" role="status">
          Loading businesses in {filters.city}…
        </p>
      ) : (
        <>
          <p className="results-summary" role="status">
            {data.businesses.length
              ? `${data.businesses.length} ${data.businesses.length === 1 ? 'business' : 'businesses'} on this page · Page ${data.page}`
              : `No matching businesses in ${filters.city}`}
          </p>
          {data.businesses.length === 0 ? (
            <div className="discovery-empty">
              <Store size={32} />
              <h2>No businesses to show yet</h2>
              <p>
                Try a different city or clear your filters. We only show approved businesses; new
                listings will appear after review.
              </p>
              <Link className="text-link" to={`/discover?city=${filters.city}`}>
                Clear search and filters
              </Link>
            </div>
          ) : (
            <div className="business-grid">
              {data.businesses.map((business) => (
                <article className="public-business-card" key={business.id}>
                  <div className="eyebrow">
                    <MapPin size={15} />
                    {business.city}
                  </div>
                  <h2>
                    <Link to={`/businesses/${encodeURIComponent(business.id)}?${search}`}>
                      {business.name}
                    </Link>
                  </h2>
                  <p className="business-address">{business.location}</p>
                  {business.description && (
                    <p className="business-excerpt">{business.description}</p>
                  )}
                  <p className="service-count">
                    {business.services.length
                      ? `${business.services.length} listed ${business.services.length === 1 ? 'service' : 'services'}`
                      : 'Services not listed yet'}
                  </p>
                  <Link
                    className="text-link"
                    to={`/businesses/${encodeURIComponent(business.id)}?${search}`}
                    aria-label={`View ${business.name}`}
                  >
                    View business <ArrowRight size={16} />
                  </Link>
                </article>
              ))}
            </div>
          )}
          <nav className="results-pagination" aria-label="Results pages">
            {filters.page > 1 && (
              <Link
                className="secondary-button"
                to={`/discover?${discoverySearch({ ...filters, page: filters.page - 1 })}`}
              >
                <ArrowLeft size={16} />
                Previous page
              </Link>
            )}
            {data.hasMore && filters.page < 9999 && (
              <Link
                className="secondary-button"
                to={`/discover?${discoverySearch({ ...filters, page: filters.page + 1 })}`}
              >
                Next page
                <ArrowRight size={16} />
              </Link>
            )}
          </nav>
        </>
      )}
      <p className="discovery-owner-link">
        Own a local business?{' '}
        <Link className="text-link" to="/register?role=BUSINESS_OWNER">
          Submit your business for review <ArrowRight size={16} />
        </Link>
      </p>
    </section>
  );
}

function DiscoveryForm({
  filters,
  onSearch
}: {
  filters: DiscoveryFilters;
  onSearch: (filters: DiscoveryFilters) => void;
}) {
  const [q, setQ] = useState(filters.q);
  const [hasServices, setHasServices] = useState(filters.hasServices);
  return (
    <form
      className="discovery-filters"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch({ ...filters, q: q.trim(), hasServices, page: 1 });
      }}
    >
      <label className="form-field">
        <span>City</span>
        <select
          value={filters.city}
          onChange={(event) =>
            onSearch({
              ...filters,
              city: event.target.value as DiscoveryFilters['city'],
              q: q.trim(),
              hasServices,
              page: 1
            })
          }
        >
          <option>Kitwe</option>
          <option>Ndola</option>
        </select>
      </label>
      <label className="form-field search-field">
        <span>Business or service</span>
        <input
          type="search"
          maxLength={100}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name or service"
        />
      </label>
      <label className="filter-check">
        <input
          type="checkbox"
          checked={hasServices}
          onChange={(event) => setHasServices(event.target.checked)}
        />
        With listed services
      </label>
      <button className="primary-button" type="submit">
        <Search size={18} />
        Search
      </button>
    </form>
  );
}

export function BusinessProfilePage() {
  const { businessId } = useParams();
  const [params] = useSearchParams();
  const filters = readDiscoveryFilters(params);
  const validId = businessId && /^[a-zA-Z0-9_-]{1,128}$/.test(businessId);
  const { data, error, retry } = usePublicData<{ business: PublicBusiness }>(
    filters && validId
      ? `/api/businesses/${encodeURIComponent(businessId)}?city=${filters.city}`
      : null
  );
  if (!filters) return <InvalidFilters />;
  const business = data?.business;
  return (
    <section className="marketplace public-profile">
      <Link className="text-link profile-back" to={`/discover?${discoverySearch(filters)}`}>
        <ArrowLeft size={16} />
        Back to businesses in {filters.city}
      </Link>
      {!validId || error ? (
        <RequestError status={!validId ? 404 : error!} retry={retry} />
      ) : !business ? (
        <p className="loading-state" role="status">
          Loading business profile…
        </p>
      ) : (
        <>
          <div className="profile-heading">
            <span className="eyebrow">{business.city} · LOCAL BUSINESS</span>
            <h1>{business.name}</h1>
            <p>
              <MapPin size={18} />
              {business.location}
            </p>
            <span className="approval-label">
              <ShieldCheck size={16} />
              Approved by ORQELI
            </span>
          </div>
          <div className="profile-columns">
            <div>
              {business.description && (
                <section className="profile-section">
                  <h2>About this business</h2>
                  <p>{business.description}</p>
                </section>
              )}
              <section className="profile-section" aria-labelledby="services-heading">
                <h2 id="services-heading">Services</h2>
                {business.services.length ? (
                  <ul className="public-service-list">
                    {business.services.map((service) => (
                      <li key={service.id}>
                        <div>
                          <h3>{service.name}</h3>
                          {service.description && <p>{service.description}</p>}
                          {service.durationMinutes > 0 && (
                            <span className="service-duration">
                              {service.durationMinutes} minutes
                            </span>
                          )}
                        </div>
                        <span className="service-price">
                          {formatServicePrice(service) ?? 'Price not listed'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>This business has not listed its services yet.</p>
                )}
              </section>
            </div>
            <aside className="profile-sidebar">
              <section className="profile-section">
                <h2>Business contact</h2>
                <p>
                  {business.location}, {business.city}
                </p>
                <p>{business.phone}</p>
                {business.email && <p>{business.email}</p>}
              </section>
              <section className="booking-notice">
                <CalendarDays size={24} />
                <h2>Online booking is coming soon</h2>
                <p>
                  You cannot make an appointment through ORQELI yet. Contact the business directly
                  to ask about its services. No availability is shown or guaranteed.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
