/**
 * Consensus Engine — Appearance
 * Light/dark theme and UI zoom for the side panel.
 */

const Appearance = (() => {
  // ===== Theme =====

  async function initTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get('ce_theme', (data) => {
        const theme = data.ce_theme || 'light';
        applyTheme(theme);
        resolve();
      });
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const logo = $('#brand-logo');
    if (logo) {
      const src = theme === 'dark' ? logo.dataset.dark : logo.dataset.light;
      if (src) logo.src = src;
    }
    document.querySelectorAll('.deftx-footer-logo').forEach((img) => {
      const src = theme === 'dark' ? img.dataset.dark : img.dataset.light;
      if (src) img.src = src;
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    chrome.storage.local.set({ ce_theme: next });
  }

  // ===== UI Zoom (replaces font-size-only control) =====

  const IDEAL_WIDTH = 400;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;
  const ZOOM_DEFAULT = 0.815;
  const ZOOM_STEP = 0.1;

  let userZoom = ZOOM_DEFAULT;

  function initUIZoom() {
    return new Promise((resolve) => {
      chrome.storage.local.get('ce_ui_zoom', (data) => {
        userZoom = data.ce_ui_zoom || ZOOM_DEFAULT;
        applyUIScale();
        window.addEventListener('resize', applyUIScale);
        resolve();
      });
    });
  }

  function applyUIScale() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const panelScale = Math.min(1, w / IDEAL_WIDTH);
    const totalZoom = panelScale * userZoom;

    document.body.style.width = w / totalZoom + 'px';
    document.body.style.height = h / totalZoom + 'px';
    document.body.style.zoom = totalZoom;
  }

  function changeZoom(direction) {
    userZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((userZoom + direction * ZOOM_STEP) * 100) / 100));
    chrome.storage.local.set({ ce_ui_zoom: userZoom });
    applyUIScale();
  }

  return { initTheme, toggleTheme, initUIZoom, changeZoom };
})();
