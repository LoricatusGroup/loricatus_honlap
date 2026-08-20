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
  // A statikus HTML a valódi számot tartalmazza, mert a JavaScriptet nem futtató
  // olvasók (AI-crawlerek, kikapcsolt JS) különben nullát látnának ott, ahol
  // "500+ elvégzett projekt" áll. A nullázás ezért ide költözött: a látogató
  // ugyanúgy nulláról felfutó számot lát, mint eddig.
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    el.textContent = '0';
    counterObs.observe(el);
  });

  /* ── CONTACT FORM ────────────────────────────── */
  // Self-hosted submission via the Supabase submit-form edge function
  // (Cloudflare Turnstile-verified) — replaces web3forms. All values here are
  // public: the anon key is RLS-protected and the Turnstile SITE key is meant
  // to be public. The matching Turnstile SECRET key lives in the edge function.
  const SUPABASE_URL = 'https://rksqwamubvnxuthumphi.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrc3F3YW11YnZueHV0aHVtcGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjcwNjIsImV4cCI6MjA5Mzg0MzA2Mn0.VuZYXK1-cQRcuPh4Q7YIVSg5XtLIT1h1NeqmvluOCmY';
  const SITE_ID = 'a7a65c78-972a-4d83-8983-bbce5e6c5a47';
  // Cloudflare Turnstile SITE key (public; the matching SECRET lives in the edge fn).
  const TURNSTILE_SITE_KEY = '0x4AAAAAADyYgSETLNJAc7SW';
  const SUBMIT_FORM_URL = SUPABASE_URL + '/functions/v1/submit-form';
  const pageLang = (document.documentElement.lang || 'hu').toLowerCase();
  const formMessages = pageLang.startsWith('en')
    ? {
        subject: 'New quote request - Loricatus website',
        sending: 'Sending...',
        errorRetry: 'Error - please try again'
      }
    : pageLang.startsWith('it')
      ? {
          subject: 'Nuova richiesta di preventivo - sito Loricatus',
          sending: 'Invio in corso...',
          errorRetry: 'Errore - riprova'
        }
      : {
          subject: 'Új árajánlatkérés - Loricatus honlap',
          sending: 'Küldés...',
          errorRetry: 'Hiba - próbálja újra'
        };
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnArrow = document.getElementById('btnArrow');
  const btnLoader = document.getElementById('btnLoader');
  const formSuccess = document.getElementById('formSuccess');
  const defaultSubmitLabel = btnText ? btnText.textContent : '';

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

    // Lazy-load Turnstile only when the visitor approaches the contact form.
    // It's a heavy third-party captcha and nobody needs it until they reach the
    // form — keeping it off the initial load (and out of the speed test) while
    // still rendering well before the user could submit.
    let turnstileWidgetId = null;
    let turnstileStarted = false;
    function startTurnstile() {
      if (turnstileStarted) return;
      turnstileStarted = true;
      if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
        const ts = document.createElement('script');
        ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        ts.async = true; ts.defer = true;
        document.head.appendChild(ts);
      }
      const turnstileEl = document.getElementById('cfTurnstile');
      (function renderTurnstile() {
        if (turnstileEl && window.turnstile && turnstileWidgetId === null) {
          turnstileWidgetId = window.turnstile.render(turnstileEl, { sitekey: TURNSTILE_SITE_KEY });
        } else if (turnstileWidgetId === null) {
          setTimeout(renderTurnstile, 200);
        }
      })();
    }
    // Trigger: contact section scrolls near (400px early) OR first field focus.
    const contactSection = document.getElementById('contact') || form;
    if ('IntersectionObserver' in window && contactSection) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) { startTurnstile(); io.disconnect(); }
      }, { rootMargin: '400px' });
      io.observe(contactSection);
    } else {
      startTurnstile(); // no IO support → fall back to eager load
    }
    [nameInput, emailInput, serviceInput, messageInput].forEach(
      el => el && el.addEventListener('focus', startTurnstile, { once: true })
    );

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v1 = validateField(nameInput, 'nameError', v => v.length >= 2);
      const v2 = validateField(emailInput, 'emailError', isEmail);
      const v3 = validateField(serviceInput, 'serviceError', v => v !== '');
      const v4 = validateField(messageInput, 'messageError', v => v.length >= 10);
      const gdpr = document.getElementById('gdpr');
      if (!gdpr.checked || !v1 || !v2 || !v3 || !v4) return;

      submitBtn.disabled = true;
      btnText.textContent = formMessages.sending;
      if (btnArrow) btnArrow.style.display = 'none';
      if (btnLoader) btnLoader.style.display = 'inline-block';

      try {
        const token = (window.turnstile && turnstileWidgetId !== null)
          ? window.turnstile.getResponse(turnstileWidgetId) : '';
        if (!token) throw new Error('captcha');
        const res = await fetch(SUBMIT_FORM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            site_id: SITE_ID,
            token: token,
            website: (document.getElementById('website') || {}).value || '',
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            company: document.getElementById('company').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            service: serviceInput.value,
            message: messageInput.value.trim()
          })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.success) throw new Error(result.error || 'Hiba');
        submitBtn.style.display = 'none';
        formSuccess.style.display = 'flex';
        form.querySelectorAll('input,select,textarea').forEach(el => {
          el.disabled = true;
          el.style.opacity = '0.5';
        });
      } catch {
        if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
        btnText.textContent = formMessages.errorRetry;
        if (btnArrow) btnArrow.style.display = 'inline';
        if (btnLoader) btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.background = '#ff6b6b';
        submitBtn.style.color = '#fff';
        setTimeout(() => {
          btnText.textContent = defaultSubmitLabel;
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

  if (lightbox && lbImg && lbCat && lbTitle && lbDesc && lbCount && cards.length > 0) {
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
  }

  /* ── COOKIE + consent-gated analytics ──────────── */
  // Analytics (Microsoft Clarity + Google Analytics) load ONLY after the
  // visitor accepts cookies (GDPR) — never before, and never during automated
  // speed tests (which don't consent). Both loaders are idempotent.
  function loadClarity() {
    if (window.__clarityLoaded) return;
    window.__clarityLoaded = true;
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "wn1ca1y5p5");
  }

  // Google Analytics 4 (gtag.js).
  var GA_MEASUREMENT_ID = 'G-LHG57EDJJQ';
  function loadGoogleAnalytics() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
  }

  function loadAnalytics() {
    loadClarity();
    loadGoogleAnalytics();
  }
  // Returning visitor who already accepted → load on this pageview too.
  if (localStorage.getItem('cookie_consent') === 'accepted') loadAnalytics();

  const cookieBanner = document.getElementById('cookieBanner');
  if (cookieBanner && !localStorage.getItem('cookie_consent')) {
    setTimeout(() => cookieBanner.classList.add('visible'), 1200);
    document.getElementById('cookieAccept')?.addEventListener('click', () => {
      localStorage.setItem('cookie_consent', 'accepted');
      cookieBanner.classList.remove('visible');
      loadAnalytics(); // consent given → start analytics now
    });
    document.getElementById('cookieDecline')?.addEventListener('click', () => {
      localStorage.setItem('cookie_consent', 'declined');
      cookieBanner.classList.remove('visible');
    });
  }

  // ── AI-összehasonlító gombok ────────────────────────────────────────────
  // A kérdést a <head> egy meta mezője tárolja, mert így a CMS-ből
  // szerkeszthető anélkül, hogy megjelenne az oldal szövegében -- oda nem
  // való, és az oldalt olvasó asszisztenst is összezavarná.
  //
  // A linkekben publikáláskor már benne van a helyes cím, ez a rész csak
  // újraszámolja: ha a tulajdonos átírja a kérdést a szerkesztőben, a gombok
  // JavaScript nélkül is a legutóbb publikált kérdéssel működnek tovább.
  const aiPrompt = document
    .querySelector('meta[name="ai-compare-prompt"]')
    ?.getAttribute('content')
    ?.trim();
  if (aiPrompt) {
    // A hints=search rábírja a ChatGPT-t, hogy tényleg nézze meg az oldalt,
    // ne emlékezetből válaszoljon. Mindhárom paraméter dokumentálatlan, ezért
    // a publikáláskor beégetett cím a biztos pont, ez csak ráerősít.
    const targets = {
      chatgpt: (q) => `https://chatgpt.com/?hints=search&q=${q}`,
      claude: (q) => `https://claude.ai/new?q=${q}`,
      perplexity: (q) => `https://www.perplexity.ai/search?q=${q}`,
    };
    const q = encodeURIComponent(aiPrompt);
    document.querySelectorAll('[data-ai-service]').forEach((a) => {
      const make = targets[a.getAttribute('data-ai-service')];
      if (make) a.href = make(q);
    });
  }

})();
