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
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: response.status === 204 ? null : await response.json(), revision: response.headers.get('ETag') };
}
async function success(method, route, body) {
  const result = await api(method, route, body);
  assert(result.status >= 200 && result.status < 300, JSON.stringify(result));
  return result.data;
}
async function main() {
  token = (await success('POST', '/auth/login', { username: 'admin', password: 'Admin123!' })).token;
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
  const displayed = await success('GET', '/items/' + expItem.id);
  assert.equal(displayed.qty, 3);
  assert.equal(displayed.usableQty, 0);
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
  const cancellable = await success('POST', '/sales/orders', { customerId: customer.id, lines: [{ itemId: item.id, qty: 2, price: 10 }] });
  const reversed = await success('POST', '/sales/shipments', { soId: cancellable.id, warehouseId, destination: 'Reverse test', items: [{ itemId: item.id, qty: 1 }] });
  await success('DELETE', '/sales/shipments/' + reversed.id);
  await success('POST', '/sales/orders/' + cancellable.id + '/cancel', {});
  console.log('PASS fully reversed shipment allows order cancellation');

  const center = (await success('GET', '/planning/work-centers'))[0].id;
  const route = '/planning/routings/' + item.id;
  const revision = (await api('GET', route)).revision;
  const operations = [{ operationNo: 10, operationName: 'Revision guard', workCenterId: center }];
  await success('PUT', route, { operations, expectedRevision: 'W/' + revision });
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
