# Corrected source review - server
Baseline f5041ae. Real DB isolated. Prior review was invalid because filter skipped source. This context removes authentication assignments with [REDACTED]; these are not changed security behavior. No live credentials. Expected status/revision optional for legacy; current UI sends them. Empty route requires explicit clear. Available quantity now excludes expired lots; disposal and supplier return explicitly permit expired consumption. No schema migration. Existing42 suites and browser58 each passed before last small guards; final reruns underway.
```diff
diff --git a/server/lib/license.js b/server/lib/license.js
index 39ff5fe..bd8c479 100644
--- a/server/lib/license.js
+++ b/server/lib/license.js
@@ -73,3 +73,3 @@ function verify(licenseFile) {
     const daysRemaining = Math.ceil((expiryMs - Date.now()) / 86400000);
-    if (daysRemaining < 0) {
+    if (Date.now() > expiryMs) {
       return { valid: false, reason: `Lisans süresi doldu / License expired on ${expiresAt}`, expired: true, license: licenseFile.payload };
diff --git a/server/routes/planning.js b/server/routes/planning.js
index c56d942..e0e844c 100644
--- a/server/routes/planning.js
+++ b/server/routes/planning.js
@@ -1,2 +1,3 @@
 const express = require('express');
+const { createHash } = require('node:crypto');
 const db = require('../db');
@@ -204,3 +205,9 @@ router.delete('/calendar-exceptions/:id', MANAGER, (req, res) => {

+function routingRevision(itemId) {
+  const rows = db.prepare('SELECT * FROM routings WHERE item_id=? ORDER BY operation_no').all(itemId);
+  return '"' + createHash('sha256').update(JSON.stringify(rows)).digest('hex') + '"';
+}
+
 router.get('/routings/:itemId', (req, res) => {
+  res.set('ETag', routingRevision(req.params.itemId));
   const rows = db.prepare(`SELECT r.*, wc.name AS work_center_name, wc.code AS work_center_code
@@ -218,2 +225,4 @@ router.get('/routings/:itemId', (req, res) => {
 router.put('/routings/:itemId', MANAGER, validate(z.object({
+  expectedRevision: z.string().max(100).optional(),
+  clear: z.boolean().default(false),
   operations: z.array(z.object({
@@ -237,3 +246,5 @@ router.put('/routings/:itemId', MANAGER, validate(z.object({

-  db.tx(() => {
+  db.txImmediate(() => {
+    if (req.valid.expectedRevision != null && req.valid.expectedRevision !== routingRevision(itemId)) throw new AppError('Rota değişmiş; yeniden yükleyin / Routing changed; reload before saving', 409);
+    if (!req.valid.operations.length && !req.valid.clear) throw new AppError('Rotayı silmek için açık onay gerekli / Explicit confirmation required to clear routing', 422);
     db.prepare('DELETE FROM routings WHERE item_id = ?').run(itemId);
diff --git a/server/routes/purchasing.js b/server/routes/purchasing.js
index 984a4a9..c808dac 100644
--- a/server/routes/purchasing.js
+++ b/server/routes/purchasing.js
@@ -1250,2 +1250,3 @@ router.post('/returns', requirePermission('purchase.write'), validate(returnSche
         allowedStatuses: ['available', 'quarantine', 'blocked', 'rejected'],
+        allowExpired: true,
         refType: 'supplier_return', refId: retId, note: `Tedarikçi iadesi ${no}`, userId: req.user.id
diff --git a/server/routes/quality.js b/server/routes/quality.js
index 6d48c52..51b7002 100644
--- a/server/routes/quality.js
+++ b/server/routes/quality.js
@@ -339,2 +339,3 @@ router.post('/ncrs/:id/disposition', requirePermission('quality.write'), validat
             allowedStatuses: ['available', 'quarantine', 'blocked', 'rejected'],
+            allowExpired: true,
             refType: 'ncr', refId: ncr.id, note: `${ncr.ncr_no} · hurdaya ayrıldı`, userId: req.user.id
diff --git a/server/routes/sales.js b/server/routes/sales.js
index c6343e1..615a22c 100644
--- a/server/routes/sales.js
+++ b/server/routes/sales.js
@@ -163,7 +163,10 @@ router.post('/orders', WRITE, validate(soSchema), (req, res) => {
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
@@ -311,2 +314,3 @@ router.patch('/shipments/:id/status', WRITE, (req, res) => {
   if (!s) throw new AppError('Sevkiyat bulunamadı / Shipment not found', 404);
+  if (req.body?.expectedStatus != null && req.body.expectedStatus !== s.status) throw new AppError('Sevkiyat durumu değişmiş; listeyi yenileyin / Shipment status changed; reload the list', 409);
   const order = ['Hazırlanıyor', 'Yolda', 'Teslim Edildi'];
diff --git a/server/services/costing.js b/server/services/costing.js
index 7c6ee6f..91858ce 100644
--- a/server/services/costing.js
+++ b/server/services/costing.js
@@ -100,3 +100,3 @@ function computeProductionCost(productionOrderId) {
   const total = materialCost + labor + overhead;
-  const goodQty = Number(po.produced_qty || po.qty || 0);
+  const goodQty = Number(po.produced_qty ?? po.qty ?? 0);
   const unitCost = goodQty > 0 ? total / goodQty : 0;
diff --git a/server/services/stock.js b/server/services/stock.js
index addefaf..7a4367e 100644
--- a/server/services/stock.js
+++ b/server/services/stock.js
@@ -108,4 +108,4 @@ function receiveLot({ itemId, warehouseId, qty, lotNo, serialNo, expiryDate, uni
 function pickLotsFEFO(itemId, qty, warehouseId = null) {
-  const params = [itemId];
-  let where = `item_id = ? AND status = 'available' AND qty > 0`;
+  const params = [itemId, today()];
+  let where = `item_id = ? AND status = 'available' AND qty > 0 AND (expiry_date IS NULL OR expiry_date >= ?)`;
   if (warehouseId) { where += ' AND warehouse_id = ?'; params.push(warehouseId); }
@@ -128,4 +128,4 @@ function pickLotsFEFO(itemId, qty, warehouseId = null) {
 function availableQty(itemId, warehouseId = null) {
-  const params = [itemId];
-  let where = `item_id = ? AND status = 'available'`;
+  const params = [itemId, today()];
+  let where = `item_id = ? AND status = 'available' AND (expiry_date IS NULL OR expiry_date >= ?)`;
   if (warehouseId) { where += ' AND warehouse_id = ?'; params.push(warehouseId); }
@@ -173,3 +173,4 @@ function changeLotStatus({ lotId, toStatus, qty, note, userId, refType, refId })
   const moveQty = qty != null ? Number(qty) : lot.qty;
-  if (moveQty <= 0 || moveQty > lot.qty + 1e-9) throw new AppError('Geçersiz miktar / Invalid quantity');
+  if (!Number.isFinite(moveQty) || moveQty <= 0 || moveQty > lot.qty + 1e-9) throw new AppError('Geçersiz miktar / Invalid quantity');
+  if (toStatus === lot.status) return lotId;

@@ -200,2 +201,7 @@ function changeLotStatus({ lotId, toStatus, qty, note, userId, refType, refId })
   recalcItemQty(lot.item_id);
+  if (toStatus === 'available' && lot.status !== 'available') {
+    updateAverageCost(lot.item_id, moveQty, lot.unit_cost);
+  } else if (lot.status === 'available' && toStatus !== 'available') {
+    recalcAverageCost(lot.item_id);
+  }
   return targetLotId;
@@ -286,3 +292,5 @@ function allocate(itemId, qty, warehouseId = null, strategy = 'FEFO') {
 /** Consume lots already picked by allocate() or chosen explicitly by the caller. */
-function consume(picks, { itemId, itemName, note, refType, refId, userId, warehouseId = null, allowedStatuses = ['available'] }) {
+/** @param {{lotId: string, qty: number}[]} picks
+ * @param {{itemId: string|number, itemName?: string, note?: string, refType?: string, refId?: string|number, userId?: string|number, warehouseId?: string|number, allowedStatuses?: string[], allowExpired?: boolean}} options */
+function consume(picks, { itemId, itemName, note, refType, refId, userId, warehouseId = null, allowedStatuses = ['available'], allowExpired = false }) {
   return db.txImmediate(() => {
@@ -294,2 +302,3 @@ function consume(picks, { itemId, itemName, note, refType, refId, userId, wareho
     if (!allowedStatuses.includes(lot.status)) throw new AppError('Lot bu işlem için uygun değil / Lot status is not eligible', 409);
+    if (!allowExpired && lot.expiry_date && lot.expiry_date < today()) throw new AppError('Partinin son kullanma tarihi geçmiş / Lot has expired', 409);
     if (!Number.isFinite(p.qty) || p.qty <= 0 || p.qty > lot.qty + 1e-9) throw new AppError('Geçersiz veya yetersiz miktar / Invalid or insufficient quantity', 422);

```
