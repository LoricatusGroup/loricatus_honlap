<?php
/**
 * The main template file
 *
 * @package loricatus
 */

get_header(); ?>

<!-- =================== HERO =================== -->
<section id="hero" class="hero">
    <div class="hero-bg">
        <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/hero-bg.png"
            alt="Loricatus légi felvétel" class="hero-img" id="heroParallax" />
        <div class="hero-overlay"></div>
    </div>
    <canvas id="heroCanvas" class="hero-canvas"></canvas>
    <div class="hero-content fade-in-up">
        <div class="hero-badge">
            <span class="badge-dot"></span>
            Engedélyezett drónoperátor &middot; A2 CofC engedély
        </div>
        <h1 class="hero-title">
            Lásd át<br />
            <span class="accent-text">a világot!</span>
        </h1>
        <p class="hero-subtitle">
            Professzionális drónszolgáltatások ipari, építészeti és mérnöki feladatokra.<br />
            Precizitás a levegőből &ndash; ott, ahol a részletek számítanak.
        </p>
        <div class="hero-actions">
            <button class="btn btn-primary"
                onclick="document.getElementById('contact').scrollIntoView({behavior:'smooth'})">
                Kérjen ajánlatot
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
            </button>
            <button class="btn btn-secondary"
                onclick="document.getElementById('services').scrollIntoView({behavior:'smooth'})">
                Szolgáltatásaink
            </button>
        </div>
    </div>
    <div class="hero-scroll-indicator">
        <div class="scroll-line"></div>
        <span>Görgessen le</span>
    </div>

    <!-- Stats strip at bottom of hero -->
    <div class="hero-stats">
        <div class="hero-stat">
            <span class="stat-num" data-target="500">0</span><span class="stat-suffix">+</span>
            <span class="stat-label">Elvégzett projekt</span>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
            <span class="stat-num" data-target="1200">0</span><span class="stat-suffix">+</span>
            <span class="stat-label">Repülési óra</span>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
            <span class="stat-num" data-target="98">0</span><span class="stat-suffix">%</span>
            <span class="stat-label">Ügyfél-elégedettség</span>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
            <span class="stat-num" data-target="8">0</span><span class="stat-suffix">+</span>
            <span class="stat-label">Év tapasztalat</span>
        </div>
    </div>
</section>

<!-- =================== SERVICES =================== -->
<section id="services" class="services section">
    <div class="section-bg-label">02 / SZOLGÁLTATÁSOK</div>
    <div class="container">
        <div class="section-header reveal">
            <div class="section-tag">Mit nyújtunk</div>
            <h2 class="section-title">Teljes körű drón<br /><span class="accent-text">megoldások</span></h2>
            <p class="section-desc">Ipari precizitás, professzionális technológia &ndash; minden projekthez a legjobb
                eszköz.</p>
        </div>
        <div class="services-grid">

            <div class="service-card reveal" style="--delay: 0.05s">
                <div class="service-icon">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="24" cy="24" r="10" stroke="currentColor" stroke-width="2" />
                        <path
                            d="M24 4v4M24 40v4M4 24h4M40 24h4M8.69 8.69l2.83 2.83M36.48 36.48l2.83 2.83M36.48 11.52l-2.83 2.83M11.52 36.48l-2.83 2.83"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                </div>
                <h3>Légi Fotó & Videó</h3>
                <p>Cinema-minőségű légi felvételek ingatlanokról, rendezvényekről, természeti tájakról. 4K–8K
                    felbontásban, stabilizált gimbalrendszerrel.</p>
                <a href="#contact" class="service-link">Ajánlatkérés <span>→</span></a>
            </div>

            <div class="service-card reveal" style="--delay: 0.1s">
                <div class="service-icon">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="6" y="6" width="36" height="36" rx="3" stroke="currentColor" stroke-width="2" />
                        <path d="M6 18h36M18 6v36" stroke="currentColor" stroke-width="2" />
                        <circle cx="30" cy="30" r="4" stroke="currentColor" stroke-width="2" />
                    </svg>
                </div>
                <h3>Felmérés & Térképezés</h3>
                <p>Centiméteres pontosságú GIS-alapú térképek és digitális terepmodellek. RTK-GNSS technológiával, valós
                    idejű korrekciókkal.</p>
                <a href="#contact" class="service-link">Ajánlatkérés <span>→</span></a>
            </div>

            <div class="service-card reveal" style="--delay: 0.15s">
                <div class="service-icon">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 38V20M24 38V10M36 38V28" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" />
                        <rect x="6" y="38" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
                    </svg>
                </div>
                <h3>Épületinspekció</h3>
                <p>Hidak, toronyházak, ipari létesítmények biztonságos és alapos vizsgálata emberi belépés nélkül.
                    Részletes hibatérkép és riport.</p>
                <a href="#contact" class="service-link">Ajánlatkérés <span>→</span></a>
            </div>

            <div class="service-card reveal" style="--delay: 0.2s">
                <div class="service-icon">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 40L24 8l16 32H8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                        <path d="M16 32h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                </div>
                <h3>LiDAR Szkennelés</h3>
                <p>Milliméteres pontosságú 3D pontfelhő modellek épületekről, terepről, infrastruktúráról. Ideális BIM
                    és mérnöki tervezéshez.</p>
                <a href="#contact" class="service-link">Ajánlatkérés <span>→</span></a>
            </div>

            <div class="service-card reveal" style="--delay: 0.25s">
                <div class="service-icon">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2" />
                        <path d="M24 8v4M24 36v4M8 24h4M36 24h4" stroke="currentColor" stroke-width="2"
                            stroke-linecap="round" />
                        <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.15" stroke="currentColor"
                            stroke-width="2" />
                    </svg>
                </div>
                <h3>Hőkamera & Termográfia</h3>
                <p>Hőveszteség-detektálás épületeken, fotovoltaikus panelek vizsgálata, ipari hőtérkép. Gyors,
                    megbízható diagnózis.</p>
                <a href="#contact" class="service-link">Ajánlatkérés <span>→</span></a>
            </div>

            <div class="service-card reveal" style="--delay: 0.3s">
                <div class="service-icon">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 36c6-12 30-12 36 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                        <path d="M14 28c4-8 16-8 20 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                        <circle cx="24" cy="22" r="4" stroke="currentColor" stroke-width="2" />
                    </svg>
                </div>
                <h3>Precíziós Mezőgazdaság</h3>
                <p>Multispektrális indexek (NDVI, NDRE), terméshozam-előrejelzés, növényvédelmi permetező drónok. Okos
                    gazdálkodás levegőből.</p>
                <a href="#contact" class="service-link">Ajánlatkérés <span>→</span></a>
            </div>

        </div>
    </div>
</section>

<!-- =================== ABOUT =================== -->
<section id="about" class="about section">
    <div class="section-bg-label">03 / RÓLUNK</div>
    <div class="container about-container">
        <div class="about-visual reveal">
            <div class="about-img-wrap">
                <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/services-bg.png"
                    alt="Loricatus drónos szakértelem" class="about-img" />
                <div class="about-img-badge">
                    <span class="badge-num">8+</span>
                    <span>év<br />tapasztalat</span>
                </div>
            </div>
            <div class="about-cert-row">
                <div class="cert-pill">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    A2 CofC engedély
                </div>
                <div class="cert-pill">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Légiügyi engedélyek
                </div>
            </div>
        </div>
        <div class="about-content reveal">
            <div class="section-tag">A Loricatus különbsége</div>
            <h2 class="section-title">Ahol a technológia<br /><span class="accent-text">találkozik a
                    precizitással</span></h2>
            <p class="about-lead">
                A Loricatus nem csupán drónokat reptet &ndash; <strong>megoldásokat épít</strong>. Csapatunk
                mérnökökből,
                geodétákból és légtér-szakértőkből áll, akik együtt gondolkodnak az Ön feladatán, és az iparág
                legfejlettebb technológiájával hajtják végre.
            </p>
            <p class="about-body">
                Minden felszállás mögött alapos tervezés, engedélyek és biztonsági protokollok állnak. Legyen szó egy
                200
                hektáros mezőgazdasági területről, egy bonyolult ipari épület vizsgálatáról vagy egy nagyszabású
                rendezvény
                légi dokumentálásáról &ndash; a Loricatus ott van, ahol a részletek számítanak.
            </p>
            <div class="about-values">
                <div class="value-item">
                    <div class="value-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                    <div>
                        <strong>Teljes jogszabályi megfelelés</strong>
                        <span>Magyar és EU drónszabályok, légiügyi engedélyek, biztosítás</span>
                    </div>
                </div>
                <div class="value-item">
                    <div class="value-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <div>
                        <strong>Projektre szabott feldolgozás</strong>
                        <span>Az adatfeldolgozás és az átadás ütemezése minden esetben a feladat összetettségéhez igazodik</span>
                    </div>
                </div>
                <div class="value-item">
                    <div class="value-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    </div>
                    <div>
                        <strong>Mért, dokumentált eredmény</strong>
                        <span>Minden projekthez részletes riport, CAD-export és GIS-adatok</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- =================== EQUIPMENT =================== -->
<section id="equipment" class="equipment section">
    <div class="section-bg-label">04 / ESZKÖZPARK</div>
    <div class="container">
        <div class="section-header reveal">
            <div class="section-tag">Technológia</div>
            <h2 class="section-title">Ipari szintű<br /><span class="accent-text">eszközpark</span></h2>
            <p class="section-desc">Kizárólag professzionális, minősített hardvereket alkalmazunk &ndash; mert az
                eredmény minősége az eszközön múlik.</p>
        </div>
        <div class="equipment-grid">
            <div class="equipment-card reveal" style="--delay: 0.05s">
                <div class="eq-img-wrap">
                    <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/equipment-bg.png"
                        alt="DJI Matrice 400 SP Plus" class="eq-img" />
                </div>
                <div class="eq-info">
                    <span class="eq-tag">Fő platform</span>
                    <h3>DJI MATRICE 400 SP PLUS</h3>
                    <p>Nagy teherbírású ipari drónplatform összetett felmérési, inspekciós és adatgyűjtési feladatokhoz</p>
                </div>
            </div>
            <div class="equipment-card reveal" style="--delay: 0.12s">
                <div class="eq-img-wrap">
                    <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/equipment-bg.png"
                        alt="DJI Matrice 4 E SP Plus" class="eq-img eq-img-2" />
                </div>
                <div class="eq-info">
                    <span class="eq-tag">Kompakt platform</span>
                    <h3>DJI MATRICE 4 E SP PLUS</h3>
                    <p>Gyorsan bevethető, kompakt drónplatform helyszíni dokumentáláshoz, felméréshez és vizuális ellenőrzéshez</p>
                </div>
            </div>
            <div class="equipment-card reveal" style="--delay: 0.19s">
                <div class="eq-img-wrap">
                    <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/equipment-bg.png"
                        alt="DJI Zenmuse L3 (EU) SP Plus LiDAR szenzor" class="eq-img eq-img-3" />
                </div>
                <div class="eq-info">
                    <span class="eq-tag">LiDAR szenzor</span>
                    <h3>DJI Zenmuse L3 (EU) SP Plus</h3>
                    <p>LiDAR alapú szenzor nagy pontosságú pontfelhős felméréshez és részletes téradatgyűjtéshez</p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- =================== PORTFOLIO =================== -->
<section id="portfolio" class="portfolio section">
    <div class="section-bg-label">05 / PROJEKTEK</div>
    <div class="container">
        <div class="section-header reveal">
            <div class="section-tag">Referenciák</div>
            <h2 class="section-title">Elvégzett<br /><span class="accent-text">projektek</span></h2>
        </div>
        <div class="portfolio-grid">
            <div class="portfolio-card large reveal" style="--delay:0.05s">
                <div class="portfolio-img-wrap">
                    <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/hero-bg.png"
                        alt="Városi felmérés" class="portfolio-img" />
                    <div class="portfolio-overlay">
                        <span class="portfolio-cat">Felmérés & Térképezés</span>
                        <h3>Városközpont ortofotó<br />és terepmodell</h3>
                        <p>12 km&sup2; &bull; RTK &middot; GSD 2 cm</p>
                    </div>
                </div>
            </div>
            <div class="portfolio-card reveal" style="--delay:0.12s">
                <div class="portfolio-img-wrap">
                    <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/services-bg.png"
                        alt="Épületinspekció" class="portfolio-img" />
                    <div class="portfolio-overlay">
                        <span class="portfolio-cat">Inspekció</span>
                        <h3>Ipari kémény<br />vizsgálat</h3>
                        <p>LiDAR + hőkamera</p>
                    </div>
                </div>
            </div>
            <div class="portfolio-card reveal" style="--delay:0.19s">
                <div class="portfolio-img-wrap">
                    <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/equipment-bg.png"
                        alt="Mezőgazdaság" class="portfolio-img" />
                    <div class="portfolio-overlay">
                        <span class="portfolio-cat">Precíziós mezőgazdaság</span>
                        <h3>NDVI térkép<br />400 ha</h3>
                        <p>Multispektrális &middot; GIS export</p>
                    </div>
                </div>
            </div>
            <div class="portfolio-card reveal" style="--delay:0.25s">
                <div class="portfolio-img-wrap">
                    <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/hero-bg.png" alt="3D modell"
                        class="portfolio-img" />
                    <div class="portfolio-overlay">
                        <span class="portfolio-cat">3D Modellezés</span>
                        <h3>Kastély<br />3D pontfelhő</h3>
                        <p>LiDAR &middot; BIM-export</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- =================== TESTIMONIALS =================== -->
<section class="testimonials section">
    <div class="section-bg-label">06 / VÉLEMÉNYEK</div>
    <div class="container">
        <div class="section-header reveal">
            <div class="section-tag">Ügyfeleink mondják</div>
            <h2 class="section-title">Amit <span class="accent-text">partnereink</span><br />tapasztaltak</h2>
        </div>
        <div class="testimonials-grid">
            <div class="testi-card reveal" style="--delay:0.05s">
                <div class="testi-quote">"</div>
                <p>A Loricatus csapata 24 óra alatt elvégezte a teljes épületfelmérést és másnap megkaptuk a teljeskörű
                    riportot. Páratlan szakmaiság és pontosság.</p>
                <div class="testi-author">
                    <div class="testi-avatar" style="background: var(--accent);">K</div>
                    <div>
                        <strong>Kovács Attila</strong>
                        <span>Projektmenedzser, Magyar Építő Zrt.</span>
                    </div>
                </div>
            </div>
            <div class="testi-card reveal" style="--delay:0.12s">
                <div class="testi-quote">"</div>
                <p>Az NDVI-térképek alapján 18%-kal csökkentettük a növényvédőszer felhasználást. A Loricatus nem
                    ajánlóterméket adott &ndash; megoldást adott a farmunk számára.</p>
                <div class="testi-author">
                    <div class="testi-avatar" style="background: #2B3B46;">S</div>
                    <div>
                        <strong>Szabó Péter</strong>
                        <span>Gazdálkodó, 650 ha</span>
                    </div>
                </div>
            </div>
            <div class="testi-card reveal" style="--delay:0.19s">
                <div class="testi-quote">"</div>
                <p>A hőkamerás vizsgálatuk felfedte azt a szigetelési problémát, amit 3 éve nem találtunk meg.
                    Megtakarítottunk egy komoly felújítási összeget. Köszönjük!</p>
                <div class="testi-author">
                    <div class="testi-avatar" style="background: #3d5a70;">N</div>
                    <div>
                        <strong>Nagy Éva</strong>
                        <span>Ingatlankezelő, BPM Group</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- =================== CONTACT / LEAD FORM =================== -->
<section id="contact" class="contact section">
    <div class="section-bg-label">07 / KAPCSOLAT</div>
    <div class="container contact-container">
        <div class="contact-info reveal">
            <div class="section-tag">Lépjünk kapcsolatba</div>
            <h2 class="section-title">Kérjen<br /><span class="accent-text">ingyenes ajánlatot</span></h2>
            <p class="contact-desc">Töltse ki az űrlapot és 24 órán belül visszajelzünk. Minden projekt egyedi &ndash;
                az ajánlat is az.</p>
            <div class="contact-details">
                <div class="contact-detail-item">
                    <div class="contact-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path
                                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                    </div>
                    <div>
                        <strong>Telefon</strong>
                        <a href="tel:+36301234567">+36 30 123 4567</a>
                    </div>
                </div>
                <div class="contact-detail-item">
                    <div class="contact-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                    </div>
                    <div>
                        <strong>Email</strong>
                        <a href="mailto:info@loricatus.hu">info@loricatus.hu</a>
                    </div>
                </div>
                <div class="contact-detail-item">
                    <div class="contact-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    </div>
                    <div>
                        <strong>Iroda</strong>
                        <span>Budapest, Magyarország</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="contact-form-wrap reveal" style="--delay: 0.1s">
            <form id="contactForm" class="contact-form" novalidate>
                <div class="form-row">
                    <div class="form-group">
                        <label for="name">Teljes neve *</label>
                        <input type="text" id="name" name="name" placeholder="Pl. Kovács Attila" required />
                        <span class="form-error" id="nameError">Kérem adja meg nevét</span>
                    </div>
                    <div class="form-group">
                        <label for="company">Cég neve</label>
                        <input type="text" id="company" name="company" placeholder="Pl. Magyar Építő Zrt." />
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="email">E-mail cím *</label>
                        <input type="email" id="email" name="email" placeholder="pelda@ceg.hu" required />
                        <span class="form-error" id="emailError">Érvényes e-mail szükséges</span>
                    </div>
                    <div class="form-group">
                        <label for="phone">Telefonszám</label>
                        <input type="tel" id="phone" name="phone" placeholder="+36 30 ..." />
                    </div>
                </div>
                <div class="form-group">
                    <label for="service">Melyik szolgáltatás érdekli? *</label>
                    <select id="service" name="service" required>
                        <option value="" disabled selected>Válasszon szolgáltatást</option>
                        <option>Légi fotó &amp; videó</option>
                        <option>Felmérés &amp; térképezés</option>
                        <option>Épületinspekció</option>
                        <option>LiDAR szkennelés</option>
                        <option>Hőkamera &amp; termográfia</option>
                        <option>Precíziós mezőgazdaság</option>
                        <option>Egyéb / Több szolgáltatás</option>
                    </select>
                    <span class="form-error" id="serviceError">Kérem válasszon egy szolgáltatást</span>
                </div>
                <div class="form-group">
                    <label for="message">Projekt leírása *</label>
                    <textarea id="message" name="message" rows="4"
                        placeholder="Kérjük írja le röviden a projektet, a helyszínt és a várt eredményt..."
                        required></textarea>
                    <span class="form-error" id="messageError">Kérem írja le a projektet</span>
                </div>
                <div class="form-check">
                    <input type="checkbox" id="gdpr" name="gdpr" required />
                    <label for="gdpr">Elfogadom az <a href="#">adatkezelési tájékoztatót</a> és hozzájárulok adataim
                        kezeléséhez. *</label>
                </div>
                <button type="submit" class="btn btn-primary btn-full" id="submitBtn">
                    <span id="btnText">Küldöm az ajánlatkérést</span>
                    <svg id="btnArrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span id="btnLoader" class="btn-loader" style="display:none"></span>
                </button>
                <div id="formSuccess" class="form-success" style="display:none">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <strong>Köszönjük!</strong> Ajánlatkérését megkaptuk. 24 órán belül visszajelzünk.
                </div>
            </form>
        </div>
    </div>
</section>

<!-- =================== LIGHTBOX =================== -->
<div id="lightbox" class="lightbox" aria-hidden="true">
    <div class="lightbox-backdrop"></div>
    <button class="lightbox-close" aria-label="Bezárás">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    </button>
    <button class="lightbox-arrow lightbox-prev" aria-label="Előző">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    </button>
    <button class="lightbox-arrow lightbox-next" aria-label="Következő">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 6 15 12 9 18" />
        </svg>
    </button>
    <div class="lightbox-content">
        <img id="lightboxImg" class="lightbox-img" src="" alt="" />
        <div class="lightbox-info">
            <span class="lightbox-cat" id="lightboxCat"></span>
            <h3 id="lightboxTitle"></h3>
            <p id="lightboxDesc"></p>
        </div>
    </div>
    <div class="lightbox-counter" id="lightboxCounter"></div>
</div>

<?php get_footer(); ?>