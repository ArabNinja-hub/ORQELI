import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readDiscoveryFilters,
  discoverySearch,
  formatServicePrice,
  type PublicService
} from './discovery';

test('city and search context round-trip through shareable URLs', () => {
  const filters = { city: 'Ndola' as const, q: 'Hair & care', hasServices: true, page: 2 };
  assert.deepEqual(readDiscoveryFilters(new URLSearchParams(discoverySearch(filters))), filters);
  assert.equal(readDiscoveryFilters(new URLSearchParams())?.city, 'Kitwe');
});
test('unsupported city and malformed filters are not silently rewritten', () => {
  for (const query of [
    'city=Lusaka',
    'city=',
    'city=Kitwe&city=Ndola',
    'page=0',
    'page=1.2',
    'page=10000',
    'status=APPROVED',
    'hasServices=yes',
    `q=${'x'.repeat(101)}`
  ]) {
    assert.equal(readDiscoveryFilters(new URLSearchParams(query)), null, query);
  }
});
test('prices come only from valid stored amounts; missing is distinct from zero', () => {
  const service: PublicService = {
    id: 'test',
    name: 'test',
    description: null,
    durationMinutes: 30,
    priceMinorUnits: null,
    currency: 'ZMW'
  };
  assert.equal(formatServicePrice(service), null);
  assert.match(formatServicePrice({ ...service, priceMinorUnits: 12550 })!, /ZMW\s*125\.50/);
  assert.match(formatServicePrice({ ...service, priceMinorUnits: 0 })!, /ZMW\s*0\.00/);
  assert.equal(formatServicePrice({ ...service, priceMinorUnits: -1 }), null);
  assert.equal(formatServicePrice({ ...service, priceMinorUnits: 100, currency: 'invalid' }), null);
});
