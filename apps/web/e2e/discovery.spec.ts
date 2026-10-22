import { test, expect } from '@playwright/test';

// These fixtures exist only inside intercepted browser requests. No seed or API writes.
const business = {
  id: 'browser-test-record',
  name: 'Browser test business',
  description: 'A test-only service description.',
  city: 'Ndola',
  location: 'Test address',
  phone: '+260970000000',
  email: null,
  services: [
    {
      id: 'priced',
      name: 'Test priced service',
      description: null,
      durationMinutes: 30,
      priceMinorUnits: 12550,
      currency: 'ZMW'
    },
    {
      id: 'unpriced',
      name: 'Test unpriced service',
      description: null,
      durationMinutes: 45,
      priceMinorUnits: null,
      currency: 'ZMW'
    }
  ]
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { error: { code: 'UNAUTHENTICATED' } } })
  );
});

test('customer search, profile and back navigation preserve the selected city and filters', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/businesses?**', (route) =>
    route.fulfill({ json: { businesses: [business], page: 1, hasMore: false } })
  );
  await page.route('**/api/businesses/browser-test-record?**', (route) =>
    route.fulfill({ json: { business } })
  );
  await page.goto('/?city=Ndola');
  await expect(page.getByLabel('Explore your city')).toHaveValue('Ndola');
  await page.getByRole('button', { name: 'Explore businesses' }).click();
  await expect(page.getByRole('heading', { name: 'Explore Ndola' })).toBeVisible();
  await page.getByLabel('Business or service').fill('Test');
  await page.getByLabel('With listed services').check();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/city=Ndola&q=Test&hasServices=true/);
  await page.getByRole('link', { name: 'View Browser test business' }).click();
  await expect(page.getByRole('heading', { name: business.name })).toBeVisible();
  await expect(page.getByText(/ZMW\s*125\.50/)).toBeVisible();
  await expect(page.getByText('Price not listed', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Online booking is coming soon' })).toBeVisible();
  await expect(page.getByRole('button', { name: /book/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('profile.png'), fullPage: true });
  await page.getByRole('link', { name: 'Back to businesses in Ndola' }).click();
  await expect(page.getByLabel('Business or service')).toHaveValue('Test');
  await expect(page.getByLabel('With listed services')).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('discovery.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('empty and invalid searches are honest, with supported-city recovery links', async ({
  page
}) => {
  await page.route('**/api/businesses?**', (route) =>
    route.fulfill({ json: { businesses: [], page: 1, hasMore: false } })
  );
  await page.goto('/discover?city=Kitwe');
  await expect(page.getByRole('heading', { name: 'No businesses to show yet' })).toBeVisible();
  await expect(page.getByText('No matching businesses in Kitwe')).toBeVisible();
  await page.goto('/discover?city=Lusaka');
  await expect(page.getByRole('heading', { name: 'Choose a supported city' })).toBeVisible();
  await page.getByRole('link', { name: 'Explore Ndola', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Explore Ndola' })).toBeVisible();
});

test('API failure can be retried without losing the search', async ({ page }) => {
  let fail = true;
  await page.route('**/api/businesses?**', (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: {} } }
        : { json: { businesses: [business], page: 1, hasMore: false } }
    )
  );
  await page.goto('/discover?city=Ndola&q=Test');
  await expect(page.getByRole('alert')).toContainText('We couldn’t load these details');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: business.name })).toBeVisible();
  await expect(page.getByLabel('Business or service')).toHaveValue('Test');
});

test('hidden or missing profiles display no listing data', async ({ page }) => {
  await page.route('**/api/businesses/missing?**', (route) =>
    route.fulfill({ status: 404, json: { error: {} } })
  );
  await page.goto('/businesses/missing?city=Ndola');
  await expect(page.getByRole('heading', { name: 'Business not available' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to businesses in Ndola' })).toBeVisible();
  await expect(page.getByText('Business contact')).toHaveCount(0);
});

test('changing city cancels obsolete results and loading is not an empty state', async ({
  page
}) => {
  let releaseOldRequest: (() => void) | undefined;
  await page.route('**/api/businesses?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('city') === 'Kitwe') {
      await new Promise<void>((resolve) => {
        releaseOldRequest = resolve;
      });
      await route
        .fulfill({
          json: {
            businesses: [{ ...business, name: 'Stale test result' }],
            page: 1,
            hasMore: false
          }
        })
        .catch(() => {});
    } else await route.fulfill({ json: { businesses: [business], page: 1, hasMore: false } });
  });
  await page.goto('/discover?city=Kitwe');
  await expect(page.getByRole('status')).toHaveText('Loading businesses in Kitwe…');
  await page.getByRole('combobox', { name: 'City', exact: true }).selectOption('Ndola');
  await expect(page.getByRole('heading', { name: business.name })).toBeVisible();
  releaseOldRequest?.();
  await expect(page.getByText('Stale test result')).toHaveCount(0);
});

test('pagination retains search filters and changes the requested page', async ({ page }) => {
  await page.route('**/api/businesses?**', (route) => {
    const second = new URL(route.request().url()).searchParams.get('page') === '2';
    return route.fulfill({
      json: {
        businesses: [{ ...business, name: second ? 'Page two test business' : business.name }],
        page: second ? 2 : 1,
        hasMore: !second
      }
    });
  });
  await page.goto('/discover?city=Ndola&q=Test&hasServices=true');
  await page.getByRole('link', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/city=Ndola&q=Test&hasServices=true&page=2/);
  await expect(page.getByRole('heading', { name: 'Page two test business' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Next page' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous page' }).click();
  await expect(page.getByRole('heading', { name: business.name })).toBeVisible();
});
