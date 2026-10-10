# Corrected source review - ui
Baseline f5041ae. Real DB isolated. Prior review was invalid because filter skipped source. This context removes authentication assignments with [REDACTED]; these are not changed security behavior. No live credentials. Expected status/revision optional for legacy; current UI sends them. Empty route requires explicit clear. Available quantity now excludes expired lots; disposal and supplier return explicitly permit expired consumption. No schema migration. Existing42 suites and browser58 each passed before last small guards; final reruns underway.
```diff
diff --git a/frontend-react/CountsView.jsx b/frontend-react/CountsView.jsx
index 5676919..e6fc980 100644
--- a/frontend-react/CountsView.jsx
+++ b/frontend-react/CountsView.jsx
@@ -19,2 +19,3 @@ export default function CountsView() {
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);
   const warehousesRef = useRef([]);
@@ -30,4 +31,9 @@ export default function CountsView() {
       if (firstLoadRef.current) {
-        firstLoadRef.current = false;
-        try { warehousesRef.current = await Api.warehouses(); } catch { warehousesRef.current = []; }
+        try {
+          warehousesRef.current = await Api.warehouses();
+          firstLoadRef.current = false;
+        } catch (error) {
+          if (!cancelled) setPhase({ status: 'error', res: null, error });
+          return;
+        }
       }
@@ -35,3 +41,3 @@ export default function CountsView() {
       let res;
-      try { res = await Api.counts({ page: pagesRef.current.counts || 1, pageSize: 25 }); } catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      try { res = await Api.counts({ page: pagesRef.current.counts || 1, pageSize: 25 }); } catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
@@ -45,3 +51,3 @@ export default function CountsView() {
     document.getElementById('cNew')?.addEventListener('click', () => newCount());
-    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCount(b.dataset.open));
+    hostRef.current.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCount(b.dataset.open));
   }, [phase]);
@@ -164,4 +170,10 @@ export default function CountsView() {

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
@@ -189,3 +201,3 @@ export default function CountsView() {

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/ItemsView.jsx b/frontend-react/ItemsView.jsx
index 102a55f..7bd05b9 100644
--- a/frontend-react/ItemsView.jsx
+++ b/frontend-react/ItemsView.jsx
@@ -33,2 +33,3 @@ export default function ItemsView() {
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);

@@ -48,3 +49,2 @@ export default function ItemsView() {
       if (firstLoadRef.current) {
-        firstLoadRef.current = false;
         try {
@@ -57,5 +57,6 @@ export default function ItemsView() {
           suppliersRef.current = sup;
+          firstLoadRef.current = false;
         } catch (e) {
-          warehousesRef.current = [];
-          suppliersRef.current = [];
+          if (!cancelled) setPhase({ status: 'error', res: null, error: e });
+          return;
         }
@@ -65,3 +66,3 @@ export default function ItemsView() {
       try { res = await Api.items({ ...filters, pageSize: 25 }); }
-      catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
@@ -91,6 +92,6 @@ export default function ItemsView() {

-    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCard(b.dataset.open));
-    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => itemForm(await Api.item(b.dataset.edit)));
-    document.querySelectorAll('[data-in]').forEach(b => b.onclick = () => stockInDialog(res.data.find(x => x.id === b.dataset.in)));
-    document.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openCard(b.dataset.open));
+    hostRef.current.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => itemForm(await Api.item(b.dataset.edit)));
+    hostRef.current.querySelectorAll('[data-in]').forEach(b => b.onclick = () => stockInDialog(res.data.find(x => x.id === b.dataset.in)));
+    hostRef.current.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
       const it = res.data.find(x => x.id === b.dataset.label);
@@ -98,3 +99,3 @@ export default function ItemsView() {
     });
-    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
       const it = res.data.find(x => x.id === b.dataset.del);
@@ -434,4 +435,10 @@ export default function ItemsView() {

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
@@ -482,3 +489,3 @@ export default function ItemsView() {

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/LotsView.jsx b/frontend-react/LotsView.jsx
index 1d2481e..7548169 100644
--- a/frontend-react/LotsView.jsx
+++ b/frontend-react/LotsView.jsx
@@ -140,2 +140,3 @@ export default function LotsView() {
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);
   const warehousesRef = useRef([]);
@@ -147,4 +148,9 @@ export default function LotsView() {
       if (firstLoadRef.current) {
-        firstLoadRef.current = false;
-        try { warehousesRef.current = await Api.warehouses(); } catch { warehousesRef.current = []; }
+        try {
+          warehousesRef.current = await Api.warehouses();
+          firstLoadRef.current = false;
+        } catch (error) {
+          if (!cancelled) setPhase({ status: 'error', res: null, error });
+          return;
+        }
       }
@@ -152,3 +158,3 @@ export default function LotsView() {
       let res;
-      try { res = await Api.lots({ ...filters, pageSize: 25 }); } catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      try { res = await Api.lots({ ...filters, pageSize: 25 }); } catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
@@ -171,6 +177,6 @@ export default function LotsView() {

-    document.querySelectorAll('[data-trace]').forEach(b => b.onclick = () => traceDialog(b.dataset.trace));
-    document.querySelectorAll('[data-status]').forEach(b => b.onclick = () => statusDialog(res.data.find(x => x.id === b.dataset.status)));
-    document.querySelectorAll('[data-transfer]').forEach(b => b.onclick = () => transferDialog(res.data.find(x => x.id === b.dataset.transfer)));
-    document.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-trace]').forEach(b => b.onclick = () => traceDialog(b.dataset.trace));
+    hostRef.current.querySelectorAll('[data-status]').forEach(b => b.onclick = () => statusDialog(res.data.find(x => x.id === b.dataset.status)));
+    hostRef.current.querySelectorAll('[data-transfer]').forEach(b => b.onclick = () => transferDialog(res.data.find(x => x.id === b.dataset.transfer)));
+    hostRef.current.querySelectorAll('[data-label]').forEach(b => b.onclick = () => {
       const lot = res.data.find(x => x.id === b.dataset.label);
@@ -226,4 +232,10 @@ export default function LotsView() {

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
@@ -278,3 +290,3 @@ export default function LotsView() {

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/PlanningView.jsx b/frontend-react/PlanningView.jsx
index b056161..84947b8 100644
--- a/frontend-react/PlanningView.jsx
+++ b/frontend-react/PlanningView.jsx
@@ -62,2 +62,3 @@ export default function PlanningView() {
     if (!ready) return;
+    let cancelled = false;
     const body = document.getElementById('planBody');
@@ -67,5 +68,6 @@ export default function PlanningView() {
     (async () => {
-      try { await fns[tab](body, actions); }
-      catch (e) { UI.errorState(body, e, reload); }
+      try { await fns[tab](body, actions, () => !cancelled); }
+      catch (e) { if (!cancelled) UI.errorState(body, e, reload); }
     })();
+    return () => { cancelled = true; };
   }, [ready, tab, reloadToken]);
@@ -443,3 +445,3 @@ export default function PlanningView() {
   /* ================= ROTALAR ================= */
-  async function routingTab(body, actions) {
+  async function routingTab(body, actions, isCurrent) {
     const items = itemsRef.current, workCenters = workCentersRef.current;
@@ -449,3 +451,4 @@ export default function PlanningView() {
     const routingItemId = routingItemIdRef.current;
-    const ops = routingItemId ? await Api.routings(routingItemId).catch(() => []) : [];
+    const ops = routingItemId ? await Api.routings(routingItemId) : [];
+    if (!isCurrent()) return;

@@ -456,3 +459,3 @@ export default function PlanningView() {
       <div class="filters">
-        ${select('rtItem', producible.map(i => ({ v: i.id, l: `${i.name} (${i.code || ''})` })), routingItemId)}
+        ${select('rtItem', producible.map(i => ({ v: i.id, l: `${i.name} (${i.code || ''})` })), routingItemId, { search: 'producibleItems' })}
       </div>
@@ -499,2 +502,3 @@ export default function PlanningView() {
     document.getElementById('rtItem').onchange = e => { routingItemIdRef.current = e.target.value; reload(); };
+    UI.enhanceSelects(body);
     document.getElementById('rtAdd')?.addEventListener('click', () => {
@@ -506,2 +510,7 @@ export default function PlanningView() {
     document.getElementById('rtSave')?.addEventListener('click', async () => {
+      const saveButton = document.getElementById('rtSave');
+      if (saveButton.disabled) return;
+      const clear = rows.length === 0;
+      if (clear && !window.confirm(UI.getLang() === 'tr' ? 'Bu ürünün rotası silinecek. Devam edilsin mi?' : 'Clear this item routing?')) return;
+      saveButton.disabled = true;
       try {
@@ -511,5 +520,5 @@ export default function PlanningView() {
           queueMinutes: r.queueMinutes, scrapPct: r.scrapPct
-        })));
+        })), ops.revision, clear);
         UI.ok(t('saved')); reload();
-      } catch (e) { UI.err(e); }
+      } catch (e) { UI.err(e); saveButton.disabled = false; }
     });
diff --git a/frontend-react/ProductionView.jsx b/frontend-react/ProductionView.jsx
index a4ac075..d267161 100644
--- a/frontend-react/ProductionView.jsx
+++ b/frontend-react/ProductionView.jsx
@@ -15,2 +15,3 @@ export default function ProductionView() {
   const [phase, setPhase] = useState({ status: 'loading', res: null, error: null });
+  const hostRef = useRef(null);
   const itemsRef = useRef([]);
@@ -26,3 +27,2 @@ export default function ProductionView() {
       if (firstLoadRef.current) {
-        firstLoadRef.current = false;
         try {
@@ -31,4 +31,9 @@ export default function ProductionView() {
           ]);
+          if (cancelled) return;
           itemsRef.current = it.data; warehousesRef.current = wh; settingsRef.current = st;
-        } catch (e) { UI.err(e); }
+          firstLoadRef.current = false;
+        } catch (e) {
+          if (!cancelled) setPhase({ status: 'error', res: null, error: e });
+          return;
+        }
       }
@@ -36,3 +41,3 @@ export default function ProductionView() {
       let res;
-      try { res = await Api.production({ ...filters, pageSize: 25 }); } catch (e) { UI.errorState(null, e, typeof reload === 'function' ? reload : null); return; }
+      try { res = await Api.production({ ...filters, pageSize: 25 }); } catch (e) { if (!cancelled) setPhase({ status: 'error', res: null, error: e }); return; }
       if (cancelled) return;
@@ -47,5 +52,5 @@ export default function ProductionView() {
     document.getElementById('pNew')?.addEventListener('click', () => newProd());
-    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProd(b.dataset.open));
-    document.querySelectorAll('[data-complete]').forEach(b => b.onclick = () => completeDialog(b.dataset.complete));
-    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
+    hostRef.current.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProd(b.dataset.open));
+    hostRef.current.querySelectorAll('[data-complete]').forEach(b => b.onclick = () => completeDialog(b.dataset.complete));
+    hostRef.current.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
       UI.confirmDialog(t('confirmDelete'), async () => {
@@ -209,4 +214,10 @@ export default function ProductionView() {

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
@@ -252,3 +263,3 @@ export default function ProductionView() {

-  return <div dangerouslySetInnerHTML={{ __html: html }} />;
+  return <div ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
 }
diff --git a/frontend-react/QualityView.jsx b/frontend-react/QualityView.jsx
index 573d1ee..e56f603 100644
--- a/frontend-react/QualityView.jsx
+++ b/frontend-react/QualityView.jsx
@@ -9,2 +9,36 @@ import { useEffect, useState, useRef } from 'react';

+function bindLotSelector(box, itemId, lotId, saveId) {
+  const item = box.querySelector('#' + itemId);
+  const sel = box.querySelector('#' + lotId);
+  const save = box.querySelector('#' + saveId);
+  let version = 0;
+  const load = async () => {
+    const mine = ++version, selectedItem = item.value;
+    box.querySelector('#' + lotId + 'Retry')?.remove();
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
+      const retry = document.createElement('button');
+      retry.id = lotId + 'Retry';
+      retry.type = 'button';
+      retry.className = 'btn btn-ghost';
+      retry.textContent = UI.t('retry');
+      retry.onclick = load;
+      sel.after(retry);
+    }
+  };
+  item.onchange = load;
+  load();
+}
+
 export default function QualityView() {
@@ -104,3 +138,3 @@ export default function QualityView() {
         </div>
-        ${field(t('lotNo'), select('inLot', [{ v: '', l: t('none') }]), UI.getLang() === 'tr' ? 'Ürün seçildiğinde partiler yüklenir.' : 'Lots load once you pick an item.')}
+        ${field(t('lotNo'), select('inLot', [{ v: '', l: t('none') }], undefined, { search: 'lots' }), UI.getLang() === 'tr' ? 'Ürün seçildiğinde partiler yüklenir.' : 'Lots load once you pick an item.')}
         <div class="field-row three">
@@ -115,17 +149,3 @@ export default function QualityView() {
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

@@ -347,3 +367,3 @@ export default function QualityView() {
         </div>
-        ${field(t('lotNo'), select('ncLot', [{ v: '', l: t('none') }]))}
+        ${field(t('lotNo'), select('ncLot', [{ v: '', l: t('none') }], undefined, { search: 'lots' }))}
         ${field(t('supplierName'), select('ncSup', [{ v: '', l: t('none') }, ...suppliers.map(s => ({ v: s.id, l: s.name }))]))}
@@ -353,16 +373,3 @@ export default function QualityView() {
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

diff --git a/frontend-react/SalesView.jsx b/frontend-react/SalesView.jsx
index 96f56a3..f179379 100644
--- a/frontend-react/SalesView.jsx
+++ b/frontend-react/SalesView.jsx
@@ -259,3 +259,6 @@ export default function SalesView() {
     body.querySelectorAll('[data-adv]').forEach(b => b.onclick = async () => {
-      try { await Api.advanceShipment(b.dataset.adv); UI.ok(t('saved')); reload(); } catch (e) { UI.err(e); }
+      if (b.disabled) return;
+      b.disabled = true;
+      try { await Api.advanceShipment(b.dataset.adv, rows.find(r => r.id === b.dataset.adv).status); UI.ok(t('saved')); reload(); }
+      catch (e) { UI.err(e); b.disabled = false; }
     });
diff --git a/public/js/api.js b/public/js/api.js
index 524fc41..fa805d8 100644
--- a/public/js/api.js
+++ b/public/js/api.js
@@ -20,2 +20,3 @@ const Api = (() => {
     if (write) pendingWrites++;
+    try {
     let res;
@@ -31,4 +32,2 @@ const Api = (() => {
       throw err;
-    } finally {
-      if (write) pendingWrites--;
     }
@@ -48,3 +47,9 @@ const Api = (() => {
     }
+    if (data && typeof data === 'object' && res.headers.get('ETag')) {
+      Object.defineProperty(data, 'revision', { value: res.headers.get('ETag') });
+    }
     return data;
+    } finally {
+      if (write) pendingWrites--;
+    }
   }
@@ -177,3 +182,3 @@ const Api = (() => {
     createShipment: (d) => req('POST', '/sales/shipments', d),
-    advanceShipment: (id) => req('PATCH', `/sales/shipments/${id}/status`),
+    advanceShipment: (id, expectedStatus) => req('PATCH', `/sales/shipments/${id}/status`, { expectedStatus }),
     deleteShipment: (id) => req('DELETE', '/sales/shipments/' + id),
@@ -280,3 +285,3 @@ const Api = (() => {
     routings: (itemId) => req('GET', '/planning/routings/' + itemId),
-    saveRouting: (itemId, operations) => req('PUT', '/planning/routings/' + itemId, { operations }),
+    saveRouting: (itemId, operations, expectedRevision, clear = false) => req('PUT', '/planning/routings/' + itemId, { operations, expectedRevision, clear }),
     capacity: (p) => req('GET', '/planning/capacity' + qs(p)),
diff --git a/public/js/app.js b/public/js/app.js
index 669e4c1..927cb13 100644
--- a/public/js/app.js
+++ b/public/js/app.js
@@ -152,2 +152,4 @@ const App = (() => {
     closeMobileNav();
+    UI.closeModal();
+    document.getElementById('modalBox').replaceChildren();
     document.getElementById('loginScreen').style.display = 'flex';
diff --git a/public/js/ui.js b/public/js/ui.js
index 009cfef..de851bb 100644
--- a/public/js/ui.js
+++ b/public/js/ui.js
@@ -182,2 +182,11 @@ const UI = (() => {
   const SEARCH_SOURCES = {
+    producibleItems: {
+      find: q => Promise.all(['finished', 'semi'].map(itemType => Api.items({ q, itemType, pageSize: 30 })))
+        .then(results => results.flatMap(r => r.data).map(i => ({ v: i.id, l: i.code ? `${i.name} (${i.code})` : i.name }))),
+      one: id => Api.item(id).then(i => i.code ? `${i.name} (${i.code})` : i.name)
+    },
+    lots: {
+      find: (q, sel) => !sel.dataset.itemId ? Promise.resolve([]) : Api.lots({ q, itemId: sel.dataset.itemId, pageSize: 30 })
+        .then(r => r.data.map(l => ({ v: l.id, l: `${l.lotNo || '—'} · ${num(l.qty)} · ${l.status}` })))
+    },
     items: {
@@ -225,4 +234,5 @@ const UI = (() => {
       try {
-        const found = await source.find(q);
-        if (mine !== version) return;
+        const context = sel.dataset.itemId;
+        const found = await source.find(q, sel);
+        if (mine !== version || context !== sel.dataset.itemId || !sel.isConnected) return;
         if (!found.length) return;
@@ -243,3 +253,3 @@ const UI = (() => {
     }, 250);
-    box.addEventListener('input', run);
+    box.addEventListener('input', () => { version++; run(); });
   }

```
