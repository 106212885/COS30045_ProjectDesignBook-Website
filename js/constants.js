/* ==========================================================================
   js/constants.js
   Centralised project constants and shared state.
   MUST be loaded BEFORE accessibility.js and main.js (see index.html).
   NOTE: APP_CONFIG / APP_STATE are declared ONLY here. Do not redeclare them
   in other files (a second `const APP_CONFIG` stops that whole script from running).
   ========================================================================== */

/* Colours for D3 chart marks.
   Every colour is >= 3:1 against the cream page background (#FAF8F5) so charts meet
   WCAG 1.4.11 Non-text Contrast. Hand-calculated: re-check in the WebAIM contrast checker.
   Colour alone must never carry meaning: always pair with shape, pattern or direct labels. */
const PALETTE = {
  BLUE: '#0072B2',        // ~4.9:1
  VERMILLION: '#D55E00',  // ~3.6:1
  GREEN: '#009E73',       // ~3.2:1
  PURPLE: '#7B5DAA',      // ~5.0:1
  GREY_CONTEXT: '#5E5A66' // context / baseline series
};

const APP_CONFIG = {
  SLIDESHOW_INTERVAL_MS: 3800,
  BANNER_HIDE_SCROLL_PX: 45,   // scroll distance before the top banner fades out
  FONT_STEP_PERCENT: 12.5,     // each A+ press = +12.5% (= +2px at a 16px default)
  FONT_MIN_STEPS: 0,           // never smaller than the user's default size
  FONT_MAX_STEPS: 3,
  FONT_STORAGE_KEY: 'trace-font-step'
};

const APP_STATE = {
  fontStep: 0,
  activeSectionId: 'hero',
  slideshowPlaying: false,
  reducedMotion: false
};