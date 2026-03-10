/* ============================================================
   SCROLL-VIDEO – Full-page background video scrubber
   Videó: assets/bg-video.mp4
   Scroll-vezérelt lejátszás: a scroll pozíció mozgatja az időt.
   + Float-up section animations (IntersectionObserver)
   ============================================================ */
(function () {
  'use strict';

  // ── VIDEO ELEM LÉTREHOZÁSA ──────────────────────────────────
  const canvas = document.getElementById('scroll-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const video = document.createElement('video');
  video.src = 'assets/bg-video.mp4';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.loop = false;
  video.style.display = 'none';
  document.body.appendChild(video);

  let rafId = null;
  let isReady = false;

  // ── RESIZE ─────────────────────────────────────────────────
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (isReady) drawFrame();
  }

  // ── DRAW: middle-crop cover ─────────────────────────────────
  function drawFrame() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vRatio = video.videoWidth / video.videoHeight;
    const cRatio = vw / vh;

    let sw, sh, sx, sy;
    if (vRatio > cRatio) {
      // videó szélesebb – oldalakat vágjuk
      sh = video.videoHeight;
      sw = Math.round(sh * cRatio);
      sx = Math.round((video.videoWidth - sw) / 2);
      sy = 0;
    } else {
      // videó magasabb – tetejét/alját vágjuk
      sw = video.videoWidth;
      sh = Math.round(sw / cRatio);
      sx = 0;
      sy = Math.round((video.videoHeight - sh) / 2);
    }

    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh);
  }

  // ── SCROLL → VIDEÓIDŐ ──────────────────────────────────────
  function scrub() {
    if (!isReady || !video.duration) return;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (docH <= 0) return;
    const progress = Math.min(window.scrollY / docH, 1);
    const targetTime = progress * video.duration;

    // Beállítjuk az időt (ez pausolt videónál is működik)
    if (Math.abs(video.currentTime - targetTime) > 0.05) {
      video.currentTime = targetTime;
    }
  }

  // Minden frame-en kirajzoljuk a videót (akkor is, ha az időpont frissül)
  function renderLoop() {
    if (isReady) drawFrame();
    rafId = requestAnimationFrame(renderLoop);
  }

  // ── INIT ───────────────────────────────────────────────────
  video.addEventListener('loadedmetadata', () => {
    isReady = true;
    video.currentTime = 0;
    resize();
    renderLoop();
  });

  // Ha a böngésző azonnal betölti (cache)
  if (video.readyState >= 1) {
    isReady = true;
    resize();
    renderLoop();
  }

  window.addEventListener('scroll', scrub, { passive: true });
  window.addEventListener('resize', resize, { passive: true });

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

  document.addEventListener('DOMContentLoaded', initFloatAnimations);
  // Ha DOMContentLoaded már lefutott
  if (document.readyState !== 'loading') initFloatAnimations();

  resize();

})();
