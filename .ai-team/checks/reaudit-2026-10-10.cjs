// Read-only audit of application source; mutations use an owned temporary DB.
/* global console, process, __dirname, fetch, setTimeout, clearTimeout, localStorage, requestAnimationFrame, Api */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fork } = require('node:child_process');
const { chromium } = require('@playwright/test');
const ROOT = path.resolve(__dirname, '../..');
const { createSandbox } = require(path.join(ROOT, 'test/helpers/sandbox'));
const { login, goToView } = require(path.join(ROOT, 'test/e2e-browser/helpers'));
const findings = [];
function record(id, expected, actual, status = 'FAIL') {
  findings.push({ id, expected, actual, status, sourceCommit: '8ff6e2a' });
  console.log(JSON.stringify(findings.at(-1)));
}

(async () => {
  // Existing signed public fixture; only the process-local clock is changed.
  const source = fs.readFileSync(path.join(ROOT, 'test/license.js'), 'utf8');
  const expired = vm.runInNewContext('(' + source.match(/const EXPIRED = (\{.*\});/)[1] + ')');
  const originalNow = Date.now;
  try {
    Date.now = () => new Date('2020-07-01T12:00:00').getTime();
    const result = require(path.join(ROOT, 'server/lib/license')).verify(expired);
    if (result.valid) record('LICENSE_EXPIRY', 'Yesterday-expired signed license rejected', result);
    else throw new Error('License hypothesis not reproduced');
  } finally { Date.now = originalNow; }

  const sandbox = createSandbox();
  const server = fork(path.join(ROOT, 'server/index.js'), [], {
    cwd: ROOT, env: { ...sandbox.env, API_RATE_LIMIT: '200000' },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  let browser, auditDb;
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Audit server startup timeout')), 20000);
      server.once('message', message => { clearTimeout(timer); resolve(message.port); });
      server.once('error', reject);
      server.once('exit', code => reject(new Error('Audit server exit ' + code)));
    });
    const base = 'http://127.0.0.1:' + port;
    browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: base });
    const page = await context.newPage();
    await login(page);
    const token = await page.evaluate(() => localStorage.getItem('dt_token'));
    const api = async (method, endpoint, body) => {
      const response = await fetch(base + '/api' + endpoint, {
        method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(method + ' ' + endpoint + ': ' + response.status);
      return data;
    };

    Object.assign(process.env, sandbox.env);
    auditDb = require(path.join(ROOT, 'server/db'));
    const stock = require(path.join(ROOT, 'server/services/stock'));
    const warehouses = await api('GET', '/warehouses');
    const warehouseId = warehouses[0].id;
    const costItem = await api('POST', '/items', { name: 'Audit average cost', itemType: 'raw' });
    let heldLot;
    auditDb.txImmediate(() => {
      stock.receiveLot({ itemId: costItem.id, warehouseId, qty: 10, unitCostBase: 10 });
      heldLot = stock.receiveLot({ itemId: costItem.id, warehouseId, qty: 10, unitCostBase: 100, status: 'quarantine' });
      stock.changeLotStatus({ lotId: heldLot, toStatus: 'available' });
    });
    const average = auditDb.prepare('SELECT qty_cache, avg_cost FROM items WHERE id=?').get(costItem.id);
    if (average.avg_cost !== 55) record('QUALITY_AVERAGE_COST', '20 available units have weighted unit cost 55', average);
    const expiredItem = await api('POST', '/items', { name: 'Audit expired stock', itemType: 'raw' });
    auditDb.txImmediate(() => {
      stock.receiveLot({ itemId: expiredItem.id, warehouseId, qty: 3, unitCostBase: 1, expiryDate: '2020-01-01' });
      const consumed = stock.issueStock({ itemId: expiredItem.id, warehouseId, qty: 1 });
      if (consumed.length) record('EXPIRED_STOCK_CONSUMED', 'Expired lot consumption rejected before mutation', { consumed: consumed[0].qty, remaining: stock.availableQty(expiredItem.id) });
    });
    const productionId = 'audit-full-scrap';
    auditDb.prepare(`INSERT INTO production_orders(id,order_no,item_id,qty,produced_qty,scrap_qty,labor_cost,status)
      VALUES(?,?,?,?,?,?,?,?)`).run(productionId, 'AUDIT-SCRAP', costItem.id, 5, 0, 5, 100, 'Tamamlandı');
    const cost = require(path.join(ROOT, 'server/services/costing')).computeProductionCost(productionId);
    if (cost.goodQty !== 0) record('FULL_SCRAP_COST', 'Good quantity 0, total cost 100 retained', cost);
    const customer = await api('POST', '/sales/customers', { name: 'Audit Customer', currency: 'TRY', creditLimit: 1000000 });
    const order = await api('POST', '/sales/orders', { customerId: customer.id, currency: 'TRY', lines: [{ itemId: costItem.id, qty: 10, price: 10 }] });
    const shipment = await api('POST', '/sales/shipments', { soId: order.id, warehouseId, destination: 'Audit destination', items: [{ itemId: costItem.id, qty: 1 }] });
    await api('POST', '/sales/orders/' + order.id + '/cancel', {});
    const invoice = await fetch(base + '/api/sales/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ customerId: customer.id, soId: order.id, shipmentId: shipment.id }) });
    if (invoice.status === 409) record('PARTIAL_SHIPMENT_CANCEL', 'Shipped stock remains invoiceable or cancellation is rejected', { cancelAllowed: true, invoiceStatus: invoice.status, invoiceError: await invoice.json() });

    const duplicate = await browser.newPage({ baseURL: base });
    await login(duplicate);
    await goToView(duplicate, 'sales');
    await duplicate.getByRole('tab', { name: 'Sevkiyatlar', exact: true }).click();
    const advance = duplicate.locator('[data-adv="' + shipment.id + '"]');
    await advance.waitFor();
    const responses = new Promise(resolve => {
      let count = 0;
      duplicate.on('response', response => {
        if (response.request().method() === 'PATCH' && response.url().endsWith('/sales/shipments/' + shipment.id + '/status') && ++count === 2) resolve();
      });
    });
    await advance.evaluate(element => { element.click(); element.click(); });
    await responses;
    const shipmentAfter = await api('GET', '/sales/shipments/' + shipment.id);
    record('SHIPMENT_DOUBLE_ADVANCE', 'Repeated immediate activation advances shipment at most once', { status: shipmentAfter.status });
    await duplicate.close();

    await goToView(page, 'planning');
    await page.getByRole('tab', { name: 'Rotalar', exact: true }).click();
    await page.waitForSelector('#rtItem');
    const itemId = await page.locator('#rtItem').inputValue();
    const centers = await api('GET', '/planning/work-centers');
    await api('PUT', '/planning/routings/' + itemId, { operations: [{
      operationNo: 10, operationName: 'Audit preserved operation', workCenterId: centers[0].id,
      setupMinutes: 1, runMinutesPerUnit: 1, queueMinutes: 0, scrapPct: 0
    }] });
    await page.route('**/api/planning/routings/*', route => route.request().method() === 'GET'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Injected audit outage"}' })
      : route.continue());
    await page.getByRole('tab', { name: 'İş Merkezleri', exact: true }).click();
    await page.getByRole('tab', { name: 'Rotalar', exact: true }).click();
    await page.waitForSelector('#rtSave');
    const save = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/planning/routings/'));
    await page.locator('#rtSave').click();
    await save;
    const after = await api('GET', '/planning/routings/' + itemId);
    if (after.length === 0) record('ROUTING_OUTAGE_DELETE', 'Failed GET cannot erase the saved operation', { before: 1, after: after.length });
    else throw new Error('Routing hypothesis not reproduced');
    await page.close();

    const counts = await browser.newPage({ baseURL: base });
    await login(counts);
    await counts.route('**/api/stock/counts?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Injected audit outage"}' }));
    const countsFailure = counts.waitForResponse(response => response.url().includes('/api/stock/counts?') && response.status() === 503);
    await counts.locator('.nav-tab[data-view="counts"]').click();
    await countsFailure;
    await counts.waitForSelector('#toast.show');
    const countsState = await counts.locator('#view-counts').innerText();
    record('COUNTS_LOADING_ERROR', 'Visible retryable error replaces loading', { text: countsState, retryButtons: await counts.locator('#view-counts').getByRole('button', { name: /Yeniden Dene/ }).count() });
    await counts.close();

    const stale = await browser.newPage({ baseURL: base });
    await login(stale);
    let releaseOrders;
    const gate = new Promise(resolve => { releaseOrders = resolve; });
    let observed;
    const started = new Promise(resolve => { observed = resolve; });
    await stale.route('**/api/sales/orders?*', async route => {
      observed();
      await gate;
      await route.continue();
    });
    await stale.route('**/api/sales/invoices?*', route => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'audit-invoice',
        invoice_no: 'AUDIT-1', customer_name: 'Audit Fixture', invoice_date: '2026-10-10',
        amount: 100, openAmount: 100, currency: 'TRY', status: 'issued', invoice_type: 'satis' }],
        total: 1, page: 1, pageSize: 50 }) }));
    await goToView(stale, 'sales');
    await started;
    await stale.getByRole('tab', { name: 'Faturalar', exact: true }).click();
    await stale.locator('#salesBody th').filter({ hasText: 'Fatura no' }).waitFor();
    const delayedOrders = stale.waitForResponse(response => response.url().includes('/api/sales/orders?'));
    releaseOrders();
    await delayedOrders;
    await stale.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const orderVisible = await stale.locator('#soNew').count();
    record('STALE_SALES_RESPONSE', 'Invoices tab keeps invoice content after delayed orders response', {
      selectedTab: await stale.locator('#view-sales [role="tab"][aria-selected="true"]').innerText(),
      orderActionPresent: await stale.locator('#soNew').count(), invoiceHeaderPresent: await stale.locator('#salesBody th').filter({ hasText: 'Fatura no' }).count()
    }, orderVisible ? 'FAIL' : 'NOT_REPRODUCED');
    await stale.close();

    const session = await browser.newPage({ baseURL: base });
    await login(session);
    await goToView(session, 'items');
    await session.locator('#itNew').click();
    await session.waitForSelector('#modalOverlay.show');
    await session.evaluate(async () => {
      await Api.logout();
      try { await Api.me(); } catch { /* Expected 401 triggers session-expired. */ }
    });
    await session.waitForSelector('#loginScreen', { state: 'visible' });
    record('SESSION_MODAL_REMAINS', 'Expired session closes application dialogs', {
      modalVisible: await session.locator('#modalOverlay').isVisible(),
      modalTextPresent: !!(await session.locator('#modalBox').innerText())
    });
    await session.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => { if (server.exitCode !== null) return resolve(); server.once('exit', resolve); server.kill(); });
    if (auditDb) auditDb.close();
    sandbox.cleanup();
    fs.mkdirSync(path.join(ROOT, '.ai-team/evidence'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, '.ai-team/evidence/reaudit-2026-10-10.json'), JSON.stringify(findings, null, 2));
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
