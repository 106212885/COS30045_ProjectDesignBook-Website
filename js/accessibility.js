/* ==========================================================================
   js/accessibility.js
   Font-size controls (A- / A+) and the toast announcement.
   Depends on constants.js (APP_CONFIG, APP_STATE) - load that file first.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const btnIncrease = document.getElementById('btn-text-increase');
  const btnDecrease = document.getElementById('btn-text-decrease');
  const toastEl = document.getElementById('a11y-toast');
  let toastTimeout;

  /* Toast is inside an aria-live="polite" region, so screen readers announce it. */
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  function currentPercent() {
    return 100 + APP_STATE.fontStep * APP_CONFIG.FONT_STEP_PERCENT;
  }

  /* Percentage (not px) keeps the user's own browser font-size setting as the baseline. */
  function applyFontSize() {
    document.documentElement.style.setProperty('--base-font-size', `${currentPercent()}%`);
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }

  function saveFontStep() {
    try { localStorage.setItem(APP_CONFIG.FONT_STORAGE_KEY, String(APP_STATE.fontStep)); }
    catch (err) { /* storage can be blocked (private mode / file://) - the feature still works */ }
  }

  function loadFontStep() {
    try {
      const saved = parseInt(localStorage.getItem(APP_CONFIG.FONT_STORAGE_KEY), 10);
      if (Number.isInteger(saved) &&
          saved >= APP_CONFIG.FONT_MIN_STEPS && saved <= APP_CONFIG.FONT_MAX_STEPS) {
        APP_STATE.fontStep = saved;
      }
    } catch (err) { /* ignore: fall back to default size */ }
  }

  loadFontStep();
  applyFontSize();

  if (btnIncrease && btnDecrease) {
    btnIncrease.addEventListener('click', () => {
      if (APP_STATE.fontStep < APP_CONFIG.FONT_MAX_STEPS) {
        APP_STATE.fontStep++;
        applyFontSize();
        saveFontStep();
        showToast(`Text size ${currentPercent()}%`);
      } else {
        showToast('Maximum text size reached');
      }
    });

    btnDecrease.addEventListener('click', () => {
      if (APP_STATE.fontStep > APP_CONFIG.FONT_MIN_STEPS) {
        APP_STATE.fontStep--;
        applyFontSize();
        saveFontStep();
        showToast(`Text size ${currentPercent()}%`);
      } else {
        showToast('Default text size reached');
      }
    });
  }
});