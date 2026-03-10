/* ============================================================
   SCROLL-VIDEO – Full-page background scrubber
   + Float-up section animations (IntersectionObserver)
   ============================================================ */
(function () {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────
  const FRAME_COUNT = 384; // 16mp @ 24fps
  const FRAME_PATH = 'frames2/frame_';
  const FIRST_BATCH = 12;

  // ── CANVAS SETUP ───────────────────────────────────────────
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

  // ── DRAW (full cover, no grey bars) ────────────────────────
  function render(index) {
    let img = frames[index];
    if (!img) {
      // Visszafelé keresés: utolsó betöltött frame
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

  // ── SCROLL → FRAME (egész oldal) ───────────────────────────
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

  // ── LOAD ───────────────────────────────────────────────────
  function loadAt(i, cb) {
    const img = new Image();
    img.onload = () => { frames[i] = img; cb && cb(img); };
    img.onerror = () => { cb && cb(null); };
    img.src = `${FRAME_PATH}${String(i + 1).padStart(4, '0')}.webp`;
  }

  function startLoading() {
    let done = 0;
    for (let i = 0; i < FIRST_BATCH; i++) {
      const idx = i;
      loadAt(idx, () => {
        if (idx === 0) render(0); // Első frame azonnal megjelenik
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
        loadAt(idx, () => { if (idx === currentFrame) render(currentFrame); });
        if (dl && dl.timeRemaining && dl.timeRemaining() < 4) { idle(next); return; }
      }
    }
    idle(next);
  }

  // ── FLOAT-UP SECTION ANIMATIONS ────────────────────────────
  function initFloatAnimations() {
    // Felvesszük a .sv-float class-t minden fő szekció container-re
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
          observer.unobserve(entry.target); // egyszer elég
        }
      });
    }, { threshold: 0.08 });

    targets.forEach(el => observer.observe(el));
  }

  // ── INIT ───────────────────────────────────────────────────
  resize();
  startLoading();
  window.addEventListener('scroll', scrub, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('DOMContentLoaded', initFloatAnimations);

})();
