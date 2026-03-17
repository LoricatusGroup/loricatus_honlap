<?php
/**
 * Theme functions and definitions
 *
 * @package loricatus
 */

if ( ! function_exists( 'loricatus_setup' ) ) :
	function loricatus_setup() {
		// Let WordPress manage the document title.
		add_theme_support( 'title-tag' );

		// Enable support for Post Thumbnails on posts and pages.
		add_theme_support( 'post-thumbnails' );

		// Register Navigation Menus
		register_nav_menus( array(
			'menu-1' => esc_html__( 'Primary', 'loricatus' ),
		) );
	}
endif;
add_action( 'after_setup_theme', 'loricatus_setup' );

/**
 * Enqueue scripts and styles.
 */
function loricatus_scripts() {
	// Google Fonts
	wp_enqueue_style( 'loricatus-fonts', 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap', array(), null );

	// Theme Styles
	wp_enqueue_style( 'loricatus-style', get_stylesheet_uri(), array(), filemtime( get_template_directory() . '/style.css' ) );
	wp_enqueue_style( 'loricatus-main', get_template_directory_uri() . '/index.css', array(), filemtime( get_template_directory() . '/index.css' ) );
	wp_enqueue_style( 'loricatus-scroll', get_template_directory_uri() . '/scroll-video.css', array(), filemtime( get_template_directory() . '/scroll-video.css' ) );

	// External Scripts
	wp_enqueue_script( 'lenis', 'https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js', array(), null, true );
	wp_enqueue_script( 'gsap', 'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js', array(), null, true );
	wp_enqueue_script( 'scrolltrigger', 'https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js', array('gsap'), null, true );

	// Custom Scripts
	wp_enqueue_script( 'loricatus-scroll-video', get_template_directory_uri() . '/scroll-video.js', array('scrolltrigger'), filemtime( get_template_directory() . '/scroll-video.js' ), true );
	
	// A scroll-video scriptnek át kell adnunk a theme URI-t, hogy pontosan megtalálja a frames2 mappát
	wp_localize_script( 'loricatus-scroll-video', 'LoricatusData', array(
		'themeUri' => get_template_directory_uri()
	) );
	
	wp_enqueue_script( 'loricatus-main-script', get_template_directory_uri() . '/script.js', array('lenis'), filemtime( get_template_directory() . '/script.js' ), true );
}
add_action( 'wp_enqueue_scripts', 'loricatus_scripts' );
