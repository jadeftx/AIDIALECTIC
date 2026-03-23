/**
 * Consensus Engine — Theme & UI Zoom
 */

window.AID = window.AID || {};

(function () {
  'use strict';

  function initTheme() {
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

  function initUIZoom() {
    return new Promise((resolve) => {
      chrome.storage.local.get('ce_ui_zoom', (data) => {
        AID.userZoom = data.ce_ui_zoom || ZOOM_DEFAULT;
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
    const totalZoom = panelScale * AID.userZoom;

    document.body.style.width = w / totalZoom + 'px';
    document.body.style.height = h / totalZoom + 'px';
    document.body.style.zoom = totalZoom;
  }

  function changeZoom(direction) {
    AID.userZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((AID.userZoom + direction * ZOOM_STEP) * 100) / 100));
    chrome.storage.local.set({ ce_ui_zoom: AID.userZoom });
    applyUIScale();
  }

  // Public API
  AID.initTheme = initTheme;
  AID.initUIZoom = initUIZoom;
  AID.toggleTheme = toggleTheme;
  AID.changeZoom = changeZoom;
})();
