// @ts-nocheck
/* global document, Chart */
const { test, expect } = require('@playwright/test');
const { login, goToView } = require('./helpers');

test.describe('Ürün tasarım sistemi', () => {
  test('görsel varlıklar yerelden yüklenir ve tema tercihi kalıcıdır', async ({ page }) => {
    const external = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
    });

    await page.goto('/');
    await expect.poll(() => page.evaluate(() => typeof Chart)).toBe('function');
    expect(external).toEqual([]);

    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', before === 'light' ? '#F4F6F8' : '#111827');
    await page.locator('#loginThemeToggle').click();
    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(after).not.toBe(before);
    await page.reload();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(after);

    await page.goto('/api-docs.html');
    await expect(page.locator('.swagger-ui')).toBeVisible();
    expect(external).toEqual([]);
  });

  test('mobil menü çekmece olarak açılır ve sayfa yatay taşmaz', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await expect(page.locator('.nav-tab[data-view="dashboard"]')).toHaveAttribute('aria-current', 'page');

    await expect(page.locator('#mobileMenuToggle')).toBeVisible();
    await expect(page.locator('#sidebar')).not.toBeInViewport();
    await page.locator('#mobileMenuToggle').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);
    await expect(page.locator('#mobileMenuToggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sidebar')).toBeInViewport();

    await page.locator('.nav-tab[data-view="items"]').click();
    await expect(page.locator('.nav-tab[data-view="items"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.nav-tab[data-view="dashboard"]')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
    await expect(page.locator('#view-items .topbar')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('masaüstü menü daralır; yönetim taşması tablo içinde kalır', async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 884 });
    await login(page);
    await expect(page.locator('#sidebarCollapse')).toHaveAttribute('aria-label', 'Menüyü daralt');
    const appTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#themeToggle').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(appTheme);
    await page.locator('#sidebarCollapse').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
    await expect(page.locator('#sidebarCollapse')).toHaveAttribute('aria-label', 'Menüyü genişlet');
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
    await expect(page.locator('#sidebarCollapse')).toHaveAttribute('aria-label', 'Menüyü genişlet');

    await goToView(page, 'admin');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.locator('#view-admin [role="tablist"]')).toBeVisible();
    await expect(page.locator('#view-admin [role="tab"][aria-selected="true"]')).toHaveCount(1);
  });

  test('ürün formu okunabilir ve erişilebilir bölümlere ayrılmıştır', async ({ page }) => {
    await login(page);
    await goToView(page, 'items');
    await page.locator('#itNew').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.form-section')).toHaveCount(5);
    await expect(dialog.locator('#itemIdentityTitle')).toBeVisible();
    await expect(dialog.locator('#itemBomTitle')).toBeVisible();
  });

  test('KPI ve grafikler okunabilir ayrıntılara yönlendirir', async ({ page }) => {
    await login(page);
    const chartStyle = await page.evaluate(() => {
      const chart = Chart.getChart('chStatus');
      return { size: chart.options.plugins.legend.labels.font.size, color: chart.options.plugins.legend.labels.color };
    });
    expect(chartStyle.size).toBeGreaterThanOrEqual(13);
    expect(chartStyle.color).toBeTruthy();

    await page.locator('#chTrend').click({ position: { x: 24, y: 24 } });
    await expect(page).toHaveURL(/#reports$/);
    await expect(page.locator('#view-reports [role="tab"][aria-selected="true"]')).toContainText('Trend');
    await goToView(page, 'dashboard');

    const quarantine = page.locator('.stat[data-dash-go="lots"]').filter({ hasText: 'Karantinada' });
    await expect(quarantine).toHaveAttribute('role', 'button');
    await expect(quarantine.locator('.stat-state')).toHaveText(/Normal|Uyarı/);
    await quarantine.press('Enter');
    await expect(page).toHaveURL(/#lots$/);
    await expect(page.locator('#lStatus')).toHaveValue('quarantine');
  });

  test('tablo sütunları ve görünüm yoğunluğu kalıcıdır', async ({ page }) => {
    await login(page);
    await goToView(page, 'items');
    const shell = page.locator('#view-items .data-table-shell').first();
    await expect(shell.locator('table')).toHaveClass(/sticky-first/);
    const stickyLayers = await shell.evaluate(node => {
      const table = node.querySelector('table');
      const head = table.querySelector('th:first-child');
      const cell = table.querySelector('td:first-child');
      return {
        headPosition: getComputedStyle(head).position,
        headZ: Number(getComputedStyle(head).zIndex),
        cellPosition: getComputedStyle(cell).position,
        cellZ: Number(getComputedStyle(cell).zIndex)
      };
    });
    expect(stickyLayers).toEqual({ headPosition: 'sticky', headZ: 4, cellPosition: 'sticky', cellZ: 2 });
    await shell.locator('summary').click();
    await shell.locator('[data-table-col-toggle="1"]').uncheck();
    await expect(shell.locator('th[data-col="1"]')).toBeHidden();

    await page.locator('#densityToggle').click();
    await expect(page.locator('body')).toHaveAttribute('data-density', 'compact');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-density', 'compact');
    const restored = page.locator('#view-items .data-table-shell').first();
    await expect(restored.locator('[data-table-col-toggle="1"]')).not.toBeChecked();
    await expect(restored.locator('th[data-col="1"]')).toBeHidden();
  });

  test('boş modül listeleri açıklama ve işlem sunar', async ({ page }) => {
    await page.route(/\/api\/items(?:\?|$)/, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 25, totalPages: 0, facets: { categories: [] } })
    }));
    await login(page);
    await goToView(page, 'items');
    const empty = page.locator('#view-items .empty');
    await expect(empty.locator('strong')).toContainText('Henüz kayıt yok');
    await expect(empty.locator('.empty-action')).toBeVisible();
  });
});
