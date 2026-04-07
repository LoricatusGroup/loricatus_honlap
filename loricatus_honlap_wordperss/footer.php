<!-- =================== FOOTER =================== -->
<footer class="footer">
    <div class="footer-top">
        <div class="container footer-grid">
            <div class="footer-brand">
                <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/logo.svg"
                    alt="<?php bloginfo('name'); ?>" class="footer-logo" />
                <p>Professzionális drónszolgáltatások ipari és kereskedelmi ügyfelek számára. EU-konform, engedéllyel
                    rendelkező operátor.</p>
                <div class="footer-social">
                    <a href="#" aria-label="Facebook" class="social-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                        </svg>
                    </a>
                    <a href="#" aria-label="LinkedIn" class="social-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                            <rect x="2" y="9" width="4" height="12" />
                            <circle cx="4" cy="4" r="2" />
                        </svg>
                    </a>
                    <a href="#" aria-label="Instagram" class="social-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                        </svg>
                    </a>
                    <a href="#" aria-label="YouTube" class="social-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path
                                d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                            <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
                        </svg>
                    </a>
                </div>
            </div>
            <div class="footer-col">
                <h4>Szolgáltatások</h4>
                <ul>
                    <li><a href="#services">Légi fotó &amp; videó</a></li>
                    <li><a href="#services">Felmérés &amp; térképezés</a></li>
                    <li><a href="#services">Épületinspekció</a></li>
                    <li><a href="#services">LiDAR szkennelés</a></li>
                    <li><a href="#services">Hőkamera &amp; termográfia</a></li>
                    <li><a href="#services">Precíziós mezőgazdaság</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Vállalat</h4>
                <ul>
                    <li><a href="#about">Rólunk</a></li>
                    <li><a href="#equipment">Eszközpark</a></li>
                    <li><a href="#portfolio">Referenciák</a></li>
                    <li><a href="#contact">Kapcsolat</a></li>
                    <li><a href="#">Adatkezelés</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Elérhetőség</h4>
                <ul class="footer-contact-list">
                    <li><a href="tel:+36301234567">+36 30 123 4567</a></li>
                    <li><a href="mailto:info@loricatus.hu">info@loricatus.hu</a></li>
                    <li>Budapest, Magyarország</li>
                    <li class="footer-hours">H–P: 9:00–18:00</li>
                </ul>
                <button class="btn btn-primary btn-sm"
                    onclick="document.getElementById('contact').scrollIntoView({behavior:'smooth'})">
                    Ajánlatkérés
                </button>
            </div>
        </div>
    </div>
    <div class="footer-bottom">
        <div class="container footer-bottom-inner">
            <span>&copy;
                <?php echo date('Y'); ?>
                <?php bloginfo('name'); ?>. Minden jog fenntartva.
            </span>
            <span>Engedélyezett EU drónoperátor &middot; A2 CofC</span>
        </div>
    </div>
</footer>

<!-- =================== COOKIE BANNER =================== -->
<div id="cookieBanner" class="cookie-banner" aria-hidden="true">
    <div class="cookie-inner">
        <div class="cookie-text">
            <p>Ez a weboldal sütiket használ a legjobb felhasználói élmény biztosítása érdekében. A böngészés
                folytatásával Ön elfogadja a <a href="#">sütikezelési szabályzatunkat</a>.</p>
        </div>
        <div class="cookie-actions">
            <button class="cookie-btn cookie-btn-accept" id="cookieAccept">Elfogadom</button>
            <button class="cookie-btn cookie-btn-decline" id="cookieDecline">Elutasítom</button>
        </div>
    </div>
</div>

<?php wp_footer(); ?>
</body>

</html>