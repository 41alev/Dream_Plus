/* global window, requestAnimationFrame */
const { test, expect } = require('@playwright/test');
const { login, goToView } = require('./helpers');

async function api(page, method, path, body) {
  const token = await page.evaluate(() => localStorage.getItem('dt_token'));
  const response = await page.request.fetch('/api' + path, { method, data: body,
    headers: { Authorization: 'Bearer ' + token } });
  expect(response.ok(), path).toBeTruthy();
  return response.json();
}

for (const view of ['counts', 'items', 'lots', 'production']) {
  test(view + ' prerequisite outage is retried instead of caching empty data', async ({ page }) => {
    await login(page);
    await page.route('**/api/warehouses', route => route.fulfill({ status: 503,
      contentType: 'application/json', body: '{"error":"Warehouse outage"}' }));
    await page.locator('.nav-tab[data-view="' + view + '"]').click();
    const host = page.locator('#view-' + view);
    await expect(host.getByRole('alert')).toContainText('Warehouse outage');
    await page.unroute('**/api/warehouses');
    await host.getByRole('button', { name: 'Yeniden Dene' }).click();
    await expect(host.locator('.topbar')).toBeVisible();
  });
}

test('quality lot loading failure blocks save and offers retry', async ({ page }) => {
  await login(page);
  await goToView(page, 'quality');
  await page.route('**/api/stock/lots?*', route => route.fulfill({ status: 503,
    contentType: 'application/json', body: '{"error":"Lot outage"}' }));
  await page.locator('#inNew').click();
  await expect(page.locator('#inGo')).toBeDisabled();
  await expect(page.locator('#inLotRetry')).toBeVisible();
  await page.unroute('**/api/stock/lots?*');
  await page.locator('#inLotRetry').click();
  await expect(page.locator('#inGo')).toBeEnabled();
  await expect(page.locator('#inLotRetry')).toHaveCount(0);
});

test('routing outage preserves stored operations and offers retry', async ({ page }) => {
  await login(page);
  await goToView(page, 'planning');
  await page.getByRole('tab', { name: 'Rotalar', exact: true }).click();
  const item = await page.locator('#rtItem').inputValue();
  const before = await api(page, 'GET', '/planning/routings/' + item);
  expect(before.length).toBeGreaterThan(0);
  await page.route('**/api/planning/routings/*', route => route.fulfill({ status: 503,
    contentType: 'application/json', body: '{"error":"Injected outage"}' }));
  await page.getByRole('tab', { name: 'İş Merkezleri', exact: true }).click();
  await page.getByRole('tab', { name: 'Rotalar', exact: true }).click();
  await expect(page.locator('#planBody [role="alert"]')).toContainText('Injected outage');
  await expect(page.locator('#rtSave')).toHaveCount(0);
  expect(await api(page, 'GET', '/planning/routings/' + item)).toEqual(before);
  await page.unroute('**/api/planning/routings/*');
  await page.locator('#planBody').getByRole('button', { name: 'Yeniden Dene' }).click();
  await expect(page.locator('#rtSave')).toBeVisible();
});

test('late capacity response preserves the selected routing tab', async ({ page }) => {
  await login(page);
  await goToView(page, 'planning');
  let release, observed;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { observed = resolve; });
  await page.route('**/api/planning/capacity?*', async route => { observed(); await gate; await route.continue(); });
  await page.getByRole('tab', { name: 'Kapasite', exact: true }).click();
  await started;
  await page.getByRole('tab', { name: 'Rotalar', exact: true }).click();
  await expect(page.locator('#rtSave')).toBeVisible();
  const delayed = page.waitForResponse(response => response.url().includes('/planning/capacity?'));
  release();
  await delayed;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('#rtSave')).toBeVisible();
});

test('expired stock shows physical quantity separately from usable quantity', async ({ page }) => {
  await login(page);
  const item = await api(page, 'POST', '/items', { name: 'Expired browser sentinel' });
  await api(page, 'POST', '/stock/move', { itemId: item.id, type: 'in', qty: 3, expiryDate: '2020-01-01' });
  await goToView(page, 'items');
  await page.locator('#itSearch').fill('Expired browser sentinel');
  const row = page.locator('#view-items tr').filter({ hasText: 'Expired browser sentinel' });
  await expect(row).toContainText('Fiziksel: 3');
  await page.locator('#view-items [data-open="' + item.id + '"]').click();
  await expect(page.locator('#modalBox .alert.warn')).toContainText('Fiziksel miktar: 3');
});

for (const [view, endpoint] of [['counts', 'stock/counts'], ['items', 'items'], ['lots', 'stock/lots'], ['production', 'production']]) {
  test(view + ' list outage becomes retryable error and recovers', async ({ page }) => {
    await login(page);
    await page.route('**/api/' + endpoint + '?*', route => route.fulfill({ status: 503,
      contentType: 'application/json', body: '{"error":"Injected list outage"}' }));
    await page.locator('.nav-tab[data-view="' + view + '"]').click();
    const host = page.locator('#view-' + view);
    await expect(host.getByRole('alert')).toContainText('Injected list outage');
    await page.unroute('**/api/' + endpoint + '?*');
    await host.getByRole('button', { name: 'Yeniden Dene' }).click();
    await expect(host.locator('.topbar')).toBeVisible();
  });
}

test('shipment double activation sends one transition', async ({ page }) => {
  await login(page);
  const item = await api(page, 'POST', '/items', { name: 'Browser shipment guard', openingQty: 3 });
  const customer = (await api(page, 'GET', '/sales/customers')).data[0];
  const shipment = await api(page, 'POST', '/sales/shipments', { customerId: customer.id,
    destination: 'Audit', items: [{ itemId: item.id, qty: 1 }] });
  await goToView(page, 'sales');
  await page.getByRole('tab', { name: 'Sevkiyatlar', exact: true }).click();
  const button = page.locator('[data-adv="' + shipment.id + '"]');
  await button.waitFor();
  let writes = 0;
  page.on('request', request => { if (request.method() === 'PATCH' && request.url().endsWith('/shipments/' + shipment.id + '/status')) writes++; });
  const changed = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/shipments/' + shipment.id + '/status'));
  await button.evaluate(element => { const button = /** @type {HTMLElement} */ (element); button.click(); button.click(); });
  await changed;
  await expect(page.locator('#salesBody')).toContainText('Yolda');
  expect(writes).toBe(1);
  expect((await api(page, 'GET', '/sales/shipments/' + shipment.id)).status).toBe('Yolda');
});

test('session expiry clears open modal and its form data', async ({ page }) => {
  await login(page);
  await goToView(page, 'items');
  await page.locator('#itNew').click();
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await page.evaluate(async () => {
    const client = window.eval('Api');
    await client.logout();
    try { await client.me(); } catch { /* Expected 401. */ }
  });
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#modalOverlay')).toBeHidden();
  await expect(page.locator('#modalBox')).toBeEmpty();
});

test('pending write remains locked through response body parsing', async ({ page }) => {
  await login(page);
  const result = await page.evaluate(async () => {
    const client = window.eval('Api');
    const original = window.fetch;
    let release;
    const body = new Promise(resolve => { release = resolve; });
    window.fetch = async () => { const response = new Response('{}'); response.json = () => body; return response; };
    try {
      const request = client.createItem({ name: 'Synthetic request' });
      await Promise.resolve();
      const before = client.pendingWriteCount();
      release({ id: 'synthetic' });
      await request;
      return [before, client.pendingWriteCount()];
    } finally { window.fetch = original; }
  });
  expect(result).toEqual([1, 0]);
});

test('late hidden counts response cannot replace sales row handlers', async ({ page }) => {
  await login(page);
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const observed = new Promise(resolve => { started = resolve; });
  await page.route('**/api/stock/counts?*', async route => { started(); await gate; await route.continue(); });
  await page.locator('.nav-tab[data-view="counts"]').click();
  await observed;
  await goToView(page, 'sales');
  await page.locator('#salesBody [data-open]').first().waitFor();
  release();
  await expect(page.locator('#view-counts .topbar')).toHaveCount(1);
  const detail = page.waitForResponse(response => /\/api\/sales\/orders\/[^/?]+$/.test(response.url()));
  await page.locator('#salesBody [data-open]').first().click();
  expect((await detail).ok()).toBeTruthy();
  await expect(page.locator('#modalOverlay')).toBeVisible();
});

test('routing search resolves a product outside the preloaded page', async ({ page }) => {
  await login(page);
  const item = await api(page, 'POST', '/items', { name: 'ZZZ routing searchable sentinel', itemType: 'finished' });
  // Keep the real server search; omit the sentinel only from the initial preload.
  await page.route('**/api/items?*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('pageSize') !== '300') return route.continue();
    const response = await route.fetch();
    const result = await response.json();
    result.data = result.data.filter(row => row.id !== item.id);
    await route.fulfill({ response, json: result });
  });
  await goToView(page, 'planning');
  await page.getByRole('tab', { name: 'Rotalar', exact: true }).click();
  await expect(page.locator('#rtItem option[value="' + item.id + '"]')).toHaveCount(0);
  await page.locator('#rtItem').locator('..').locator('input.select-search').fill('ZZZ routing searchable');
  await expect(page.locator('#rtItem')).toHaveValue(item.id);
});

test('quality lot search reaches omitted lots', async ({ page }) => {
  await login(page);
  await goToView(page, 'quality');
  let initialItem;
  await page.route('**/api/stock/lots?*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('q')) return route.fulfill({ json: { data: [{ id: 'search-result', lotNo: 'SENTINEL-101', qty: 1, status: 'available' }] } });
    if (!initialItem) initialItem = url.searchParams.get('itemId');
    return route.fulfill({ json: { data: [] } });
  });
  await page.locator('#inNew').click();
  await expect(page.locator('#inLot')).toBeEnabled();
  await page.locator('#inLot').locator('..').locator('input.select-search').fill('SENTINEL-101');
  await expect(page.locator('#inLot')).toHaveValue('search-result');
  expect(initialItem).toBeTruthy();
});

test('quality ignores delayed lots from the previous item', async ({ page }) => {
  await login(page);
  await goToView(page, 'quality');
  let firstItem, release, observed;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { observed = resolve; });
  await page.route('**/api/stock/lots?*', async route => {
    const item = new URL(route.request().url()).searchParams.get('itemId');
    if (!firstItem) firstItem = item;
    if (item === firstItem) {
      observed();
      await gate;
      await route.fulfill({ json: { data: [{ id: 'old-item-lot', lotNo: 'OLD', qty: 1, status: 'available' }] } });
    } else {
      await route.fulfill({ json: { data: [{ id: 'new-item-lot', lotNo: 'NEW', qty: 1, status: 'available' }] } });
    }
  });
  await page.locator('#inNew').click();
  await started;
  const next = await page.locator('#inItem option').evaluateAll(options => /** @type {HTMLOptionElement} */ (options[1]).value);
  await page.locator('#inItem').selectOption(next);
  await expect(page.locator('#inLot option[value="new-item-lot"]')).toHaveCount(1);
  const delayed = page.waitForResponse(response => response.url().includes('/stock/lots?') && new URL(response.url()).searchParams.get('itemId') === firstItem);
  release();
  await delayed;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('#inLot option[value="old-item-lot"]')).toHaveCount(0);
  await expect(page.locator('#inLot option[value="new-item-lot"]')).toHaveCount(1);
});
