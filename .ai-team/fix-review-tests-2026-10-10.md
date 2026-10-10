## Regression checks (auth/setup statements removed)

### test/audit-regressions.js
```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
assert(process.env.DATA_DIR && process.env.BASE && fs.existsSync(path.join(process.env.DATA_DIR, '.test-owner')),
  'Run node test/run-all.js audit-regressions with an owned sandbox');
const db = require('../server/db');
const stock = require('../server/services/stock');
const { today, addDays } = require('../server/lib/dates');
let token;
async function api(method, route, body) {
  const response = await fetch(process.env.BASE + '/api' + route, { method,
    headers: { 'Content-Type': 'application/json', [REDACTED] + token },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json(), revision: response.headers.get('ETag') };
}
async function success(method, route, body) {
  const result = await api(method, route, body);
  assert(result.status >= 200 && result.status < 300, JSON.stringify(result));
  return result.data;
}
async function main() {
  [REDACTED] success('POST', '/auth/login', { username: 'admin', [REDACTED] })).token;
  const warehouseId = (await success('GET', '/warehouses'))[0].id;
  const item = await success('POST', '/items', { name: 'Audit cost regression', itemType: 'raw' });
  let held;
  db.txImmediate(() => {
    stock.receiveLot({ itemId: item.id, warehouseId, qty: 10, unitCostBase: 10 });
    held = stock.receiveLot({ itemId: item.id, warehouseId, qty: 10, unitCostBase: 100, status: 'quarantine' });
    stock.changeLotStatus({ lotId: held, toStatus: 'available', qty: 5 });
  });
  assert.equal(db.prepare('SELECT avg_cost FROM items WHERE id=?').get(item.id).avg_cost, 40);
  db.txImmediate(() => stock.changeLotStatus({ lotId: held, toStatus: 'available' }));
  assert.equal(db.prepare('SELECT avg_cost FROM items WHERE id=?').get(item.id).avg_cost, 55);
  const beforeSame = db.prepare('SELECT COUNT(*) n FROM movements').get().n;
  db.txImmediate(() => stock.changeLotStatus({ lotId: held, toStatus: 'available', qty: 1 }));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM movements').get().n, beforeSame);
  db.txImmediate(() => stock.changeLotStatus({ lotId: held, toStatus: 'blocked' }));
  assert.equal(db.prepare('SELECT avg_cost FROM items WHERE id=?').get(item.id).avg_cost, 40);
  console.log('PASS quality cost: full/partial release, rejection and same-status no-op');

  const expItem = await success('POST', '/items', { name: 'Audit expiry regression', itemType: 'raw' });
  let expired, eligible;
  db.txImmediate(() => {
    expired = stock.receiveLot({ itemId: expItem.id, warehouseId, qty: 3, expiryDate: addDays(today(), -1) });
    eligible = stock.receiveLot({ itemId: expItem.id, warehouseId, qty: 2, expiryDate: today() });
  });
  const snapshot = () => db.prepare('SELECT id,qty,status FROM stock_lots WHERE item_id=? ORDER BY id').all(expItem.id);
  const before = snapshot();
  assert.equal(stock.availableQty(expItem.id), 2);
  assert.throws(() => stock.consume([{ lotId: eligible, qty: 1 }, { lotId: expired, qty: 1 }], { itemId: expItem.id }), /expired/);
  assert.deepEqual(snapshot(), before);
  db.txImmediate(() => stock.issueStock({ itemId: expItem.id, qty: 2 }));
  assert.equal(db.prepare('SELECT qty FROM stock_lots WHERE id=?').get(expired).qty, 3);
  assert.equal(stock.availableQty(expItem.id), 0);
  assert.throws(() => db.txImmediate(() => stock.issueStock({ itemId: expItem.id, qty: 1 })), /Insufficient/);
  const timeless = db.txImmediate(() => stock.receiveLot({ itemId: expItem.id, warehouseId, qty: 1 }));
  assert.equal(stock.allocate(expItem.id, 1)[0].lotId, timeless);
  stock.consume([{ lotId: expired, qty: 1 }], { itemId: expItem.id, allowExpired: true, refType: 'ncr' });
  console.log('PASS expired lot: FEFO, explicit choice, rollback, today/null and disposal');

  db.prepare(`INSERT INTO production_orders(id,order_no,item_id,qty,produced_qty,scrap_qty,labor_cost,status)
    VALUES(?,?,?,?,?,?,?,?)`).run('audit-scrap', 'AUDIT-SCRAP', item.id, 5, 0, 5, 100, 'Tamamlandı');
  const cost = require('../server/services/costing').computeProductionCost('audit-scrap');
  assert.deepEqual([cost.goodQty, cost.total, cost.unitCost], [0, 100, 0]);
  console.log('PASS zero good output retains total loss without division');

  const customer = await success('POST', '/sales/customers', { name: 'Audit invoice customer' });
  const order = await success('POST', '/sales/orders', { customerId: customer.id, lines: [{ itemId: item.id, qty: 10, price: 10 }] });
  const shipment = await success('POST', '/sales/shipments', { soId: order.id, warehouseId, destination: 'Audit destination', items: [{ itemId: item.id, qty: 1 }] });
  assert.equal((await api('POST', '/sales/orders/' + order.id + '/cancel', {})).status, 409);
  await success('POST', '/sales/invoices', { customerId: customer.id, soId: order.id, shipmentId: shipment.id });
  const path = '/sales/shipments/' + shipment.id + '/status';
  await success('PATCH', path, { expectedStatus: 'Hazırlanıyor' });
  assert.equal((await api('PATCH', path, { expectedStatus: 'Hazırlanıyor' })).status, 409);
  assert.equal((await success('GET', '/sales/shipments/' + shipment.id)).status, 'Yolda');
  console.log('PASS partial shipment cancellation and stale status mutation');

  const center = (await success('GET', '/planning/work-centers'))[0].id;
  const route = '/planning/routings/' + item.id;
  const revision = (await api('GET', route)).revision;
  const operations = [{ operationNo: 10, operationName: 'Revision guard', workCenterId: center }];
  await success('PUT', route, { operations, expectedRevision: revision });
  assert.equal((await api('PUT', route, { operations, expectedRevision: revision })).status, 409);
  assert.equal((await api('PUT', route, { operations: [] })).status, 422);
  assert.equal((await success('GET', route)).length, 1);
  await success('PUT', route, { operations: [], clear: true, expectedRevision: (await api('GET', route)).revision });
  assert.equal((await success('GET', route)).length, 0);
  console.log('PASS routing revision conflict and explicit clear');

  const fixture = fs.readFileSync(require.resolve('./license.js'), 'utf8').match(/const EXPIRED\s*=\s*([\s\S]*?);/)[1];
  const signed = vm.runInNewContext('(' + fixture + ')');
  const clock = Date.now;
  try {
    const expiry = new Date('2020-06-30T23:59:59').getTime();
    Date.now = () => expiry - 1;
    assert.equal(require('../server/lib/license').verify(signed).valid, true);
    for (const time of [expiry + 1, expiry + 12 * 3600000, expiry + 24 * 3600000]) {
      Date.now = () => time;
      assert.equal(require('../server/lib/license').verify(signed).valid, false);
    }
  } finally { Date.now = clock; }
  console.log('PASS signed licence expiry boundaries');

  db.txImmediate(() => {
    const insert = db.prepare('INSERT INTO items(id,name,item_type,created_at) VALUES(?,?,?,?)');
    for (let i = 0; i < 301; i++) insert.run('audit-page-' + i, 'AA paging ' + String(i).padStart(4, '0'), 'finished', Date.now());
    insert.run('audit-page-sentinel', 'ZZZ unique beyond300', 'finished', Date.now());
    for (let i = 0; i < 101; i++) stock.receiveLot({ itemId: expItem.id, warehouseId, qty: 1, lotNo: 'LOT-' + i });
  });
  const firstPage = await success('GET', '/items?itemType=finished&pageSize=300');
  assert(firstPage.total > 300);
  assert(!firstPage.data.some(row => row.id === 'audit-page-sentinel'));
  assert.equal((await success('GET', '/items?itemType=finished&q=unique%20beyond300')).data[0].id, 'audit-page-sentinel');
  const lotPage = await success('GET', '/stock/lots?itemId=' + expItem.id + '&pageSize=100');
  assert(lotPage.total > 100);
  const omitted = db.prepare('SELECT lot_no FROM stock_lots WHERE item_id=? AND qty>0').all(expItem.id)
    .find(row => row.lot_no && !lotPage.data.some(lot => lot.lotNo === row.lot_no));
  assert(omitted);
  assert((await success('GET', '/stock/lots?itemId=' + expItem.id + '&q=' + omitted.lot_no)).data.some(row => row.lotNo === omitted.lot_no));
  console.log('PASS real dataset: over 300 items and over 100 lots remain searchable');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());


```

### test/e2e-browser/audit-regressions.spec.js
```javascript
/* global window, requestAnimationFrame */
const { test, expect } = require('@playwright/test');
const { login, goToView } = require('./helpers');

async function api(page, method, path, body) {
  const [REDACTED] page.evaluate(() => localStorage.getItem('dt_token'));
  const response = await page.request.fetch('/api' + path, { method, data: body,
    headers: { [REDACTED] + token } });
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

```
