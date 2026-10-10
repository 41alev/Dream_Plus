# Fix review context
Baseline f5041ae; uncommitted application corrections. Single company per isolated installation. Prior nine bugs reproduced independently, original evidence retained. Current targeted service/API tests pass: quality release/partial/removal, expired FEFO/explicit/rollback + today/null/disposal, full-scrap zero output, partial shipment cancellation and invoice, routing conflict/explicit clear, signed expiry boundaries, real dataset >300 items/>100 lots searchable. Initial browser11/11 pass; final browser suites and server42-suite run underway. Source changes below. No real customer DB used.
Decisions: expired consumption bypass only NCR scrap/supplier return; no global deletion or real-data repair. Expected routing revision and shipment status are optional for legacy contract compatibility; current UI sends them. Empty routing clearing now requires explicit clear:true. Cost incoming status uses weighted inbound movement; outgoing status rebuilds remaining available cost. stock exported mutations rely on caller transaction by existing contract. No schema or licence tier changes.

```diff
diff --git a/frontend-react/CountsView.jsx b/frontend-react/CountsView.jsx
index 5676919..e6c06e5 100644
--- a/frontend-react/CountsView.jsx
+++ b/frontend-react/CountsView.jsx
@@ -17,6 +17,7 @@ export default function CountsView() {

   const [reloadToken, setReloadToken] = useState(0);
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);
   const warehousesRef = useRef([]);
   const firstLoadRef = useRef(true);
   // T08: each list keeps its own page; the pager used to always reload page 1.
@@ -33,7 +34,7 @@ export default function CountsView() {
       }
       if (cancelled) return;
       let res;
-      try { res = await Api.counts({ page: pagesRef.current.counts || 1, pageSize: 25 }); } catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      try { res = await Api.counts({ page: pagesRef.current.counts || 1, pageSize: 25 }); } catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
       setPhase({ status: 'ready', res, error: null });
     })();
@@ -43,7 +44,7 @@ export default function CountsView() {
   useEffect(() => {
     if (phase.status !== 'ready') return;
     document.getElementById('cNew')?.addEventListener('click', () => newCount());
-    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCount(b.dataset.open));
+    hostRef.current.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCount(b.dataset.open));
   }, [phase]);

   const statusBadge = (s) => {
@@ -162,8 +163,14 @@ export default function CountsView() {
     return `<span style="color:${d < 0 ? 'var(--danger)' : 'var(--accent)'}">${d > 0 ? '+' : ''}${num(d)}</span>`;
   };

+  if (phase.status === 'error') {
+    return <div ref={hostRef} role="alert" className="empty">{phase.error.message}
+      <button className="btn btn-primary" onClick={reload}>{t('retry')}</button>
+    </div>;
+  }
+
   if (phase.status === 'loading') {
-    return <div dangerouslySetInnerHTML={{ __html: loading() }} />;
+    return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: loading() }} />;
   }

   const { res } = phase;
@@ -187,5 +194,5 @@ export default function CountsView() {
       ${pager(res, p => { pagesRef.current.counts = p; reload(); })}
     </div>`;

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/ItemsView.jsx b/frontend-react/ItemsView.jsx
index 102a55f..f75f9ec 100644
--- a/frontend-react/ItemsView.jsx
+++ b/frontend-react/ItemsView.jsx
@@ -31,6 +31,7 @@ export default function ItemsView() {
   const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, ...(App.takeNavigationIntent('items')?.filters || {}) }));
   const [reloadToken, setReloadToken] = useState(0);
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);

   const warehousesRef = useRef([]);
   const suppliersRef = useRef([]);
@@ -63,7 +64,7 @@ export default function ItemsView() {
       if (cancelled) return;
       let res;
       try { res = await Api.items({ ...filters, pageSize: 25 }); }
-      catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
       allItemsRef.current = res.data;
       setPhase({ status: 'ready', res, error: null });
@@ -89,14 +90,14 @@ export default function ItemsView() {
     document.getElementById('itScan').onclick = () => scanDialog();
     document.getElementById('itNew')?.addEventListener('click', () => itemForm(null));

-    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCard(b.dataset.open));
-    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => itemForm(await Api.item(b.dataset.edit)));
-    document.querySelectorAll('[data-in]').forEach(b => b.onclick = () => stockInDialog(res.data.find(x => x.id === b.dataset.in)));
-    document.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCard(b.dataset.open));
+    hostRef.current.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => itemForm(await Api.item(b.dataset.edit)));
+    hostRef.current.querySelectorAll('[data-in]').forEach(b => b.onclick = () => stockInDialog(res.data.find(x => x.id === b.dataset.in)));
+    hostRef.current.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
       const it = res.data.find(x => x.id === b.dataset.label);
       openLabelPrintDialog('item', it.id, it.name);
     });
-    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
       const it = res.data.find(x => x.id === b.dataset.del);
       UI.confirmDialog(`"${it.name}" — ${t('confirmDelete')}`, async () => {
         try { await Api.deleteItem(it.id); UI.ok(t('deleted')); reload(); } catch (e) { UI.err(e); }
@@ -432,8 +433,14 @@ export default function ItemsView() {
     return m.type;
   };

+  if (phase.status === 'error') {
+    return <div ref={hostRef} role="alert" className="empty">{phase.error.message}
+      <button className="btn btn-primary" onClick={reload}>{t('retry')}</button>
+    </div>;
+  }
+
   if (phase.status === 'loading') {
-    return <div dangerouslySetInnerHTML={{ __html: loading() }} />;
+    return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: loading() }} />;
   }

   const { res } = phase;
@@ -480,5 +487,5 @@ export default function ItemsView() {
       ${pager(res, p => setFilters(f => ({ ...f, page: p })))}
     </div>`;

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/LotsView.jsx b/frontend-react/LotsView.jsx
index 1d2481e..4fe0009 100644
--- a/frontend-react/LotsView.jsx
+++ b/frontend-react/LotsView.jsx
@@ -138,6 +138,7 @@ export default function LotsView() {

   const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, ...(App.takeNavigationIntent('lots')?.filters || {}) }));
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);
   const warehousesRef = useRef([]);
   const firstLoadRef = useRef(true);

@@ -150,7 +151,7 @@ export default function LotsView() {
       }
       if (cancelled) return;
       let res;
-      try { res = await Api.lots({ ...filters, pageSize: 25 }); } catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      try { res = await Api.lots({ ...filters, pageSize: 25 }); } catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
       setPhase({ status: 'ready', res, error: null });
     })();
@@ -169,10 +170,10 @@ export default function LotsView() {
       [t('itemName'), t('lotNo'), t('warehouse'), t('qty'), t('unit'), t('status'), t('expiryDate'), t('unitCost')],
       res.data.map(r => [r.itemName, r.lotNo, r.warehouse, r.qty, r.unit, r.status, r.expiryDate, r.unitCost]));

-    document.querySelectorAll('[data-trace]').forEach(b => b.onclick = () => traceDialog(b.dataset.trace));
-    document.querySelectorAll('[data-status]').forEach(b => b.onclick = () => statusDialog(res.data.find(x => x.id === b.dataset.status)));
-    document.querySelectorAll('[data-transfer]').forEach(b => b.onclick = () => transferDialog(res.data.find(x => x.id === b.dataset.transfer)));
-    document.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-trace]').forEach(b => b.onclick = () => traceDialog(b.dataset.trace));
+    hostRef.current.querySelectorAll('[data-status]').forEach(b => b.onclick = () => statusDialog(res.data.find(x => x.id === b.dataset.status)));
+    hostRef.current.querySelectorAll('[data-transfer]').forEach(b => b.onclick = () => transferDialog(res.data.find(x => x.id === b.dataset.transfer)));
+    hostRef.current.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
       const lot = res.data.find(x => x.id === b.dataset.label);
       openLabelPrintDialog('lot', lot.id, `${lot.itemName} · ${lot.lotNo || '—'}`);
     });
@@ -224,8 +225,14 @@ export default function LotsView() {
     });
   }

+  if (phase.status === 'error') {
+    return <div ref={hostRef} role="alert" className="empty">{phase.error.message}
+      <button className="btn btn-primary" onClick={reload}>{t('retry')}</button>
+    </div>;
+  }
+
   if (phase.status === 'loading') {
-    return <div dangerouslySetInnerHTML={{ __html: loading() }} />;
+    return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: loading() }} />;
   }

   const { res } = phase;
@@ -276,5 +283,5 @@ export default function LotsView() {
       ${pager(res, p => setFilters(f => ({ ...f, page: p })))}
     </div>`;

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/PlanningView.jsx b/frontend-react/PlanningView.jsx
index b056161..7c369f6 100644
--- a/frontend-react/PlanningView.jsx
+++ b/frontend-react/PlanningView.jsx
@@ -447,14 +447,14 @@ export default function PlanningView() {
     const producible = items.filter(i => i.itemType === 'finished' || i.itemType === 'semi');
     if (!routingItemIdRef.current && producible.length) routingItemIdRef.current = producible[0].id;
     const routingItemId = routingItemIdRef.current;
-    const ops = routingItemId ? await Api.routings(routingItemId).catch(() => []) : [];
+    const ops = routingItemId ? await Api.routings(routingItemId) : [];

     body.innerHTML = `
       <div class="alert info">${UI.getLang() === 'tr'
         ? 'Reçete NE gerektiğini söyler, rota NASIL yapıldığını. Çizelgeleme rotasız çalışmaz.'
         : 'The BOM says what is needed; the routing says how it is made. Scheduling needs a routing.'}</div>
       <div class="filters">
-        ${select('rtItem', producible.map(i => ({ v: i.id, l: `${i.name} (${i.code || ''})` })), routingItemId)}
+        ${select('rtItem', producible.map(i => ({ v: i.id, l: `${i.name} (${i.code || ''})` })), routingItemId, { search: 'producibleItems' })}
       </div>
       <div class="card">
         <div class="card-head"><h3>${t('routing')}</h3>
@@ -497,6 +497,7 @@ export default function PlanningView() {
     draw();

     document.getElementById('rtItem').onchange = e => { routingItemIdRef.current = e.target.value; reload(); };
+    UI.enhanceSelects(body);
     document.getElementById('rtAdd')?.addEventListener('click', () => {
       const nextNo = rows.length ? Math.max(...rows.map(r => r.operationNo)) + 10 : 10;
       rows.push({ operationNo: nextNo, operationName: '', workCenterId: workCenters[0]?.id,
@@ -504,14 +505,19 @@ export default function PlanningView() {
       draw();
     });
     document.getElementById('rtSave')?.addEventListener('click', async () => {
+      const saveButton = document.getElementById('rtSave');
+      if (saveButton.disabled) return;
+      const clear = rows.length === 0;
+      if (clear && !window.confirm(UI.getLang() === 'tr' ? 'Bu ürünün rotası silinecek. Devam edilsin mi?' : 'Clear this item routing?')) return;
+      saveButton.disabled = true;
       try {
         await Api.saveRouting(routingItemId, rows.map(r => ({
           operationNo: r.operationNo, operationName: r.operationName, workCenterId: r.workCenterId,
           setupMinutes: r.setupMinutes, runMinutesPerUnit: r.runMinutesPerUnit,
           queueMinutes: r.queueMinutes, scrapPct: r.scrapPct
-        })));
+        })), ops.revision, clear);
         UI.ok(t('saved')); reload();
-      } catch (e) { UI.err(e); }
+      } catch (e) { UI.err(e); saveButton.disabled = false; }
     });
   }

diff --git a/frontend-react/ProductionView.jsx b/frontend-react/ProductionView.jsx
index a4ac075..7ebdf94 100644
--- a/frontend-react/ProductionView.jsx
+++ b/frontend-react/ProductionView.jsx
@@ -13,6 +13,7 @@ export default function ProductionView() {

   const [filters, setFilters] = useState(DEFAULT_FILTERS);
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);
   const itemsRef = useRef([]);
   const warehousesRef = useRef([]);
   const settingsRef = useRef({});
@@ -34,7 +35,7 @@ export default function ProductionView() {
       }
       if (cancelled) return;
       let res;
-      try { res = await Api.production({ ...filters, pageSize: 25 }); } catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      try { res = await Api.production({ ...filters, pageSize: 25 }); } catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
       setPhase({ status: 'ready', res, error: null });
     })();
@@ -45,9 +46,9 @@ export default function ProductionView() {
     if (phase.status !== 'ready') return;
     document.getElementById('pStatus').onchange = e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }));
     document.getElementById('pNew')?.addEventListener('click', () => newProd());
-    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProd(b.dataset.open));
-    document.querySelectorAll('[data-complete]').forEach(b => b.onclick = () => completeDialog(b.dataset.complete));
-    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProd(b.dataset.open));
+    hostRef.current.querySelectorAll('[data-complete]').forEach(b => b.onclick = () => completeDialog(b.dataset.complete));
+    hostRef.current.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
       UI.confirmDialog(t('confirmDelete'), async () => {
         try { await Api.deleteProduction(b.dataset.del); UI.ok(t('deleted')); reload(); } catch (e) { UI.err(e); }
       }, { danger: true, confirmLabel: t('del') });
@@ -207,8 +208,14 @@ export default function ProductionView() {
     });
   }

+  if (phase.status === 'error') {
+    return <div ref={hostRef} role="alert" className="empty">{phase.error.message}
+      <button className="btn btn-primary" onClick={reload}>{t('retry')}</button>
+    </div>;
+  }
+
   if (phase.status === 'loading') {
-    return <div dangerouslySetInnerHTML={{ __html: loading() }} />;
+    return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: loading() }} />;
   }

   const { res } = phase;
@@ -250,5 +257,5 @@ export default function ProductionView() {
       ${res.totalPages ? pager(res, p => setFilters(f => ({ ...f, page: p }))) : ''}
     </div>`;

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/QualityView.jsx b/frontend-react/QualityView.jsx
index 573d1ee..c8ae298 100644
--- a/frontend-react/QualityView.jsx
+++ b/frontend-react/QualityView.jsx
@@ -7,6 +7,32 @@
  */
 import { useEffect, useState, useRef } from 'react';

+function bindLotSelector(box, itemId, lotId, saveId) {
+  const item = box.querySelector('#' + itemId);
+  const sel = box.querySelector('#' + lotId);
+  const save = box.querySelector('#' + saveId);
+  let version = 0;
+  const load = async () => {
+    const mine = ++version, selectedItem = item.value;
+    sel.dataset.itemId = selectedItem;
+    sel.innerHTML = `<option value="">${UI.t('none')}</option>`;
+    sel.disabled = true;
+    save.disabled = true;
+    try {
+      const result = selectedItem ? await Api.lots({ itemId: selectedItem, pageSize: 100 }) : { data: [] };
+      if (mine !== version || !sel.isConnected) return;
+      result.data.forEach(lot => sel.add(new Option(`${lot.lotNo || '—'} · ${UI.num(lot.qty)} · ${lot.status}`, lot.id)));
+      sel.disabled = false;
+      save.disabled = false;
+    } catch (error) {
+      if (mine !== version || !sel.isConnected) return;
+      UI.err(error);
+    }
+  };
+  item.onchange = load;
+  load();
+}
+
 export default function QualityView() {
   const { t, esc, num, dt, ts, table, pager, loading, modal, closeModal,
           field, input, select, textarea, val, numVal, intVal, can } = UI;
@@ -102,7 +128,7 @@ export default function QualityView() {
             { v: 'incoming', l: t('inspIncoming') }, { v: 'in_process', l: t('inspInProcess') }, { v: 'final', l: t('inspFinal') }]))}
           ${field(t('itemName'), select('inItem', items.map(i => ({ v: i.id, l: i.name })), undefined, { search: 'items' }))}
         </div>
-        ${field(t('lotNo'), select('inLot', [{ v: '', l: t('none') }]), UI.getLang() === 'tr' ? 'Ürün seçildiğinde partiler yüklenir.' : 'Lots load once you pick an item.')}
+        ${field(t('lotNo'), select('inLot', [{ v: '', l: t('none') }], undefined, { search: 'lots' }), UI.getLang() === 'tr' ? 'Ürün seçildiğinde partiler yüklenir.' : 'Lots load once you pick an item.')}
         <div class="field-row three">
           ${field(t('sampleSize'), input('inSample', { type: 'number', min: 0, value: 5 }))}
           ${field(t('inspectedQty'), input('inQty', { type: 'number', min: 0, step: '0.0001', value: 0 }))}
@@ -113,21 +139,7 @@ export default function QualityView() {
       footer: `<button class="btn btn-ghost" data-close>${t('cancel')}</button>
                <button class="btn btn-primary" id="inGo">${t('save')}</button>`,
       onOpen: (box) => {
-        const loadLots = async () => {
-          const sel = box.querySelector('#inLot');
-          sel.innerHTML = `<option value="">${t('none')}</option>`;
-          try {
-            const r = await Api.lots({ itemId: val('inItem'), pageSize: 100 });
-            (r.data || []).forEach(l => {
-              const o = document.createElement('option');
-              o.value = l.id;
-              o.textContent = `${l.lotNo || '—'} · ${num(l.qty)} · ${l.status}`;
-              sel.appendChild(o);
-            });
-          } catch {}
-        };
-        box.querySelector('#inItem').onchange = loadLots;
-        loadLots();
+        bindLotSelector(box, 'inItem', 'inLot', 'inGo');

         box.querySelector('#inGo').onclick = async () => {
           try {
@@ -345,26 +357,13 @@ export default function QualityView() {
           ${field(t('itemName'), select('ncItem', [{ v: '', l: t('none') }, ...items.map(i => ({ v: i.id, l: i.name }))]))}
           ${field(t('qtyAffected'), input('ncQty', { type: 'number', min: 0, step: '0.0001', value: 0 }))}
         </div>
-        ${field(t('lotNo'), select('ncLot', [{ v: '', l: t('none') }]))}
+        ${field(t('lotNo'), select('ncLot', [{ v: '', l: t('none') }], undefined, { search: 'lots' }))}
         ${field(t('supplierName'), select('ncSup', [{ v: '', l: t('none') }, ...suppliers.map(s => ({ v: s.id, l: s.name }))]))}
         ${field(t('description'), textarea('ncDesc', { placeholder: UI.getLang() === 'tr' ? 'Uygunsuzluğun ne olduğunu açıkça yazın.' : 'Describe the non-conformance clearly.' }))}`,
       footer: `<button class="btn btn-ghost" data-close>${t('cancel')}</button>
                <button class="btn btn-primary" id="ncGo">${t('save')}</button>`,
       onOpen: (box) => {
-        const loadLots = async () => {
-          const sel = box.querySelector('#ncLot');
-          sel.innerHTML = `<option value="">${t('none')}</option>`;
-          if (!val('ncItem')) return;
-          try {
-            const r = await Api.lots({ itemId: val('ncItem'), pageSize: 100 });
-            (r.data || []).forEach(l => {
-              const o = document.createElement('option');
-              o.value = l.id; o.textContent = `${l.lotNo || '—'} · ${num(l.qty)} · ${l.status}`;
-              sel.appendChild(o);
-            });
-          } catch {}
-        };
-        box.querySelector('#ncItem').onchange = loadLots;
+        bindLotSelector(box, 'ncItem', 'ncLot', 'ncGo');

         box.querySelector('#ncGo').onclick = async () => {
           try {
diff --git a/frontend-react/SalesView.jsx b/frontend-react/SalesView.jsx
index 96f56a3..f179379 100644
--- a/frontend-react/SalesView.jsx
+++ b/frontend-react/SalesView.jsx
@@ -257,7 +257,10 @@ export default function SalesView() {
     document.getElementById('shNew')?.addEventListener('click', () => shipmentForm(null));
     body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openShipment(b.dataset.open));
     body.querySelectorAll('[data-adv]').forEach(b => b.onclick = async () => {
-      try { await Api.advanceShipment(b.dataset.adv); UI.ok(t('saved')); reload(); } catch (e) { UI.err(e); }
+      if (b.disabled) return;
+      b.disabled = true;
+      try { await Api.advanceShipment(b.dataset.adv, rows.find(r => r.id === b.dataset.adv).status); UI.ok(t('saved')); reload(); }
+      catch (e) { UI.err(e); b.disabled = false; }
     });
     body.querySelectorAll('[data-print]').forEach(b => b.onclick = async () => printPackingList(await Api.shipment(b.dataset.print)));
     body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => UI.confirmDialog(UI.getLang() === 'tr' ? 'Sevkiyat iptal edilip stok geri alınacak. Belge geçmişi korunacak. Devam edilsin mi?' : 'Cancel this shipment and restore stock while preserving its history?', async () => {
diff --git a/public/js/api.js b/public/js/api.js
index 524fc41..fa805d8 100644
--- a/public/js/api.js
+++ b/public/js/api.js
@@ -18,6 +18,7 @@ const Api = (() => {
     if (tok) headers.Authorization = 'Bearer ' + tok;
     const write = method !== 'GET';
     if (write) pendingWrites++;
+    try {
     let res;
     try {
       res = await fetch('/api' + path, {
@@ -29,8 +30,6 @@ const Api = (() => {
       err.network = true;
       err.cause = networkError;
       throw err;
-    } finally {
-      if (write) pendingWrites--;
     }
     if (res.status === 401) {
       clearSession();
@@ -46,7 +45,13 @@ const Api = (() => {
       err.payload = data;
       throw err;
     }
+    if (data && typeof data === 'object' && res.headers.get('ETag')) {
+      Object.defineProperty(data, 'revision', { value: res.headers.get('ETag') });
+    }
     return data;
+    } finally {
+      if (write) pendingWrites--;
+    }
   }

   const qs = (o = {}) => {
@@ -175,7 +180,7 @@ const Api = (() => {
     shipments: (p) => req('GET', '/sales/shipments' + qs(p)),
     shipment: (id) => req('GET', '/sales/shipments/' + id),
     createShipment: (d) => req('POST', '/sales/shipments', d),
-    advanceShipment: (id) => req('PATCH', `/sales/shipments/${id}/status`),
+    advanceShipment: (id, expectedStatus) => req('PATCH', `/sales/shipments/${id}/status`, { expectedStatus }),
     deleteShipment: (id) => req('DELETE', '/sales/shipments/' + id),
     customerInvoices: (p) => req('GET', '/sales/invoices' + qs(p)),
     customerInvoice: (id) => req('GET', '/sales/invoices/' + id),
@@ -278,7 +283,7 @@ const Api = (() => {
     createCalendarException: (d) => req('POST', '/planning/calendar-exceptions', d),
     deleteCalendarException: (id) => req('DELETE', '/planning/calendar-exceptions/' + id),
     routings: (itemId) => req('GET', '/planning/routings/' + itemId),
-    saveRouting: (itemId, operations) => req('PUT', '/planning/routings/' + itemId, { operations }),
+    saveRouting: (itemId, operations, expectedRevision, clear = false) => req('PUT', '/planning/routings/' + itemId, { operations, expectedRevision, clear }),
     capacity: (p) => req('GET', '/planning/capacity' + qs(p)),
     scheduleOrder: (orderId, d) => req('POST', '/planning/schedule/' + orderId, d || {}),
     operations: (p) => req('GET', '/planning/operations' + qs(p)),
diff --git a/public/js/app.js b/public/js/app.js
index 669e4c1..927cb13 100644
--- a/public/js/app.js
+++ b/public/js/app.js
@@ -150,6 +150,8 @@ const App = (() => {
   /* ---------- session ---------- */
   function showLogin() {
     closeMobileNav();
+    UI.closeModal();
+    document.getElementById('modalBox').replaceChildren();
     document.getElementById('loginScreen').style.display = 'flex';
     document.getElementById('appShell').style.display = 'none';
   }
diff --git a/public/js/ui.js b/public/js/ui.js
index 009cfef..e12384c 100644
--- a/public/js/ui.js
+++ b/public/js/ui.js
@@ -180,6 +180,15 @@ const UI = (() => {

   /* ---------- server-side searchable selects (T08) ---------- */
   const SEARCH_SOURCES = {
+    producibleItems: {
+      find: q => Promise.all(['finished', 'semi'].map(itemType => Api.items({ q, itemType, pageSize: 30 })))
+        .then(results => results.flatMap(r => r.data).map(i => ({ v: i.id, l: i.code ? `${i.name} (${i.code})` : i.name }))),
+      one: id => Api.item(id).then(i => i.code ? `${i.name} (${i.code})` : i.name)
+    },
+    lots: {
+      find: (q, sel) => Api.lots({ q, itemId: sel.dataset.itemId, pageSize: 30 })
+        .then(r => r.data.map(l => ({ v: l.id, l: `${l.lotNo || '—'} · ${num(l.qty)} · ${l.status}` })))
+    },
     items: {
       find: q => Api.items({ q, pageSize: 30 }).then(r => (r.data || r).map(i => ({ v: i.id, l: i.code ? `${i.name} (${i.code})` : i.name }))),
       one: id => Api.item(id).then(i => i.code ? `${i.name} (${i.code})` : i.name)
@@ -223,8 +232,9 @@ const UI = (() => {
       if (q.length < 2) return;
       const mine = ++version;
       try {
-        const found = await source.find(q);
-        if (mine !== version) return;
+        const context = sel.dataset.itemId;
+        const found = await source.find(q, sel);
+        if (mine !== version || context !== sel.dataset.itemId || !sel.isConnected) return;
         if (!found.length) return;
         // The first match becomes the choice; the previous choice stays in the
         // list (last) so the user can switch back without searching again.
@@ -241,7 +251,7 @@ const UI = (() => {
         }
       } catch (e) { if (mine === version) err(e); }
     }, 250);
-    box.addEventListener('input', run);
+    box.addEventListener('input', () => { version++; run(); });
   }
   /** Option for a selected id that is not in the preloaded list (resolved by enhanceSelect). */
   function missingOption(list, id) {
diff --git a/server/lib/license.js b/server/lib/license.js
index 39ff5fe..bd8c479 100644
--- a/server/lib/license.js
+++ b/server/lib/license.js
@@ -71,7 +71,7 @@ function verify(licenseFile) {
     const expiryMs = new Date(expiresAt + 'T23:59:59').getTime();
     if (Number.isNaN(expiryMs)) return { valid: false, reason: `Geçersiz son kullanma tarihi / Invalid expiry date: ${expiresAt}` };
     const daysRemaining = Math.ceil((expiryMs - Date.now()) / 86400000);
-    if (daysRemaining < 0) {
+    if (Date.now() > expiryMs) {
       return { valid: false, reason: `Lisans süresi doldu / License expired on ${expiresAt}`, expired: true, license: licenseFile.payload };
     }
     return { valid: true, license: licenseFile.payload, expired: false, daysRemaining };
diff --git a/server/routes/planning.js b/server/routes/planning.js
index c56d942..e0e844c 100644
--- a/server/routes/planning.js
+++ b/server/routes/planning.js
@@ -1,4 +1,5 @@
 const express = require('express');
+const { createHash } = require('node:crypto');
 const db = require('../db');
 const { requireAuth, requireRole } = require('../middleware/auth');
 const { validate, validatePartial, z, localDate, optionalDate } = require('../middleware/validate');
@@ -202,7 +203,13 @@ router.delete('/calendar-exceptions/:id', MANAGER, (req, res) => {

 /* ============================ ROTALAR ============================ */

+function routingRevision(itemId) {
+  const rows = db.prepare('SELECT * FROM routings WHERE item_id=? ORDER BY operation_no').all(itemId);
+  return '"' + createHash('sha256').update(JSON.stringify(rows)).digest('hex') + '"';
+}
+
 router.get('/routings/:itemId', (req, res) => {
+  res.set('ETag', routingRevision(req.params.itemId));
   const rows = db.prepare(`SELECT r.*, wc.name AS work_center_name, wc.code AS work_center_code
     FROM routings r JOIN work_centers wc ON wc.id = r.work_center_id
     WHERE r.item_id = ? ORDER BY r.operation_no`).all(req.params.itemId);
@@ -216,6 +223,8 @@ router.get('/routings/:itemId', (req, res) => {

 /** Rotanın tamamı tek seferde yazılır: yarım rota planlamayı bozar. */
 router.put('/routings/:itemId', MANAGER, validate(z.object({
+  expectedRevision: z.string().max(100).optional(),
+  clear: z.boolean().default(false),
   operations: z.array(z.object({
     operationNo: z.coerce.number().int().min(1),
     operationName: z.string().min(1).max(200),
@@ -235,7 +244,9 @@ router.put('/routings/:itemId', MANAGER, validate(z.object({
   if (new Set(nos).size !== nos.length) throw new AppError('Operasyon numaraları tekrarlanamaz / Duplicate operation numbers', 400);
   req.valid.operations.forEach(o => activeWorkCenter(o.workCenterId));

-  db.tx(() => {
+  db.txImmediate(() => {
+    if (req.valid.expectedRevision != null && req.valid.expectedRevision !== routingRevision(itemId)) throw new AppError('Rota değişmiş; yeniden yükleyin / Routing changed; reload before saving', 409);
+    if (!req.valid.operations.length && !req.valid.clear) throw new AppError('Rotayı silmek için açık onay gerekli / Explicit confirmation required to clear routing', 422);
     db.prepare('DELETE FROM routings WHERE item_id = ?').run(itemId);
     const ins = db.prepare(`INSERT INTO routings (item_id,operation_no,operation_name,work_center_id,
       setup_minutes,run_minutes_per_unit,queue_minutes,scrap_pct,notes) VALUES (?,?,?,?,?,?,?,?,?)`);
diff --git a/server/routes/purchasing.js b/server/routes/purchasing.js
index 984a4a9..c808dac 100644
--- a/server/routes/purchasing.js
+++ b/server/routes/purchasing.js
@@ -1248,6 +1248,7 @@ router.post('/returns', requirePermission('purchase.write'), validate(returnSche
       stock.consume([{ lotId: lot.id, qty: b.qty }], {
         itemId: lot.item_id, itemName, warehouseId: lot.warehouse_id,
         allowedStatuses: ['available', 'quarantine', 'blocked', 'rejected'],
+        allowExpired: true,
         refType: 'supplier_return', refId: retId, note: `Tedarikçi iadesi ${no}`, userId: req.user.id
       });

diff --git a/server/routes/quality.js b/server/routes/quality.js
index 6d48c52..51b7002 100644
--- a/server/routes/quality.js
+++ b/server/routes/quality.js
@@ -337,6 +337,7 @@ router.post('/ncrs/:id/disposition', requirePermission('quality.write'), validat
           stock.consume([{ lotId: lot.id, qty }], {
             itemId: ncr.item_id, itemName: ncr.item_name, warehouseId: lot.warehouse_id,
             allowedStatuses: ['available', 'quarantine', 'blocked', 'rejected'],
+            allowExpired: true,
             refType: 'ncr', refId: ncr.id, note: `${ncr.ncr_no} · hurdaya ayrıldı`, userId: req.user.id
           });
         } else if (b.disposition === 'rework' || b.disposition === 'return_to_supplier') {
diff --git a/server/routes/sales.js b/server/routes/sales.js
index c6343e1..615a22c 100644
--- a/server/routes/sales.js
+++ b/server/routes/sales.js
@@ -161,11 +161,14 @@ router.post('/orders', WRITE, validate(soSchema), (req, res) => {
 });

 router.post('/orders/:id/cancel', ADMIN, (req, res) => {
+  db.txImmediate(() => {
   const so = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(req.params.id);
   if (!so) throw new AppError('Sipariş bulunamadı / Order not found', 404);
-  if (so.status === 'shipped' || so.status === 'invoiced') throw new AppError('Sevk edilmiş sipariş iptal edilemez / Cannot cancel a shipped order');
+  const shipment = db.prepare("SELECT id FROM shipments WHERE so_id=? AND status!='İptal Edildi' AND cancelled_at IS NULL LIMIT 1").get(so.id);
+  if (shipment || ['partially_shipped', 'shipped', 'invoiced'].includes(so.status)) throw new AppError('Sevk edilmiş sipariş iptal edilemez / Cannot cancel a shipped order', 409);
   db.prepare("UPDATE sales_orders SET status = 'cancelled' WHERE id = ?").run(so.id);
   logAudit(req, 'auditSalesOrderCancel', { entityType: 'sales_order', entityId: so.id, detail: so.so_no });
+  });
   res.json({ ok: true });
 });

@@ -309,6 +312,7 @@ router.patch('/shipments/:id/status', WRITE, (req, res) => {
   const serialized = db.txImmediate(() => {
   const s = db.prepare('SELECT * FROM shipments WHERE id = ?').get(req.params.id);
   if (!s) throw new AppError('Sevkiyat bulunamadı / Shipment not found', 404);
+  if (req.body?.expectedStatus != null && req.body.expectedStatus !== s.status) throw new AppError('Sevkiyat durumu değişmiş; listeyi yenileyin / Shipment status changed; reload the list', 409);
   const order = ['Hazırlanıyor', 'Yolda', 'Teslim Edildi'];
   if (!order.includes(s.status)) throw new AppError('Sevkiyat durumu ilerletilemez / Shipment status cannot advance', 409);
   const next = order[Math.min(order.indexOf(s.status) + 1, order.length - 1)];
diff --git a/server/services/costing.js b/server/services/costing.js
index 7c6ee6f..91858ce 100644
--- a/server/services/costing.js
+++ b/server/services/costing.js
@@ -98,7 +98,7 @@ function computeProductionCost(productionOrderId) {
   const labor = Number(po.labor_cost || 0);
   const overhead = Number(po.overhead_cost || 0);
   const total = materialCost + labor + overhead;
-  const goodQty = Number(po.produced_qty || po.qty || 0);
+  const goodQty = Number(po.produced_qty ?? po.qty ?? 0);
   const unitCost = goodQty > 0 ? total / goodQty : 0;

   db.prepare('UPDATE production_orders SET material_cost = ?, total_cost = ?, unit_cost = ? WHERE id = ?')
diff --git a/server/services/stock.js b/server/services/stock.js
index addefaf..3caede8 100644
--- a/server/services/stock.js
+++ b/server/services/stock.js
@@ -106,8 +106,8 @@ function receiveLot({ itemId, warehouseId, qty, lotNo, serialNo, expiryDate, uni
  * quarantined or blocked stock can never be silently consumed.
  */
 function pickLotsFEFO(itemId, qty, warehouseId = null) {
-  const params = [itemId];
-  let where = `item_id = ? AND status = 'available' AND qty > 0`;
+  const params = [itemId, today()];
+  let where = `item_id = ? AND status = 'available' AND qty > 0 AND (expiry_date IS NULL OR expiry_date >= ?)`;
   if (warehouseId) { where += ' AND warehouse_id = ?'; params.push(warehouseId); }
   const lots = db.prepare(
     `SELECT * FROM stock_lots WHERE ${where}
@@ -171,7 +171,8 @@ function changeLotStatus({ lotId, toStatus, qty, note, userId, refType, refId })
     throw new AppError('Geçersiz durum / Invalid status');
   }
   const moveQty = qty != null ? Number(qty) : lot.qty;
-  if (moveQty <= 0 || moveQty > lot.qty + 1e-9) throw new AppError('Geçersiz miktar / Invalid quantity');
+  if (!Number.isFinite(moveQty) || moveQty <= 0 || moveQty > lot.qty + 1e-9) throw new AppError('Geçersiz miktar / Invalid quantity');
+  if (toStatus === lot.status) return lotId;

   const item = db.prepare('SELECT name FROM items WHERE id = ?').get(lot.item_id);

@@ -198,6 +199,11 @@ function changeLotStatus({ lotId, toStatus, qty, note, userId, refType, refId })
   });

   recalcItemQty(lot.item_id);
+  if (toStatus === 'available' && lot.status !== 'available') {
+    updateAverageCost(lot.item_id, moveQty, lot.unit_cost);
+  } else if (lot.status === 'available' && toStatus !== 'available') {
+    recalcAverageCost(lot.item_id);
+  }
   return targetLotId;
 }

@@ -284,7 +290,9 @@ function allocate(itemId, qty, warehouseId = null, strategy = 'FEFO') {
 }

 /** Consume lots already picked by allocate() or chosen explicitly by the caller. */
-function consume(picks, { itemId, itemName, note, refType, refId, userId, warehouseId = null, allowedStatuses = ['available'] }) {
+/** @param {{lotId: string, qty: number}[]} picks
+ * @param {{itemId: string|number, itemName?: string, note?: string, refType?: string, refId?: string|number, userId?: string|number, warehouseId?: string|number, allowedStatuses?: string[], allowExpired?: boolean}} options */
+function consume(picks, { itemId, itemName, note, refType, refId, userId, warehouseId = null, allowedStatuses = ['available'], allowExpired = false }) {
   return db.txImmediate(() => {
   for (const p of picks) {
     const lot = db.prepare('SELECT * FROM stock_lots WHERE id = ?').get(p.lotId);
@@ -292,6 +300,7 @@ function consume(picks, { itemId, itemName, note, refType, refId, userId, wareho
     if (lot.item_id !== itemId) throw new AppError('Ürün ile lot eşleşmiyor / Lot does not belong to item', 422);
     if (warehouseId != null && Number(warehouseId) !== lot.warehouse_id) throw new AppError('Lot seçilen depoda değil / Lot warehouse mismatch', 422);
     if (!allowedStatuses.includes(lot.status)) throw new AppError('Lot bu işlem için uygun değil / Lot status is not eligible', 409);
+    if (!allowExpired && lot.expiry_date && lot.expiry_date < today()) throw new AppError('Partinin son kullanma tarihi geçmiş / Lot has expired', 409);
     if (!Number.isFinite(p.qty) || p.qty <= 0 || p.qty > lot.qty + 1e-9) throw new AppError('Geçersiz veya yetersiz miktar / Invalid or insufficient quantity', 422);
     const newQty = lot.qty - p.qty;
     db.prepare('UPDATE stock_lots SET qty = ?, status = CASE WHEN ? <= 0 THEN ? ELSE status END WHERE id = ?')

```
