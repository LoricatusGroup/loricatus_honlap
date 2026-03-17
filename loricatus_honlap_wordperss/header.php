<!DOCTYPE html>
<html <?php language_attributes(); ?>>

<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="<?php bloginfo('description'); ?>" />
    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
    <?php wp_body_open(); ?>

    <!-- =================== NAVIGATION =================== -->
    <nav id="navbar" class="navbar">
        <div class="nav-container">
            <a href="<?php echo esc_url(home_url('/')); ?>" class="nav-logo"
                aria-label="<?php bloginfo('name'); ?> főoldal">
                <img src="<?php echo esc_url(get_template_directory_uri()); ?>/assets/logo.svg"
                    alt="<?php bloginfo('name'); ?>" class="logo-svg" />
            </a>
            <ul class="nav-links" id="navLinks">
                <li><a href="#services">Szolgáltatások</a></li>
                <li><a href="#about">Rólunk</a></li>
                <li><a href="#equipment">Eszközpark</a></li>
                <li><a href="#portfolio">Projektek</a></li>
                <li><a href="https://loricatusgroup.github.io/museum_2/" class="nav-cta-link">3D múzeum</a></li>
                <li><a href="https://losses-builds-glasses-allow.trycloudflare.com/hu/login"
                        class="nav-cta-link">DIMOP</a></li>
                <li><a href="#contact" class="nav-cta-link">Ajánlatkérés</a></li>
            </ul>
            <div style="display: flex; gap: 15px;">
                <a href="https://loricatusgroup.github.io/museum_2/" class="nav-cta"
                    style="background: rgba(255, 255, 255, 0.08); color: #ffffff; box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.2); text-decoration: none; display: flex; align-items: center;">
                    3D múzeum
                </a>
                <a href="https://losses-builds-glasses-allow.trycloudflare.com/hu/login" class="nav-cta"
                    style="background: rgba(255, 255, 255, 0.08); color: #ffffff; box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.2); text-decoration: none; display: flex; align-items: center;">
                    DIMOP
                </a>
                <button class="nav-cta"
                    onclick="document.getElementById('contact').scrollIntoView({behavior:'smooth'})">
                    Ajánlatkérés
                </button>
            </div>
            <button class="hamburger" id="hamburger" aria-label="Menü">
                <span></span><span></span><span></span>
            </button>
        </div>
    </nav>

    <!-- ===== SCROLL-DRIVEN VIDEO BACKGROUND (fixed, behind all content) ===== -->
    <canvas id="scroll-canvas"></canvas>