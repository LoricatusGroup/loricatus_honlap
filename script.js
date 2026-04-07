/* =============================================
   LORICATUS – Minimal JS
   Nav · Reveal · Counters · Form · Cookie
   ============================================= */

(function () {
  'use strict';

  /* ── NAV ─────────────────────────────────────── */
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  const updateNavbarState = () => {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  };

  window.addEventListener('scroll', updateNavbarState, { passive: true });
  updateNavbarState();

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  /* Active nav link on scroll */
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navAnchors.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));

  /* ── SCROLL REVEAL ───────────────────────────── */
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  /* ── COUNTERS ────────────────────────────────── */
  function animateCounter(el) {
    const target = +el.dataset.target;
    const duration = 1400;
    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(ease * target);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    };
    requestAnimationFrame(step);
  }

  const counterObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCounter(e.target);
        counterObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num[data-target]').forEach(el => counterObs.observe(el));

  /* ── CONTACT FORM ────────────────────────────── */
  const WEB3FORMS_ACCESS_KEY = 'f2a2064b-f35f-4864-a1a3-a56dcf4644b4';
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnArrow = document.getElementById('btnArrow');
  const btnLoader = document.getElementById('btnLoader');
  const formSuccess = document.getElementById('formSuccess');

  function validateField(input, errorId, validator) {
    const group = input.closest('.form-group');
    const error = document.getElementById(errorId);
    const ok = validator(input.value.trim());
    group.classList.toggle('error', !ok);
    if (error) error.style.display = ok ? 'none' : 'block';
    return ok;
  }
  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  if (form) {
    const nameInput    = document.getElementById('name');
    const emailInput   = document.getElementById('email');
    const serviceInput = document.getElementById('service');
    const messageInput = document.getElementById('message');

    nameInput.addEventListener('blur',    () => validateField(nameInput, 'nameError', v => v.length >= 2));
    emailInput.addEventListener('blur',   () => validateField(emailInput, 'emailError', isEmail));
    serviceInput.addEventListener('blur', () => validateField(serviceInput, 'serviceError', v => v !== ''));
    messageInput.addEventListener('blur', () => validateField(messageInput, 'messageError', v => v.length >= 10));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v1 = validateField(nameInput, 'nameError', v => v.length >= 2);
      const v2 = validateField(emailInput, 'emailError', isEmail);
      const v3 = validateField(serviceInput, 'serviceError', v => v !== '');
      const v4 = validateField(messageInput, 'messageError', v => v.length >= 10);
      const gdpr = document.getElementById('gdpr');
      if (!gdpr.checked || !v1 || !v2 || !v3 || !v4) return;

      submitBtn.disabled = true;
      btnText.textContent = 'Küldés...';
      if (btnArrow) btnArrow.style.display = 'none';
      if (btnLoader) btnLoader.style.display = 'inline-block';

      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: 'Új árajánlatkérés – Loricatus honlap',
            from_name: nameInput.value.trim(),
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            company: document.getElementById('company').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            service: serviceInput.value,
            message: messageInput.value.trim()
          })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message || 'Hiba');
        submitBtn.style.display = 'none';
        formSuccess.style.display = 'flex';
        form.querySelectorAll('input,select,textarea').forEach(el => {
          el.disabled = true;
          el.style.opacity = '0.5';
        });
      } catch {
        btnText.textContent = 'Hiba – próbálja újra';
        if (btnArrow) btnArrow.style.display = 'inline';
        if (btnLoader) btnLoader.style.display = 'none';
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

  /* ── LIGHTBOX ────────────────────────────────── */
  const lightbox = document.getElementById('lightbox');
  const lbImg    = document.getElementById('lightboxImg');
  const lbCat    = document.getElementById('lightboxCat');
  const lbTitle  = document.getElementById('lightboxTitle');
  const lbDesc   = document.getElementById('lightboxDesc');
  const lbCount  = document.getElementById('lightboxCounter');
  const cards    = Array.from(document.querySelectorAll('.portfolio-card'));
  let current    = 0;

  function openLightbox(i) {
    current = i;
    const card = cards[i];
    const img = card.querySelector('.portfolio-img');
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCat.textContent   = card.querySelector('.portfolio-cat')?.textContent || '';
    lbTitle.textContent = card.querySelector('h3')?.textContent || '';
    lbDesc.textContent  = card.querySelector('p')?.textContent || '';
    lbCount.textContent = `${i + 1} / ${cards.length}`;
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  cards.forEach((card, i) => card.addEventListener('click', () => openLightbox(i)));
  document.querySelector('.lightbox-close')?.addEventListener('click', closeLightbox);
  document.querySelector('.lightbox-backdrop')?.addEventListener('click', closeLightbox);
  document.querySelector('.lightbox-prev')?.addEventListener('click', () => openLightbox((current - 1 + cards.length) % cards.length));
  document.querySelector('.lightbox-next')?.addEventListener('click', () => openLightbox((current + 1) % cards.length));
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') openLightbox((current - 1 + cards.length) % cards.length);
    if (e.key === 'ArrowRight') openLightbox((current + 1) % cards.length);
  });

  /* ── COOKIE ──────────────────────────────────── */
  const cookieBanner = document.getElementById('cookieBanner');
  if (cookieBanner && !localStorage.getItem('cookie_consent')) {
    setTimeout(() => cookieBanner.classList.add('visible'), 1200);
    document.getElementById('cookieAccept')?.addEventListener('click', () => {
      localStorage.setItem('cookie_consent', 'accepted');
      cookieBanner.classList.remove('visible');
    });
    document.getElementById('cookieDecline')?.addEventListener('click', () => {
      localStorage.setItem('cookie_consent', 'declined');
      cookieBanner.classList.remove('visible');
    });
  }

})();
