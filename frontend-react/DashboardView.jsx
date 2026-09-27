// @ts-nocheck
/**
 * Panel (Dashboard) — React'e kademeli geçişin ilk pilotu.
 *
 * Bilinçli tasarım kararı: iş mantığı YENİDEN YAZILMADI. `public/js/ui.js`
 * içindeki `stat()/card()/table()/chart()` yardımcıları aynen çağrılıyor —
 * bunlar zaten `test/ui-smoke.js` ve `test/visual-audit.js` tarafından
 * doğrulanmış durumda. React burada yalnızca YAŞAM DÖNGÜSÜNÜ (veri çekme,
 * yükleniyor/hata durumu, grafiklerin doğru zamanda oluşturulup
 * temizlenmesi) yönetiyor — orijinal `public/js/views/dashboard.js`'nin
 * ürettiği HTML birebir aynı kalıyor.
 *
 * `UI`/`Api` `window.UI`/`window.Api` DEĞİL — `public/js/ui.js` ve
 * `api.js` bunları üst seviyede `const` ile tanımlıyor. Bir klasik
 * `<script>`'te üst seviye `const`, `window`'a EKLENMEZ (yalnızca `var`
 * eklenir) ama aynı sayfadaki TÜM script'lerin paylaştığı global kapsamda
 * (scope chain) bare tanımlayıcı olarak erişilebilir kalır. Bu yüzden bu
 * dosyada da bare `UI`/`Api` kullanılıyor — `window.UI` her zaman
 * `undefined` döner ve bunu bulmak biraz zaman aldı (bkz. commit mesajı).
 */
import { useEffect, useState, useCallback } from 'react';

const lang0 = (k) =>
  UI.getLang() === 'tr'
    ? (k === 'in' ? 'Giriş değeri' : 'Çıkış değeri')
    : (k === 'in' ? 'Stock in' : 'Stock out');

export default function DashboardView() {
  const { t, esc, money, num, dt, card, stat, table, loading } = UI;
  const [state, setState] = useState({ status: 'loading', s: null, tr: null, error: null });

  const load = useCallback(async () => {
    setState({ status: 'loading', s: null, tr: null, error: null });
    try {
      const [s, tr] = await Promise.all([Api.summary(), Api.trends(12)]);
      setState({ status: 'ready', s, tr, error: null });
    } catch (e) {
      UI.err(e);
      setState({ status: 'error', s: null, tr: null, error: e.message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Veri geldikten ve HTML DOM'a yazıldıktan SONRA: yenile düğmesini bağla,
  // grafikleri oluştur. UI.chart() zaten aynı canvas id'sinde önceki grafiği
  // destroy edip yeniden oluşturuyor (bkz. ui.js) — güvenle tekrar çağrılabilir.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const { s, tr } = state;
    const btn = document.getElementById('dashRefresh');
    if (btn) btn.onclick = load;
    document.querySelectorAll('[data-dash-go]').forEach(b => {
      b.onclick = () => App.go(b.dataset.dashGo);
    });

    if (document.getElementById('chTrend')) UI.chart('chTrend', {
      type: 'line',
      data: {
        labels: tr.periods,
        datasets: [
          { label: lang0('in'), data: tr.stockInValue, borderColor: UI.PALETTE[2], backgroundColor: 'rgba(111,169,122,.12)', fill: true, tension: .3 },
          { label: lang0('out'), data: tr.stockOutValue, borderColor: UI.PALETTE[3], backgroundColor: 'rgba(226,87,76,.12)', fill: true, tension: .3 }
        ]
      }
    });

    if (document.getElementById('chStatus')) UI.chart('chStatus', {
      type: 'doughnut',
      data: {
        labels: s.statusBreakdown.map(x => UI.lotStatusBadge(x.status).replace(/<[^>]*>/g, '')),
        datasets: [{ data: s.statusBreakdown.map(x => Math.round(x.value)), backgroundColor: UI.PALETTE, borderColor: '#24282C', borderWidth: 2 }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    if (document.getElementById('chCat')) UI.chart('chCat', {
      type: 'bar',
      data: {
        labels: s.categoryValue.map(c => c.category),
        datasets: [{ label: '₺', data: s.categoryValue.map(c => c.value), backgroundColor: UI.PALETTE[0], borderRadius: 4 }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  }, [state, load]);

  if (state.status === 'loading') {
    return <div dangerouslySetInnerHTML={{ __html: loading() }} />;
  }
  if (state.status === 'error') {
    return <div className="empty">{esc(state.error)}</div>;
  }

  const { s, tr } = state;
  const hasTrend = (tr?.periods || []).some((_, i) => Number(tr.stockInValue?.[i]) || Number(tr.stockOutValue?.[i]));
  const hasStatus = (s.statusBreakdown || []).some(x => Number(x.value));
  const hasCategory = (s.categoryValue || []).some(x => Number(x.value));
  const emptyChart = (title, text) => `<div class="chart-empty" role="status"><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
  const firstRun = !hasTrend && !hasStatus && !hasCategory && !s.lowStockList?.length && !s.expiringList?.length;
  const html = `
    <div class="topbar">
      <div><h2>${t('dashTitle')}</h2><div class="sub">${t('dashSub')}</div></div>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-sm" id="dashRefresh">${UI.icon(UI.ICONS.search)}${t('refresh')}</button>
      </div>
    </div>

    ${firstRun ? `<section class="dashboard-welcome">
      <div><h3>${UI.getLang() === 'tr' ? 'Çalışma alanınız hazır' : 'Your workspace is ready'}</h3>
      <p>${UI.getLang() === 'tr' ? 'İlk ürününüzü ekleyin veya mevcut verilerinizi içe aktararak başlayın.' : 'Add your first item or import existing data to get started.'}</p></div>
      <div class="dashboard-quick-actions">
        <button class="btn btn-primary" type="button" data-dash-go="items">${UI.getLang() === 'tr' ? 'Ürünlere git' : 'Open items'}</button>
        ${UI.can('approve') ? `<button class="btn btn-ghost" type="button" data-dash-go="admin">${UI.getLang() === 'tr' ? 'Veri aktarımı' : 'Import data'}</button>` : ''}
      </div>
    </section>` : ''}

    <div class="stat-row">
      ${stat(t('kpiStockValue'), '₺' + money(s.totalValueTRY))}
      ${stat(t('kpiQuarantine'), '₺' + money(s.quarantineValueTRY), { kind: 'warn', sub: t('quarantine') })}
      ${stat(t('kpiBlocked'), '₺' + money(s.blockedValueTRY), { kind: 'crit' })}
      ${stat(t('kpiPendingPO'), '₺' + money(s.pendingPOTotalTRY), { kind: 'info' })}
    </div>

    <div class="stat-row">
      ${stat(t('kpiLowStock'), s.lowStockCount, { kind: s.lowStockCount ? 'warn' : 'ok' })}
      ${stat(t('kpiExpiring'), s.expiringCount, { kind: s.expiringCount ? 'crit' : 'ok' })}
      ${stat(t('kpiOverduePO'), s.overduePOCount, { kind: s.overduePOCount ? 'crit' : 'ok' })}
      ${stat(t('kpiApprovals'), s.pendingApprovalCount, { kind: s.pendingApprovalCount ? 'warn' : 'ok' })}
      ${stat(t('kpiOpenNCR'), s.openNCRCount, { kind: s.openNCRCount ? 'warn' : 'ok' })}
      ${stat(t('kpiPendingInsp'), s.pendingInspectionCount, { kind: s.pendingInspectionCount ? 'warn' : 'ok' })}
      ${stat(t('kpiOpenProd'), s.openProductionCount, { kind: 'info' })}
      ${stat(t('kpiCalibration'), s.calibrationDueCount, { kind: s.calibrationDueCount ? 'warn' : 'ok' })}
    </div>

    <div class="grid-2">
      ${card(t('chartTrend'), hasTrend ? '<div class="chart-wrap"><canvas id="chTrend"></canvas></div>' : emptyChart(UI.getLang() === 'tr' ? 'Trend verisi bekleniyor' : 'Waiting for trend data', UI.getLang() === 'tr' ? 'Stok hareketleri oluştukça aylık değişim burada görünür.' : 'Monthly movement appears here after stock transactions.'))}
      ${card(t('chartStockStatus'), hasStatus ? '<div class="chart-wrap"><canvas id="chStatus"></canvas></div>' : emptyChart(UI.getLang() === 'tr' ? 'Dağılım henüz oluşmadı' : 'No distribution yet', UI.getLang() === 'tr' ? 'Parti ve stok kayıtları eklendiğinde durum dağılımı gösterilir.' : 'Status distribution appears after lot and stock records are added.'))}
    </div>

    ${card(t('chartCategoryValue'), hasCategory ? '<div class="chart-wrap"><canvas id="chCat"></canvas></div>' : emptyChart(UI.getLang() === 'tr' ? 'Kategori değeri yok' : 'No category value yet', UI.getLang() === 'tr' ? 'Maliyetli stok oluştuğunda kategori karşılaştırması burada görünür.' : 'Category comparison appears when valued stock is available.'))}

    <div class="grid-2">
      ${card(t('lowStockList'), table([
        { key: 'name', label: t('itemName') },
        { key: 'warehouse', label: t('warehouse'), render: r => esc(r.warehouse || '—') },
        { key: 'qty', label: t('onHand'), num: true, render: r => `${num(r.qty)} ${esc(r.unit || '')}` },
        { key: 'minStock', label: t('minStock'), num: true, render: r => num(r.minStock) }
      ], s.lowStockList, { emptyText: t('noData') }), '', true)}

      ${card(t('expiringList'), table([
        { key: 'itemName', label: t('itemName') },
        { key: 'lotNo', label: t('lotNo'), render: r => `<span class="mono">${esc(r.lotNo || '—')}</span>` },
        { key: 'qty', label: t('qty'), num: true, render: r => `${num(r.qty)} ${esc(r.unit || '')}` },
        {
          key: 'expiryDate', label: t('expiryDate'), render: r => r.daysLeft < 0
            ? `<span class="badge crit">${t('expired')} · ${dt(r.expiryDate)}</span>`
            : `<span class="badge warn">${num(r.daysLeft)} ${t('daysLeft')}</span>`
        }
      ], s.expiringList, { emptyText: t('noData') }), '', true)}
    </div>`;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
