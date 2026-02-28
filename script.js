/* =============================================
   LORICATUS – Premium Drone Company
   JavaScript: Animations, Parallax, Counters,
   Form Validation, Hero Canvas, Nav,
   Lightbox, EmailJS, Cookie Banner
   ============================================= */

(function () {
  'use strict';

  /* ── NAVBAR SCROLL BEHAVIOR ────────────────── */
  const navbar = document.getElementById('navbar');
  const navLinks = document.getElementById('navLinks');
  const hamburger = document.getElementById('hamburger');
  const allNavLinks = document.querySelectorAll('.nav-links a:not(.nav-cta-link)');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    updateActiveNavLink();
  }, { passive: true });

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  // Close mobile nav when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  function updateActiveNavLink() {
    const sections = ['hero', 'services', 'about', 'equipment', 'portfolio', 'contact'];
    let current = '';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) {
        current = id;
      }
    });
    allNavLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  /* ── SCROLL REVEAL (Intersection Observer) ── */
  const revealEls = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 0px 0px' });

  revealEls.forEach(el => revealObserver.observe(el));

  /* ── ANIMATED COUNTERS ─────────────────────── */
  const counters = document.querySelectorAll('.stat-num');
  let countersStarted = false;

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  function animateCounters() {
    counters.forEach(counter => {
      const target = parseInt(counter.dataset.target, 10);
      const duration = 2000;
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        counter.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(update);
      }

      requestAnimationFrame(update);
    });
  }

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    const statsObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !countersStarted) {
        countersStarted = true;
        animateCounters();
        statsObserver.disconnect();
      }
    }, { threshold: 0.5 });
    statsObserver.observe(heroStats);
  } else {
    setTimeout(animateCounters, 800);
  }

  /* ── HERO PARALLAX ─────────────────────────── */
  const heroParallax = document.getElementById('heroParallax');

  window.addEventListener('scroll', () => {
    if (!heroParallax) return;
    const scrolled = window.scrollY;
    const rate = scrolled * 0.35;
    heroParallax.style.transform = `scale(1.05) translateY(${rate}px)`;
  }, { passive: true });

  /* ── HERO CANVAS – Floating Grid / Particles ─ */
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');

  let W, H, particles = [], animFrameId;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x = Math.random() * W;
      this.y = initial ? Math.random() * H : H + 10;
      this.vy = -(0.15 + Math.random() * 0.4);
      this.vx = (Math.random() - 0.5) * 0.2;
      this.size = 1 + Math.random() * 1.5;
      this.alpha = 0;
      this.alphaMax = 0.15 + Math.random() * 0.35;
      this.fade = 'in';
      this.life = 0;
      this.maxLife = 200 + Math.random() * 300;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life++;
      if (this.fade === 'in') {
        this.alpha = Math.min(this.alpha + 0.008, this.alphaMax);
        if (this.alpha >= this.alphaMax) this.fade = 'hold';
      }
      if (this.life > this.maxLife) this.fade = 'out';
      if (this.fade === 'out') {
        this.alpha -= 0.006;
        if (this.alpha <= 0) this.reset();
      }
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.fillStyle = '#C5FF2B';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGrid() {
    const spacing = 80;
    ctx.save();
    ctx.strokeStyle = 'rgba(197, 255, 43, 0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawConnections() {
    const maxDist = 100;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.08;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#C5FF2B';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function initCanvas() {
    resize();
    particles = [];
    const count = Math.floor((W * H) / 14000);
    for (let i = 0; i < count; i++) particles.push(new Particle());
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    animFrameId = requestAnimationFrame(loop);
  }

  const heroSection = document.getElementById('hero');
  const canvasObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      if (!animFrameId) loop();
    } else {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }, { threshold: 0 });

  if (heroSection) canvasObserver.observe(heroSection);

  window.addEventListener('resize', () => {
    resize();
    particles = [];
    const count = Math.floor((W * H) / 14000);
    for (let i = 0; i < count; i++) particles.push(new Particle());
  }, { passive: true });

  initCanvas();
  loop();

  /* ── PORTFOLIO LIGHTBOX ─────────────────────── */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCat = document.getElementById('lightboxCat');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxDesc = document.getElementById('lightboxDesc');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const portfolioCards = document.querySelectorAll('.portfolio-card');

  let lightboxItems = [];
  let lightboxIndex = 0;

  // Collect portfolio data
  portfolioCards.forEach((card) => {
    const img = card.querySelector('.portfolio-img');
    const cat = card.querySelector('.portfolio-cat');
    const title = card.querySelector('.portfolio-overlay h3');
    const desc = card.querySelector('.portfolio-overlay p');

    lightboxItems.push({
      src: img ? img.src : '',
      alt: img ? img.alt : '',
      cat: cat ? cat.textContent : '',
      title: title ? title.innerHTML : '',
      desc: desc ? desc.textContent : ''
    });

    card.addEventListener('click', () => {
      lightboxIndex = lightboxItems.indexOf(
        lightboxItems.find(item => item.src === img.src && item.title === title.innerHTML)
      );
      openLightbox();
    });
  });

  function openLightbox() {
    updateLightboxContent();
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateLightboxContent() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    lightboxImg.src = item.src;
    lightboxImg.alt = item.alt;
    lightboxCat.textContent = item.cat;
    lightboxTitle.innerHTML = item.title;
    lightboxDesc.textContent = item.desc;
    lightboxCounter.textContent = (lightboxIndex + 1) + ' / ' + lightboxItems.length;
  }

  function lightboxPrev() {
    lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
    updateLightboxContent();
  }

  function lightboxNext() {
    lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
    updateLightboxContent();
  }

  if (lightbox) {
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', lightboxPrev);
    lightbox.querySelector('.lightbox-next').addEventListener('click', lightboxNext);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
    });

    // Touch swipe support
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(diff) > 60) {
        if (diff > 0) lightboxPrev();
        else lightboxNext();
      }
    }, { passive: true });
  }

  /* ── CONTACT FORM (EmailJS) ────────────────── */
  // ── EmailJS Configuration ──
  // To activate EmailJS:
  // 1. Create an account at https://www.emailjs.com
  // 2. Create an email service and template
  // 3. Replace the values below with your own:
  const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
  const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
  const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';

  // Initialize EmailJS if configured
  const emailjsReady = EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY'
    && typeof emailjs !== 'undefined';
  if (emailjsReady) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnArrow = document.getElementById('btnArrow');
  const btnLoader = document.getElementById('btnLoader');
  const formSuccess = document.getElementById('formSuccess');

  function validateField(input, errorId, validator) {
    const group = input.closest('.form-group');
    const error = document.getElementById(errorId);
    if (!validator(input.value.trim())) {
      group.classList.add('error');
      if (error) error.style.display = 'block';
      return false;
    } else {
      group.classList.remove('error');
      if (error) error.style.display = 'none';
      return true;
    }
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  if (form) {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const serviceInput = document.getElementById('service');
    const messageInput = document.getElementById('message');

    nameInput.addEventListener('blur', () =>
      validateField(nameInput, 'nameError', v => v.length >= 2));
    emailInput.addEventListener('blur', () =>
      validateField(emailInput, 'emailError', isValidEmail));
    serviceInput.addEventListener('blur', () =>
      validateField(serviceInput, 'serviceError', v => v !== ''));
    messageInput.addEventListener('blur', () =>
      validateField(messageInput, 'messageError', v => v.length >= 10));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const v1 = validateField(nameInput, 'nameError', v => v.length >= 2);
      const v2 = validateField(emailInput, 'emailError', isValidEmail);
      const v3 = validateField(serviceInput, 'serviceError', v => v !== '');
      const v4 = validateField(messageInput, 'messageError', v => v.length >= 10);

      const gdpr = document.getElementById('gdpr');
      if (!gdpr.checked) {
        gdpr.closest('.form-check').style.outline = '1px solid rgba(255,107,107,0.5)';
        gdpr.closest('.form-check').style.borderRadius = '8px';
        gdpr.closest('.form-check').style.padding = '8px';
        return;
      } else {
        gdpr.closest('.form-check').style.outline = '';
        gdpr.closest('.form-check').style.padding = '';
      }

      if (!v1 || !v2 || !v3 || !v4) return;

      // Show loading state
      submitBtn.disabled = true;
      btnText.textContent = 'Küldés...';
      btnArrow.style.display = 'none';
      btnLoader.style.display = 'inline-block';

      try {
        if (emailjsReady) {
          // Send via EmailJS
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            from_name: nameInput.value.trim(),
            from_email: emailInput.value.trim(),
            company: document.getElementById('company').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            service: serviceInput.value,
            message: messageInput.value.trim()
          });
        } else {
          // Fallback: simulate sending (EmailJS not configured)
          await new Promise(r => setTimeout(r, 1800));
        }

        // Show success
        submitBtn.style.display = 'none';
        formSuccess.style.display = 'flex';
        form.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = true;
          el.style.opacity = '0.5';
        });
      } catch (err) {
        // Show error state
        btnText.textContent = 'Hiba történt – próbálja újra';
        btnArrow.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.background = '#ff6b6b';
        submitBtn.style.color = '#fff';
        setTimeout(() => {
          btnText.textContent = 'Küldöm az ajánlatkérést';
          submitBtn.style.background = '';
          submitBtn.style.color = '';
        }, 3000);
      }
    });
  }

  /* ── SMOOTH HOVER GLOW FOLLOW (cards) ──────── */
  document.querySelectorAll('.service-card, .equipment-card, .testi-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', x + '%');
      card.style.setProperty('--mouse-y', y + '%');
    });
  });

  /* ── COOKIE CONSENT BANNER ─────────────────── */
  const cookieBanner = document.getElementById('cookieBanner');
  const cookieAccept = document.getElementById('cookieAccept');
  const cookieDecline = document.getElementById('cookieDecline');

  function getCookieConsent() {
    return localStorage.getItem('loricatus_cookie_consent');
  }

  function setCookieConsent(value) {
    localStorage.setItem('loricatus_cookie_consent', value);
  }

  if (cookieBanner && !getCookieConsent()) {
    // Show banner after a short delay for better UX
    setTimeout(() => {
      cookieBanner.classList.add('visible');
      cookieBanner.setAttribute('aria-hidden', 'false');
    }, 1500);
  }

  if (cookieAccept) {
    cookieAccept.addEventListener('click', () => {
      setCookieConsent('accepted');
      cookieBanner.classList.remove('visible');
      cookieBanner.setAttribute('aria-hidden', 'true');
    });
  }

  if (cookieDecline) {
    cookieDecline.addEventListener('click', () => {
      setCookieConsent('declined');
      cookieBanner.classList.remove('visible');
      cookieBanner.setAttribute('aria-hidden', 'true');
    });
  }

  /* ── FOOTER YEAR ───────────────────────────── */
  const yearSpan = document.querySelector('.footer-bottom-inner span');
  if (yearSpan) {
    const year = new Date().getFullYear();
    yearSpan.textContent = yearSpan.textContent.replace('2025', year);
  }

})();
