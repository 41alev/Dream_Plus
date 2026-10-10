# Focused review context - Dream Plus 8ff6e2a

Read-only audit. Single company per customer installation is accepted. Application source is unchanged. Existing tests 41/41 and Chromium/WebKit46/46 passed again, but new isolated probes found failures. Snippets are partial, line-numbered source; missing surrounding code limits review.

Observed: GET503 routing followed by Save removed one stored operation; expired signed fixture on day after expiration returns valid:true; Counts GET503 leaves loading, zero Retry. Business reviewer independently reproduced partial shipment then order cancel blocking invoice with409, quality release qty20 avg10 vs weighted55, expired lot consumption allowed, and full-scrap produced0 being treated as planned5. Stale-tab and logout-modal probes in progress. Please verify logic; do not treat observations alone as complete proof.

## frontend-react/PlanningView.jsx:440-517 SHA256 e01ec1bbabe983e295a190b2137cbb1d7c384a85cff8d0cb5e14b6e89a411e16
```text
440:     });
441:   }
442:
443:   /* ================= ROTALAR ================= */
444:   async function routingTab(body, actions) {
445:     const items = itemsRef.current, workCenters = workCentersRef.current;
446:     actions.innerHTML = '';
447:     const producible = items.filter(i => i.itemType === 'finished' || i.itemType === 'semi');
448:     if (!routingItemIdRef.current && producible.length) routingItemIdRef.current = producible[0].id;
449:     const routingItemId = routingItemIdRef.current;
450:     const ops = routingItemId ? await Api.routings(routingItemId).catch(() => []) : [];
451:
452:     body.innerHTML = `
453:       <div class="alert info">${UI.getLang() === 'tr'
454:         ? 'Reçete NE gerektiğini söyler, rota NASIL yapıldığını. Çizelgeleme rotasız çalışmaz.'
455:         : 'The BOM says what is needed; the routing says how it is made. Scheduling needs a routing.'}</div>
456:       <div class="filters">
457:         ${select('rtItem', producible.map(i => ({ v: i.id, l: `${i.name} (${i.code || ''})` })), routingItemId)}
458:       </div>
459:       <div class="card">
460:         <div class="card-head"><h3>${t('routing')}</h3>
461:           ${can('approve') ? `<button class="btn btn-ghost btn-sm" id="rtAdd">${t('addOperation')}</button>` : ''}</div>
462:         <div class="card-body">
463:           <div id="rtList" class="dyn-list"></div>
464:           ${can('approve') ? `<button class="btn btn-primary" id="rtSave" style="margin-top:10px">${t('saveRouting')}</button>` : ''}
465:         </div>
466:       </div>`;
467:
468:     let rows = ops.map(o => ({ ...o }));
469:     const draw = () => {
470:       const host = document.getElementById('rtList');
471:       if (!rows.length) { host.innerHTML = `<div class="empty" style="padding:18px">${t('noRouting')}</div>`; return; }
472:       host.innerHTML = rows.map((o, i) => `
473:         <div class="dyn-row" style="align-items:flex-end">
474:           <div><label style="font-size:11px;color:var(--text-faint)">${t('operationNo')}</label><br>
475:             <input type="number" min="1" step="10" value="${o.operationNo}" data-i="${i}" data-f="operationNo" style="width:74px"></div>
476:           <div style="flex:1;min-width:130px"><label style="font-size:11px;color:var(--text-faint)">${t('operationName')}</label><br>
477:             <input type="text" value="${esc(o.operationName || '')}" data-i="${i}" data-f="operationName" style="width:100%"></div>
478:           <div><label style="font-size:11px;color:var(--text-faint)">${t('workCenter')}</label><br>
479:             <select data-i="${i}" data-f="workCenterId">${workCenters.map(w =>
480:               `<option value="${w.id}" ${w.id === o.workCenterId ? 'selected' : ''}>${esc(w.code)}</option>`).join('')}</select></div>
481:           <div><label style="font-size:11px;color:var(--text-faint)">${t('setupMinutes')}</label><br>
482:             <input type="number" min="0" step="0.5" value="${o.setupMinutes ?? 0}" data-i="${i}" data-f="setupMinutes" style="width:78px"></div>
483:           <div><label style="font-size:11px;color:var(--text-faint)">${t('runMinutes')}</label><br>
484:             <input type="number" min="0" step="0.1" value="${o.runMinutesPerUnit ?? 0}" data-i="${i}" data-f="runMinutesPerUnit" style="width:78px"></div>
485:           <div><label style="font-size:11px;color:var(--text-faint)">${t('queueMinutes')}</label><br>
486:             <input type="number" min="0" step="1" value="${o.queueMinutes ?? 0}" data-i="${i}" data-f="queueMinutes" style="width:78px"></div>
487:           <div><label style="font-size:11px;color:var(--text-faint)">${t('bomScrapPct')}</label><br>
488:             <input type="number" min="0" max="100" step="0.1" value="${o.scrapPct ?? 0}" data-i="${i}" data-f="scrapPct" style="width:70px"></div>
489:           <button class="rm" data-rm="${i}">${UI.icon(UI.ICONS.x)}</button>
490:         </div>`).join('');
491:       host.querySelectorAll('input,select').forEach(inp => inp.oninput = () => {
492:         const f = inp.dataset.f;
493:         rows[+inp.dataset.i][f] = (f === 'operationName') ? inp.value : Number(inp.value);
494:       });
495:       host.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { rows.splice(+b.dataset.rm, 1); draw(); });
496:     };
497:     draw();
498:
499:     document.getElementById('rtItem').onchange = e => { routingItemIdRef.current = e.target.value; reload(); };
500:     document.getElementById('rtAdd')?.addEventListener('click', () => {
501:       const nextNo = rows.length ? Math.max(...rows.map(r => r.operationNo)) + 10 : 10;
502:       rows.push({ operationNo: nextNo, operationName: '', workCenterId: workCenters[0]?.id,
503:                   setupMinutes: 0, runMinutesPerUnit: 0, queueMinutes: 0, scrapPct: 0 });
504:       draw();
505:     });
506:     document.getElementById('rtSave')?.addEventListener('click', async () => {
507:       try {
508:         await Api.saveRouting(routingItemId, rows.map(r => ({
509:           operationNo: r.operationNo, operationName: r.operationName, workCenterId: r.workCenterId,
510:           setupMinutes: r.setupMinutes, runMinutesPerUnit: r.runMinutesPerUnit,
511:           queueMinutes: r.queueMinutes, scrapPct: r.scrapPct
512:         })));
513:         UI.ok(t('saved')); reload();
514:       } catch (e) { UI.err(e); }
515:     });
516:   }
517:
```

## server/routes/planning.js:215-248 SHA256 a161d83a73f247411a848c0005ee305d44d100468965214b82fd2164d2e59776
```text
215: });
216:
217: /** Rotanın tamamı tek seferde yazılır: yarım rota planlamayı bozar. */
218: router.put('/routings/:itemId', MANAGER, validate(z.object({
219:   operations: z.array(z.object({
220:     operationNo: z.coerce.number().int().min(1),
221:     operationName: z.string().min(1).max(200),
222:     workCenterId: z.coerce.number().int(),
223:     setupMinutes: z.coerce.number().min(0).default(0),
224:     runMinutesPerUnit: z.coerce.number().min(0).default(0),
225:     queueMinutes: z.coerce.number().min(0).default(0),
226:     scrapPct: z.coerce.number().min(0).max(100).default(0),
227:     notes: z.string().max(5000).optional()
228:   }))
229: })), (req, res) => {
230:   const itemId = req.params.itemId;
231:   const item = db.prepare('SELECT name FROM items WHERE id = ?').get(itemId);
232:   if (!item) throw new AppError('Ürün bulunamadı / Item not found', 404);
233:
234:   const nos = req.valid.operations.map(o => o.operationNo);
235:   if (new Set(nos).size !== nos.length) throw new AppError('Operasyon numaraları tekrarlanamaz / Duplicate operation numbers', 400);
236:   req.valid.operations.forEach(o => activeWorkCenter(o.workCenterId));
237:
238:   db.tx(() => {
239:     db.prepare('DELETE FROM routings WHERE item_id = ?').run(itemId);
240:     const ins = db.prepare(`INSERT INTO routings (item_id,operation_no,operation_name,work_center_id,
241:       setup_minutes,run_minutes_per_unit,queue_minutes,scrap_pct,notes) VALUES (?,?,?,?,?,?,?,?,?)`);
242:     req.valid.operations.forEach(o => ins.run(itemId, o.operationNo, o.operationName, o.workCenterId,
243:       o.setupMinutes, o.runMinutesPerUnit, o.queueMinutes, o.scrapPct, o.notes || null));
244:   });
245:   logAudit(req, 'auditRoutingUpdate', { entityType: 'routing', entityId: itemId,
246:     newValue: { operations: req.valid.operations.length }, detail: item.name });
247:   res.json({ ok: true, operations: req.valid.operations.length });
248: });
```

## server/routes/sales.js:159-170 SHA256 5ca56d97bd6511100ed70f44cdb8ced01fc8e719eee9907e508c71753a02c645
```text
159:   });
160:   res.status(201).json(serialized);
161: });
162:
163: router.post('/orders/:id/cancel', ADMIN, (req, res) => {
164:   const so = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(req.params.id);
165:   if (!so) throw new AppError('Sipariş bulunamadı / Order not found', 404);
166:   if (so.status === 'shipped' || so.status === 'invoiced') throw new AppError('Sevk edilmiş sipariş iptal edilemez / Cannot cancel a shipped order');
167:   db.prepare("UPDATE sales_orders SET status = 'cancelled' WHERE id = ?").run(so.id);
168:   logAudit(req, 'auditSalesOrderCancel', { entityType: 'sales_order', entityId: so.id, detail: so.so_no });
169:   res.json({ ok: true });
170: });
```

## server/services/invoice-allocation.js:1-27 SHA256 1b8d16736d0361f4e8088f7599fa021694d998d92f6e64fe26f12bde334cbd94
```text
1: const db = require('../db');
2: const { AppError } = require('../lib/core');
3:
4: // Called inside the invoice's IMMEDIATE transaction: allocation and document commit together.
5: function prepareInvoiceAllocation(b, defaultVat) {
6:   if (!b.soId && !b.shipmentId) return { lines: b.lines, allocations: [], soId: null };
7:   const shipment = b.shipmentId ? db.prepare('SELECT * FROM shipments WHERE id=?').get(b.shipmentId) : null;
8:   if (b.shipmentId && !shipment) throw new AppError('Sevkiyat bulunamadı / Shipment not found', 404);
9:   const soId = b.soId || shipment?.so_id || null;
10:   const so = soId ? db.prepare('SELECT * FROM sales_orders WHERE id=?').get(soId) : null;
11:   if (soId && !so) throw new AppError('Sipariş bulunamadı / Order not found', 404);
12:   if ((so && (so.customer_id !== b.customerId || so.currency !== b.currency)) ||
13:       (shipment && (shipment.customer_id !== b.customerId || (b.soId && shipment.so_id !== b.soId)))) {
14:     throw new AppError('Fatura müşteri, sipariş veya para birimi eşleşmiyor / Invoice source mismatch', 422);
15:   }
16:   if (so?.status === 'cancelled' || shipment?.status === 'İptal Edildi') {
17:     throw new AppError('İptal edilmiş belge faturalanamaz / Cancelled source cannot be invoiced', 409);
18:   }
19:   if (b.invoiceType === 'iade') return { lines: b.lines, allocations: [], soId };
20:   const legacy = db.prepare(`SELECT ci.id FROM customer_invoices ci
21:     LEFT JOIN shipments sh ON sh.id=ci.shipment_id
22:     WHERE ci.status!='cancelled' AND ci.invoice_type!='iade'
23:     AND ((? IS NOT NULL AND (ci.so_id=? OR sh.so_id=?)) OR ci.shipment_id=?)
24:     AND NOT EXISTS(SELECT 1 FROM invoice_shipment_allocations a WHERE a.invoice_id=ci.id) LIMIT 1`)
25:     .get(soId, soId, soId, b.shipmentId || null);
26:   if (legacy) throw new AppError('Eski faturanın sevk miktarı mutabakatı gerekli / Historical invoice allocation needs reconciliation', 409);
27:   const pool = db.prepare(`SELECT si.*, sol.price, i.unit, i.code, i.vat_rate,
```

## server/services/stock.js:100-125 SHA256 3994835c25dd47bf8f606e639d2e85ca0813e247788d531c5d6043308c82c4ce
```text
100:   return lotId;
101: }
102:
103: /**
104:  * Pick lots to satisfy a quantity, FEFO (First Expired First Out), falling back to
105:  * FIFO by receipt date for lots with no expiry. Only 'available' lots are eligible —
106:  * quarantined or blocked stock can never be silently consumed.
107:  */
108: function pickLotsFEFO(itemId, qty, warehouseId = null) {
109:   const params = [itemId];
110:   let where = `item_id = ? AND status = 'available' AND qty > 0`;
111:   if (warehouseId) { where += ' AND warehouse_id = ?'; params.push(warehouseId); }
112:   const lots = db.prepare(
113:     `SELECT * FROM stock_lots WHERE ${where}
114:      ORDER BY (expiry_date IS NULL), expiry_date ASC, received_at ASC`
115:   ).all(...params);
116:
117:   const picks = [];
118:   let remaining = qty;
119:   for (const lot of lots) {
120:     if (remaining <= 1e-9) break;
121:     const take = Math.min(lot.qty, remaining);
122:     picks.push({ lot, qty: take });
123:     remaining -= take;
124:   }
125:   return { picks, shortfall: remaining > 1e-9 ? remaining : 0 };
```

## server/services/stock.js:164-204 SHA256 3994835c25dd47bf8f606e639d2e85ca0813e247788d531c5d6043308c82c4ce
```text
164:
165: /** Move a lot (or part of it) between quality statuses: available <-> quarantine/blocked/rejected. */
166: /** @param {{lotId: string, toStatus: string, qty?: number, note?: string, userId?: string|number, refType?: string, refId?: string|number}} input */
167: function changeLotStatus({ lotId, toStatus, qty, note, userId, refType, refId }) {
168:   const lot = db.prepare('SELECT * FROM stock_lots WHERE id = ?').get(lotId);
169:   if (!lot) throw new AppError('Parti bulunamadı / Lot not found', 404);
170:   if (!['available', 'quarantine', 'blocked', 'rejected'].includes(toStatus)) {
171:     throw new AppError('Geçersiz durum / Invalid status');
172:   }
173:   const moveQty = qty != null ? Number(qty) : lot.qty;
174:   if (moveQty <= 0 || moveQty > lot.qty + 1e-9) throw new AppError('Geçersiz miktar / Invalid quantity');
175:
176:   const item = db.prepare('SELECT name FROM items WHERE id = ?').get(lot.item_id);
177:
178:   let targetLotId = lotId;
179:   if (moveQty < lot.qty - 1e-9) {
180:     // Partial status change: split the lot so each part keeps its own status and history
181:     db.prepare('UPDATE stock_lots SET qty = qty - ? WHERE id = ?').run(moveQty, lot.id);
182:     targetLotId = uuid();
183:     db.prepare(`INSERT INTO stock_lots
184:       (id,item_id,warehouse_id,lot_no,serial_no,qty,status,expiry_date,unit_cost,received_at,source_type,source_id,supplier_id,notes)
185:       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
186:       targetLotId, lot.item_id, lot.warehouse_id, lot.lot_no, lot.serial_no, moveQty, toStatus,
187:       lot.expiry_date, lot.unit_cost, lot.received_at, lot.source_type, lot.source_id, lot.supplier_id, lot.notes
188:     );
189:     db.prepare('UPDATE stock_lots SET parent_lot_id=?,parent_qty=? WHERE id=?').run(lot.id, moveQty, targetLotId);
190:   } else {
191:     db.prepare('UPDATE stock_lots SET status = ? WHERE id = ?').run(toStatus, lot.id);
192:   }
193:
194:   recordMovement({
195:     itemId: lot.item_id, itemName: item ? item.name : null, lotId: targetLotId, lotNo: lot.lot_no,
196:     warehouseId: lot.warehouse_id, type: 'status_change', qty: moveQty,
197:     unitCost: lot.unit_cost, fromStatus: lot.status, toStatus, note, refType, refId, userId
198:   });
199:
200:   recalcItemQty(lot.item_id);
201:   return targetLotId;
202: }
203:
204: /** Move quantity of a lot to another warehouse (keeps lot identity and cost). */
```

## server/services/stock.js:282-305 SHA256 3994835c25dd47bf8f606e639d2e85ca0813e247788d531c5d6043308c82c4ce
```text
282:   }
283:   return picks.map(p => ({ lotId: p.lot.id, lotNo: p.lot.lot_no, qty: p.qty, unitCost: p.lot.unit_cost }));
284: }
285:
286: /** Consume lots already picked by allocate() or chosen explicitly by the caller. */
287: function consume(picks, { itemId, itemName, note, refType, refId, userId, warehouseId = null, allowedStatuses = ['available'] }) {
288:   return db.txImmediate(() => {
289:   for (const p of picks) {
290:     const lot = db.prepare('SELECT * FROM stock_lots WHERE id = ?').get(p.lotId);
291:     if (!lot) throw new AppError('Parti bulunamadı / Lot not found', 404);
292:     if (lot.item_id !== itemId) throw new AppError('Ürün ile lot eşleşmiyor / Lot does not belong to item', 422);
293:     if (warehouseId != null && Number(warehouseId) !== lot.warehouse_id) throw new AppError('Lot seçilen depoda değil / Lot warehouse mismatch', 422);
294:     if (!allowedStatuses.includes(lot.status)) throw new AppError('Lot bu işlem için uygun değil / Lot status is not eligible', 409);
295:     if (!Number.isFinite(p.qty) || p.qty <= 0 || p.qty > lot.qty + 1e-9) throw new AppError('Geçersiz veya yetersiz miktar / Invalid or insufficient quantity', 422);
296:     const newQty = lot.qty - p.qty;
297:     db.prepare('UPDATE stock_lots SET qty = ?, status = CASE WHEN ? <= 0 THEN ? ELSE status END WHERE id = ?')
298:       .run(newQty, newQty, 'consumed', lot.id);
299:     recordMovement({
300:       itemId, itemName, lotId: lot.id, lotNo: lot.lot_no, warehouseId: lot.warehouse_id,
301:       type: 'out', qty: p.qty, unitCost: lot.unit_cost,
302:       fromStatus: lot.status, note, refType, refId, userId
303:     });
304:   }
305:   recalcItemQty(itemId);
```

## server/services/costing.js:88-108 SHA256 76f9190c81d93c94b4de4166d9943cbfacd7a934cc2f1d7cbd027331594061a3
```text
88:  * good units — which is what makes scrap show up as a real cost.
89:  */
90: function computeProductionCost(productionOrderId) {
91:   const po = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(productionOrderId);
92:   if (!po) throw new AppError('Üretim emri bulunamadı / Production order not found', 404);
93:
94:   const materialCost = db.prepare(
95:     'SELECT COALESCE(SUM(qty * unit_cost),0) v FROM production_consumption WHERE production_order_id = ?'
96:   ).get(productionOrderId).v;
97:
98:   const labor = Number(po.labor_cost || 0);
99:   const overhead = Number(po.overhead_cost || 0);
100:   const total = materialCost + labor + overhead;
101:   const goodQty = Number(po.produced_qty || po.qty || 0);
102:   const unitCost = goodQty > 0 ? total / goodQty : 0;
103:
104:   db.prepare('UPDATE production_orders SET material_cost = ?, total_cost = ?, unit_cost = ? WHERE id = ?')
105:     .run(materialCost, total, unitCost, productionOrderId);
106:
107:   return { materialCost, labor, overhead, total, unitCost, goodQty };
108: }
```

## server/lib/license.js:68-83 SHA256 caf21478be4659f5aeb0d27751fb1fa38ae873b9a86b7b5b75ae175c8daac58e
```text
68:
69:   const { expiresAt } = licenseFile.payload;
70:   if (expiresAt) {
71:     const expiryMs = new Date(expiresAt + 'T23:59:59').getTime();
72:     if (Number.isNaN(expiryMs)) return { valid: false, reason: `Geçersiz son kullanma tarihi / Invalid expiry date: ${expiresAt}` };
73:     const daysRemaining = Math.ceil((expiryMs - Date.now()) / 86400000);
74:     if (daysRemaining < 0) {
75:       return { valid: false, reason: `Lisans süresi doldu / License expired on ${expiresAt}`, expired: true, license: licenseFile.payload };
76:     }
77:     return { valid: true, license: licenseFile.payload, expired: false, daysRemaining };
78:   }
79:   return { valid: true, license: licenseFile.payload, expired: false, daysRemaining: null };
80: }
81:
82: /**
83:  * Sunucu açılışında çağrılır. `LICENSE_FILE` tanımlı değilse hiçbir şey
```

## frontend-react/CountsView.jsx:24-47 SHA256 1137733a8d5e03163e2f80238f7168d670b7a8a28003f139ddcce59e91944fb5
```text
24:
25:   const reload = useCallback(() => setReloadToken(x => x + 1), []);
26:
27:   useEffect(() => {
28:     let cancelled = false;
29:     (async () => {
30:       if (firstLoadRef.current) {
31:         firstLoadRef.current = false;
32:         try { warehousesRef.current = await Api.warehouses(); } catch { warehousesRef.current = []; }
33:       }
34:       if (cancelled) return;
35:       let res;
36:       try { res = await Api.counts({ page: pagesRef.current.counts || 1, pageSize: 25 }); } catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
37:       if (cancelled) return;
38:       setPhase({ status: 'ready', res, error: null });
39:     })();
40:     return () => { cancelled = true; };
41:   }, [reloadToken]);
42:
43:   useEffect(() => {
44:     if (phase.status !== 'ready') return;
45:     document.getElementById('cNew')?.addEventListener('click', () => newCount());
46:     document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCount(b.dataset.open));
47:   }, [phase]);
```

## frontend-react/SalesView.jsx:40-66 SHA256 6272490398320324620ef0ae39b49b860976a680b5854887459d613eb71de740
```text
40:     return () => { cancelled = true; };
41:   }, []);
42:
43:   useEffect(() => {
44:     if (!ready) return;
45:     const body = document.getElementById('salesBody');
46:     const actions = document.getElementById('salesActions');
47:     if (!body || !actions) return;
48:     const fns = { orders: renderOrders, shipments: renderShipments, customers: renderCustomers, invoices: renderInvoices, profit: renderProfit };
49:     (async () => {
50:       try { await fns[tab](body, actions); }
51:       catch (e) { UI.errorState(body, e, reload); }
52:     })();
53:   }, [ready, tab, reloadToken]);
54:
55:   /* ================= SALES ORDERS ================= */
56:   async function renderOrders(body, actions) {
57:     let res;
58:     try { res = await Api.salesOrders({ page: pagesRef.current.orders || 1, pageSize: 25 }); } catch (e) { UI.errorState(typeof body !== 'undefined' ? body : null, e, typeof reload === 'function' ? reload : null); return; }
59:     const rows = res.data || res;
60:     actions.innerHTML = can('write') ? `<button class="btn btn-primary btn-sm" id="soNew">${UI.icon(UI.ICONS.plus)}${t('newSO')}</button>` : '';
61:
62:     body.innerHTML = `<div class="card">${table([
63:       { key: 'soNo', label: t('soNo'), render: r => `<button class="link-btn" data-open="${esc(r.id)}">${esc(r.soNo)}</button>
64:           <div class="sub-line">${esc(r.customerName || '—')}</div>` },
65:       { key: 'date', label: t('date'), render: r => dt(r.date), cls: 'nowrap' },
66:       { key: 'promisedDate', label: t('promisedDate'), render: r => {
```

## frontend-react/SalesView.jsx:252-265 SHA256 6272490398320324620ef0ae39b49b860976a680b5854887459d613eb71de740
```text
252:           <button class="icon-btn" data-print="${esc(r.id)}" title="${t('print')}">${UI.icon(UI.ICONS.print)}</button>
253:           ${can('admin') && r.status === 'Hazırlanıyor' ? `<button class="icon-btn danger" data-del="${esc(r.id)}" title="Sevkiyatı iptal et">${UI.icon(UI.ICONS.trash)}</button>` : ''}
254:         </div>` }
255:     ], rows)}${res.totalPages ? pager(res, p => { pagesRef.current.shipments = p; reload(); }) : ''}</div>`;
256:
257:     document.getElementById('shNew')?.addEventListener('click', () => shipmentForm(null));
258:     body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openShipment(b.dataset.open));
259:     body.querySelectorAll('[data-adv]').forEach(b => b.onclick = async () => {
260:       try { await Api.advanceShipment(b.dataset.adv); UI.ok(t('saved')); reload(); } catch (e) { UI.err(e); }
261:     });
262:     body.querySelectorAll('[data-print]').forEach(b => b.onclick = async () => printPackingList(await Api.shipment(b.dataset.print)));
263:     body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => UI.confirmDialog(UI.getLang() === 'tr' ? 'Sevkiyat iptal edilip stok geri alınacak. Belge geçmişi korunacak. Devam edilsin mi?' : 'Cancel this shipment and restore stock while preserving its history?', async () => {
264:       try { await Api.deleteShipment(b.dataset.del); UI.ok(t('saved')); reload(); } catch (e) { UI.err(e); }
265:     }, { danger: true }));
```

## public/js/app.js:148-157 SHA256 3b740d115d37618a7c8ed2782c427fa038b8649d5a9df53365554879f0c68533
```text
148:   }
149:
150:   /* ---------- session ---------- */
151:   function showLogin() {
152:     closeMobileNav();
153:     document.getElementById('loginScreen').style.display = 'flex';
154:     document.getElementById('appShell').style.display = 'none';
155:   }
156:
157:   async function showApp() {
```

## public/js/app.js:425-435 SHA256 3b740d115d37618a7c8ed2782c427fa038b8649d5a9df53365554879f0c68533
```text
425:         openNotifications(); refreshBadges();
426:       } catch (e) { UI.err(e); }
427:     };
428:
429:     // A revoked or expired token anywhere in the app drops straight back to login
430:     window.addEventListener('session-expired', () => {
431:       showLogin();
432:       UI.toast(UI.getLang() === 'tr' ? 'Oturum sona erdi, tekrar giriş yapın.' : 'Session ended — please sign in again.', 'err');
433:     });
434:
435:     if (Api.getToken() && Api.getUser()) {
```

## frontend-react/QualityView.jsx:114-124 SHA256 d996db86a18e6c927ac5f4dd872f0ed6be69e95aaeb24408b8d93aaf23fe583f
```text
114:                <button class="btn btn-primary" id="inGo">${t('save')}</button>`,
115:       onOpen: (box) => {
116:         const loadLots = async () => {
117:           const sel = box.querySelector('#inLot');
118:           sel.innerHTML = `<option value="">${t('none')}</option>`;
119:           try {
120:             const r = await Api.lots({ itemId: val('inItem'), pageSize: 100 });
121:             (r.data || []).forEach(l => {
122:               const o = document.createElement('option');
123:               o.value = l.id;
124:               o.textContent = `${l.lotNo || '—'} · ${num(l.qty)} · ${l.status}`;
```
