/* ==========================================================================
   Page behaviour: smooth scroll, banner fade, slideshow (with pause), hero
   scroll effect, and the section navigation (keyboard accessible).
   Depends on constants.js. GSAP / ScrollTrigger / Lenis come from CDNs and are
   optional: if one fails to load the page still works (progressive enhancement).
   ========================================================================== */

if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- 0. User motion preference (WCAG 2.2.2 / reduced motion) ---------- */
  APP_STATE.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  /* ---------- 1. Smooth scrolling (skipped when the user asks for reduced motion) ---------- */
  let lenis = null;
  if (!APP_STATE.reducedMotion && hasGsap && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y, behavior: 'auto' });
  }

  /* ---------- 2. Banner fade on scroll ---------- */
  const topBanner = document.getElementById('top-team-banner');
  const leftNav = document.getElementById('left-sticky-nav');
  const mobileToggle = document.getElementById('mobile-nav-toggle');

  window.addEventListener('scroll', () => {
    if (!leftNav || !leftNav.classList.contains('is-open')) {
      topBanner?.classList.toggle('banner-hidden', window.scrollY > APP_CONFIG.BANNER_HIDE_SCROLL_PX);
    }
  }, { passive: true });

  /* ---------- 3. Mobile navigation drawer ---------- */
  const navLinks = Array.from(document.querySelectorAll('.left-sticky-nav .nav-link'));

  function setNavOpen(open, returnFocusToToggle = false) {
    if (!leftNav || !mobileToggle) return;
    leftNav.classList.toggle('is-open', open);
    mobileToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      topBanner?.classList.add('banner-hidden');
      navLinks[0]?.focus();                       // move focus into the drawer
    } else {
      if (window.scrollY <= APP_CONFIG.BANNER_HIDE_SCROLL_PX) topBanner?.classList.remove('banner-hidden');
      if (returnFocusToToggle) mobileToggle.focus();
    }
  }

  if (mobileToggle && leftNav) {
    mobileToggle.addEventListener('click', () => {
      setNavOpen(!leftNav.classList.contains('is-open'));
    });

    // Esc closes the drawer and returns focus to the toggle button
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && leftNav.classList.contains('is-open')) setNavOpen(false, true);
    });

    // Clicking outside the drawer closes it
    document.addEventListener('click', (e) => {
      if (leftNav.classList.contains('is-open') &&
          !leftNav.contains(e.target) && !mobileToggle.contains(e.target)) {
        setNavOpen(false);
      }
    });
  }

  /* ---------- 4. Hero slideshow with Pause / Play (WCAG 2.2.2) ---------- */
  const slides = Array.from(document.querySelectorAll('#hero-media-frame .slide'));
  const slideRegion = document.getElementById('slideshow-container');
  const slideToggle = document.getElementById('slide-toggle');
  let currentSlide = 0;
  let slideTimer = null;

  function showSlide(index) {
    currentSlide = index;
    slides.forEach((slide, i) => {
      const isActive = i === index;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));  // only the visible slide is read out
    });
  }

  function updateSlideControls() {
    if (slideToggle) {
      slideToggle.textContent = APP_STATE.slideshowPlaying ? 'Pause slideshow' : 'Play slideshow';
    }
    // While playing keep updates silent; when paused announce slide changes politely (WAI-ARIA carousel pattern)
    slideRegion?.setAttribute('aria-live', APP_STATE.slideshowPlaying ? 'off' : 'polite');
  }

  function startSlideshow() {
    if (slides.length < 2 || slideTimer) return;
    slideTimer = setInterval(() => showSlide((currentSlide + 1) % slides.length),
                             APP_CONFIG.SLIDESHOW_INTERVAL_MS);
    APP_STATE.slideshowPlaying = true;
    updateSlideControls();
  }

  function stopSlideshow() {
    clearInterval(slideTimer);
    slideTimer = null;
    APP_STATE.slideshowPlaying = false;
    updateSlideControls();
  }

  if (slides.length > 0) {
    showSlide(0);
    // Reduced-motion users start paused; everyone can pause/play
    if (APP_STATE.reducedMotion) updateSlideControls(); else startSlideshow();
    slideToggle?.addEventListener('click', () => {
      if (APP_STATE.slideshowPlaying) stopSlideshow(); else startSlideshow();
    });
  }

  /* ---------- 5. Hero "genie" scroll effect (skipped for reduced motion) ---------- */
  const heroMedia = document.getElementById('hero-media-frame');
  if (heroMedia && hasGsap && !APP_STATE.reducedMotion) {
    gsap.to(heroMedia, {
      scrollTrigger: { trigger: '#hero', start: 'center 45%', end: 'bottom top+=150', scrub: 1.2 },
      scaleX: 0.22, scaleY: 0.08, y: 260, rotationX: -28, skewX: 6,
      opacity: 0, filter: 'blur(12px)', ease: 'power3.inOut'
    });
  }

  /* ---------- 6. Section navigation: gliding dot + aria-current ---------- */
  const navItems = Array.from(document.querySelectorAll('.left-sticky-nav .nav-item'));
  const gliderDot = document.getElementById('nav-glider-dot');
  // Targets come from each link's own href, so the HTML is the single source of truth
  const sectionEls = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);

  const gliderSetter = !gliderDot ? null
    : (hasGsap
        ? gsap.quickTo(gliderDot, 'y', { duration: APP_STATE.reducedMotion ? 0 : 0.12, ease: 'power1.out' })
        : (y) => { gliderDot.style.transform = `translateY(${y}px)`; });

  /* Exact vertical centre of a nav dot, relative to .nav-track-wrapper */
  function getCenteredDotY(index) {
    const navItem = navItems[index];
    if (!navItem) return 0;
    const dotContainer = navItem.querySelector('.nav-dot-container');
    const containerTop = dotContainer ? dotContainer.offsetTop : 0;
    const containerHeight = dotContainer ? dotContainer.offsetHeight : 20;
    const gliderHeight = 8;
    return navItem.offsetTop + containerTop + (containerHeight / 2) - (gliderHeight / 2);
  }

  function getSectionScrollTop(index) {
    const el = sectionEls[index];
    if (!el || index === 0) return 0;
    return Math.max(0, el.offsetTop);
  }

  function setGliderTop(yPx, activeIndex) {
    if (gliderSetter) gliderSetter(yPx);
    navItems.forEach((item, index) => {
      const isActive = index === activeIndex;
      item.classList.toggle('active', isActive);
      const link = navLinks[index];
      if (link) {
        if (isActive) link.setAttribute('aria-current', 'location');   // screen readers: "current location"
        else link.removeAttribute('aria-current');
      }
    });
    APP_STATE.activeSectionId = sectionEls[activeIndex]?.id || APP_STATE.activeSectionId;
  }

  function updateNavGliderContinuous() {
    if (!navItems.length || sectionEls.length < 2) return;
    const currentScroll = window.scrollY;

    if (currentScroll <= getSectionScrollTop(0)) {
      setGliderTop(getCenteredDotY(0), 0);
      return;
    }
    if (currentScroll >= getSectionScrollTop(sectionEls.length - 1)) {
      const lastIdx = navItems.length - 1;
      setGliderTop(getCenteredDotY(lastIdx), lastIdx);
      return;
    }
    for (let i = 0; i < sectionEls.length - 1; i++) {
      const startScroll = getSectionScrollTop(i);
      const endScroll = getSectionScrollTop(i + 1);
      if (currentScroll >= startScroll && currentScroll <= endScroll) {
        const factor = (currentScroll - startScroll) / (endScroll - startScroll);
        const interpolatedY = getCenteredDotY(i) + (getCenteredDotY(i + 1) - getCenteredDotY(i)) * factor;
        setGliderTop(interpolatedY, factor >= 0.5 ? i + 1 : i);
        break;
      }
    }
  }

  window.addEventListener('scroll', updateNavGliderContinuous, { passive: true });
  window.addEventListener('resize', updateNavGliderContinuous);
  updateNavGliderContinuous();

  /* Move keyboard / screen-reader focus to the section heading after a nav jump (WCAG 2.4.3) */
  function moveFocusToSection(index) {
    const target = sectionEls[index]?.querySelector('h1, h2');
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  navLinks.forEach((link, index) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();                                  // we scroll ourselves (Lenis or native)
      setGliderTop(getCenteredDotY(index), index);
      scrollToY(getSectionScrollTop(index));
      moveFocusToSection(index);
      try { history.replaceState(null, '', link.getAttribute('href')); }   // keeps the URL shareable
      catch (err) { /* replaceState can throw on file:// - safe to ignore */ }
      if (leftNav?.classList.contains('is-open')) setNavOpen(false);
    });
  });

  /* ---------- 7. "Skip to main content" link (WCAG 2.4.1) ---------- */
  const skipLink = document.querySelector('.skip-link');
  const mainEl = document.getElementById('main-content');
  skipLink?.addEventListener('click', (e) => {
    e.preventDefault();
    mainEl?.focus({ preventScroll: true });
    mainEl?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
});