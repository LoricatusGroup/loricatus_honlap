# Loricatus arculati prompt

Ezt a szoveget **másold be** bármelyik AI-nak (Claude, ChatGPT, v0, Lovable…),
mielőtt HTML-oldalt kérsz tőle. Ettől az eredmény már eleve a Loricatus
arculatában készül, nem kell utólag átalakítani.

---

## MÁSOLD INNEN ↓

Az alábbi arculati szabályok szerint készítsd az oldalt. Ne térj el tőlük.

**Színek — a márka pontosan három színből áll (arculati kézikönyv, 20. oldal):**
```css
:root{
  /* A HÁROM MÁRKASZÍN — ezektől ne térj el */
  --text:#2B3B46;    /* ANTRACIT: minden szöveg ÉS minden sötét felület */
  --accent:#C8FA32;  /* LIME: akcentus — CSAK kis felületen */
  --bg2:#DCDCD7;     /* ACÉL: világos felület, váltakozó szekció */

  /* Webes kiterjesztés: a kézikönyv nem definiál másodlagos palettát,
     ezek a fenti háromból származtatott tónusok */
  --bg:#EEEEEB;      /* alapfelület (acél→fehér 50%) */
  --muted:#556269;   /* másodlagos szöveg */
  --dim:#999FA0;     /* dekoratív vonal — NEM szöveg */
  --border:rgba(43,59,70,0.16);
}
```

**Betűtípus:** `'Aktiv Grotesk Corp', system-ui, sans-serif` minden szövegre;
`'IBM Plex Mono', monospace` **kizárólag** rövid, nagybetűs címkékre és
metaadatra. Ha az Aktiv Grotesk nem elérhető, `system-ui` a tartalék.

**Kötelező szabályok:**

1. **Csak a három márkaszín.** Ne találj ki újat, ne világosítsd/sötétítsd őket
   kedvedre. Sötét felület mindig antracit — **tiszta fekete soha**.
2. **Lime szöveg világos háttéren TILOS** — a kontrasztarány 1.13:1,
   olvashatatlan. A lime vagy antraciton áll, vagy antracit szöveg alatt
   háttérként.
3. **Szögletes.** Semmi lekerekítés gombon, mezőn, kártyán (`border-radius:0`).
   Lekerekítés csak nagy képfelületen, ott is legfeljebb 12–16px.
4. **Nincs árnyék.** Elválasztásra 1px `--border` keret szolgál, nem `box-shadow`.
5. **Az akcentus kicsi.** A lime címkére, aláhúzásra, kiemelt szóra, emblémára
   való, és lehet kis felület — gomb, címke — háttere is, de akkor a rajta lévő
   szöveg **antracit** (9.45:1). Nagy háttérként, egész szekció alatt **soha**.
6. **Gomb:** nagybetűs, `letter-spacing:.08em`, `font-weight:600`,
   `padding:13px 28px`. Egy nézetben **egyetlen** sötét (elsődleges) gomb,
   a többi átlátszó, 1px kerettel.
7. **Minden szekció így kezdődik:** mono-címke lime háttéren → cím (700 súly,
   `letter-spacing:-.02em`) → rövid leírás `--muted` színnel.
8. **Ritmus:** 8px többszörösei; szekciók között 96px; a fejléc 64px magas.
   Tartalom max. 1200px széles, oldalt `clamp(20px,4vw,48px)` margóval.
9. **Sortávolság 1.7**, bekezdés max. 60–70 karakter széles.
10. **Hero:** oldalanként **egy**, antracit háttéren, fehér szöveggel;
    ott a lime a kiemelő szín. Világos CTA sávon a gomb viszont antracit.
11. **Logó** (kézikönyv, 33–34. o.): acél/világos háttéren **kizárólag
    antracit**; antracit háttéren lime vagy acél, együtt használva az embléma
    lime és a felirat acél; fotó fölött **csak a felirat**, acél vagy antracit
    színben, a kép sarkába helyezve. Minimális szélesség: álló 250px, fekvő
    325px, kompakt és csak-felirat 80px. Védőtávolság: az „L” betű
    magasságának kétszerese.
12. **Ikonok** (39. o.): vonalas stílus. Antraciton lime vagy acél; acélon
    antracit; lime-on antracit.
13. **Minta** (41–43. o.): az embléma önmagában, felirat nélkül is használható
    dekorációként — nagy méretben, elforgatva, a felületről kifuttatva. Lime
    háttéren acél, antracit háttéren lime.
14. **Hangnem:** tényszerű, mérnöki, tömör. Nincs felkiáltójel-áradat, nincs
    „forradalmi”, „innovatív” töltelék. Magyarul magázódunk.
15. **Ne használj** gradienst, neon glow-t, emoji-t dekorációként, lekerekített
    „pill” gombot, lila/kék SaaS-palettát.

**Szerkezet, amit kövess:**
antracit hero → tartalmi szekció (címke/cím/leírás + 3 oszlopos kártyarács,
kártyák közös 1px keretben) → váltakozó hátterű szekció → világos CTA sáv → lábléc.

## MÁSOLD IDÁIG ↑

---

## Ha pixelpontos egyezést akarsz

A prompt helyett (vagy mellett) az AI-nak ezt is mondhatod:

> Az oldal `<head>`-jébe tedd be ezt az egy sort, és a `brand.css` osztályait
> használd: `.container .section .section-alt .section-tag .section-title
> .section-desc .btn .btn-primary .btn-secondary .btn-sm .btn-full .grid-3
> .card .card-num .field .hero-dark`
>
> ```html
> <link rel="stylesheet" href="https://loricatus.hu/design-system/brand.css">
> ```

Ez a fájl a betűtípusokat is tartalmazza, tehát semmi mást nem kell mellékelni.
Kiindulásnak ott a `page-template.html` — kész, működő váz.

---

## English version (paste this if you prompt in English)

Build the page with these brand rules; do not deviate.

The brand has exactly three colours (brand book p20): ANTRACIT `#2B3B46` (all
text and every dark surface — never pure black), LIME `#C8FA32` (accent, small
surfaces only), ACÉL `#DCDCD7` (light surface). The book defines no secondary
palette, so these are derived web tones: `--bg:#EEEEEB` page base,
`--muted:#556269` secondary text, `--dim:#999FA0` decorative lines only,
`--border:rgba(43,59,70,0.16)`.

Type: `'Aktiv Grotesk Corp', system-ui, sans-serif` for everything;
`'IBM Plex Mono', monospace` only for short uppercase labels and meta.

Rules: use only the three brand colours — never invent new ones. Never put lime
text on a light background (1.13:1, unreadable); lime either sits on antracit or
serves as a background under antracit text. Square corners everywhere
(`border-radius:0` on buttons, inputs, cards); no box-shadow — separate with a
1px `--border`; the lime accent is for small surfaces only, never a large
background; buttons are uppercase, `.08em` tracking, weight 600, `13px 28px`
padding, one dark primary button per view; every section opens with mono tag →
700-weight title (`-.02em` tracking) → muted description; 8px rhythm, 96px
between sections, 64px navbar, 1200px max width with `clamp(20px,4vw,48px)`
gutters; line-height 1.7, 60–70 characters per line; exactly one hero per page,
antracit background, lime for emphasis, but on a light CTA band the button is
antracit.

Logo (book p33–34): on a light/acél background the logo may appear **only in
antracit**; on antracit it may be lime or acél, and when both are used the mark
is lime and the wordmark is acél; over a photo use the wordmark alone, in acél
or antracit, placed in a corner of the image. Minimum widths: vertical 250px,
horizontal 325px, compact and wordmark-only 80px. Clear space equals twice the
height of the "L".

Icons (p39): line style — lime or acél on antracit, antracit on acél, antracit
on lime. Pattern (p41–43): the mark alone, without the wordmark, works as
decoration — large, rotated, bleeding off the edge; acél on lime, lime on
antracit.

Tone is factual and engineering-led. Never use gradients, neon glow, decorative
emoji, pill buttons, or a purple/blue SaaS palette.

Structure: antracit hero → content section (tag/title/description + 3-column
card grid inside one shared 1px border) → alternating-background section → light
CTA band → footer.
