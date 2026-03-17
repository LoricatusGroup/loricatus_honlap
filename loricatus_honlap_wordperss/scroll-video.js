/* ============================================================
   SCROLL-VIDEO – Frame-alapú, sima scroll-vezérelt háttér
   80 képkocka @ 10fps (frames2/frame_0001.jpg … frame_0080.jpg)
   Technika: Apple-stílusú képkocka-váltás scrolloláskor
   + Float-up section animations (IntersectionObserver)
   ============================================================ */
(function () {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────
  const FRAME_COUNT = 80;
  // Ha a WordPress injectálta a LoricatusData-t, akkor azt használjuk az abszolút eléréshez:
  const basePath = (typeof LoricatusData !== 'undefined' && LoricatusData.themeUri) ? LoricatusData.themeUri + '/' : '';
  const FRAME_PATH = basePath + 'frames2/frame_';
  const FRAME_EXT = '.jpg';
  const FIRST_BATCH = 15;   // első batch gyors betöltés

  // ── CANVAS ─────────────────────────────────────────────────
  const canvas = document.getElementById('scroll-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const frames = new Array(FRAME_COUNT).fill(null);
  let currentFrame = 0;
  let rafId = null;

  // ── RESIZE ─────────────────────────────────────────────────
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(currentFrame);
  }

  // ── DRAW: cover-crop, nincs szürke csík ───────────────────
  function render(index) {
    let img = frames[index];
    if (!img) {
      // Visszafelé keresés: legutolsó betöltött frame
      for (let i = index; i >= 0; i--) {
        if (frames[i]) { img = frames[i]; break; }
      }
    }
    if (!img) return;

    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.max(vw / img.naturalWidth, vh / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(img, (vw - dw) / 2, (vh - dh) / 2, dw, dh);
  }

  // ── SCROLL → FRAME ─────────────────────────────────────────
  function scrub() {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (docH <= 0) return;
    const progress = Math.min(window.scrollY / docH, 1);
    const index = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1);
    if (index !== currentFrame) {
      currentFrame = index;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => render(currentFrame));
    }
  }

  // ── BETÖLTÉS ───────────────────────────────────────────────
  function loadAt(i, cb) {
    const img = new Image();
    img.onload = () => { frames[i] = img; cb && cb(img); };
    img.onerror = () => { cb && cb(null); };
    img.src = `${FRAME_PATH}${String(i + 1).padStart(4, '0')}${FRAME_EXT}`;
  }

  function startLoading() {
    let done = 0;
    for (let i = 0; i < FIRST_BATCH; i++) {
      const idx = i;
      loadAt(idx, () => {
        if (idx === 0) render(0);         // első frame azonnal
        if (++done === FIRST_BATCH) lazyRest();
      });
    }
  }

  function lazyRest() {
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 30));
    let i = FIRST_BATCH;
    function next(dl) {
      while (i < FRAME_COUNT) {
        const idx = i++;
        loadAt(idx, () => {
          if (idx === currentFrame) render(currentFrame);
        });
        if (dl && dl.timeRemaining && dl.timeRemaining() < 4) { idle(next); return; }
      }
    }
    idle(next);
  }

  // ── FLOAT-UP SECTION ANIMATIONS ────────────────────────────
  function initFloatAnimations() {
    const targets = document.querySelectorAll(
      '#services .container, #about .container, ' +
      '#equipment .container, .portfolio-section .container, ' +
      '.testimonials-section .container, #contact .container, ' +
      '.footer .container'
    );
    targets.forEach(el => el.classList.add('sv-float'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('sv-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    targets.forEach(el => observer.observe(el));
  }

  // ── INIT ───────────────────────────────────────────────────
  resize();
  startLoading();
  window.addEventListener('scroll', scrub, { passive: true });
  window.addEventListener('resize', resize, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatAnimations);
  } else {
    initFloatAnimations();
  }

})();
