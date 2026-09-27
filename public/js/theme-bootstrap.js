// Apply the saved/system theme before the stylesheet paints the page.
// Kept in a self-hosted file so the strict Content-Security-Policy can remain.
(() => {
  const saved = localStorage.getItem('dp_theme');
  const prefersLight = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F4F6F8' : '#111827');
})();
