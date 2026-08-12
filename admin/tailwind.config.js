/** @type {import('tailwindcss').Config} */

// A szerkesztő felülete ugyanabból a három márkaszínből épül, mint a honlap
// (arculati kézikönyv, 20. oldal). A `gray` skálát antracit árnyalatúra
// cseréljük: így a meglévő bg-gray-* / text-gray-* osztályok egy az egyben
// arculathelyessé válnak, anélkül hogy több száz osztálynevet át kellene írni.
// A világosságlépcsők a Tailwind eredeti szürkéit követik, hogy a meglévő
// kontrasztviszonyok megmaradjanak; a 700-as lépcső pontosan az ANTRACIT.
const antracit = {
  50:  '#FAFAFA',
  100: '#F4F5F5',
  200: '#E6E8EA',
  300: '#D1D7DB',
  400: '#96A8B5',
  500: '#5B7B90',
  600: '#445B6A',
  700: '#2B3B46', // ANTRACIT -- a márkaszín maga
  800: '#22303A',
  900: '#1B242B',
  950: '#131A1F',
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: antracit,
        antracit,
        lime: {
          DEFAULT: '#C8FA32',
          soft: 'rgba(200, 250, 50, 0.15)',
          line: 'rgba(200, 250, 50, 0.55)',
        },
        acel: '#DCDCD7',
      },
      fontFamily: {
        sans: ["'Aktiv Grotesk Corp'", 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
