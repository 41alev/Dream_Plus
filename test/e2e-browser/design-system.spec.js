// @ts-nocheck
/* global document */
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
});
