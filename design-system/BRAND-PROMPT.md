# Loricatus arculati prompt

Ezt a szoveget **másold be** bármelyik AI-nak (Claude, ChatGPT, v0, Lovable…),
mielőtt HTML-oldalt kérsz tőle. Ettől az eredmény már eleve a Loricatus
arculatában készül, nem kell utólag átalakítani.

---

## MÁSOLD INNEN ↓

Az alábbi arculati szabályok szerint készítsd az oldalt. Ne térj el tőlük.

**Színek (CSS-változóként add meg és azokat használd):**
```css
:root{
  --bg:#F8F6F2;      /* oldal háttér */
  --bg2:#EEEAE3;     /* váltakozó szekció háttere */
  --text:#111316;    /* szöveg ÉS sötét felületek — soha nem tiszta fekete */
  --muted:#737e88;   /* másodlagos szöveg */
  --dim:#c2ccd4;     /* halvány elem */
  --accent:#c7d540;  /* lime akcentus — CSAK kis felületen */
  --border:rgba(0,0,0,0.09);
}
```

**Betűtípus:** `'Aktiv Grotesk Corp', system-ui, sans-serif` minden szövegre;
`'IBM Plex Mono', monospace` **kizárólag** rövid, nagybetűs címkékre és
metaadatra. Ha az Aktiv Grotesk nem elérhető, `system-ui` a tartalék.

**Kötelező szabályok:**

1. **Szögletes.** Semmi lekerekítés gombon, mezőn, kártyán (`border-radius:0`).
   Lekerekítés csak nagy képfelületen, ott is legfeljebb 12–16px.
2. **Nincs árnyék.** Elválasztásra 1px `--border` keret szolgál, nem `box-shadow`.
3. **Az akcentus kicsi.** A lime (`--accent`) címkére, aláhúzásra, kiemelt szóra
   való. Nagy háttérként **soha**. Gomb háttere csak sötét hero fölött lehet.
4. **Gomb:** nagybetűs, `letter-spacing:.08em`, `font-weight:600`,
   `padding:13px 28px`. Egy nézetben **egyetlen** sötét (elsődleges) gomb,
   a többi átlátszó, 1px kerettel.
5. **Minden szekció így kezdődik:** mono-címke akcentus háttéren → cím (700 súly,
   `letter-spacing:-.02em`) → rövid leírás `--muted` színnel.
6. **Ritmus:** 8px többszörösei; szekciók között 96px; a fejléc 64px magas.
   Tartalom max. 1200px széles, oldalt `clamp(20px,4vw,48px)` margóval.
7. **Sortávolság 1.7**, bekezdés max. 60–70 karakter széles.
8. **Hero:** oldalanként **egy**, sötét (`--text`) háttéren, fehér szöveggel;
   ott az akcentus a kiemelő szín. Világos CTA sávon a gomb viszont sötét.
9. **Hangnem:** tényszerű, mérnöki, tömör. Nincs felkiáltójel-áradat, nincs
   „forradalmi”, „innovatív” töltelék. Magyarul magázódunk.
10. **Ne használj** gradienst, neon glow-t, emoji-t dekorációként, lekerekített
    „pill” gombot, lila/kék SaaS-palettát.

**Szerkezet, amit kövess:**
sötét hero → tartalmi szekció (címke/cím/leírás + 3 oszlopos kártyarács,
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

Colours: `--bg:#F8F6F2` page background, `--bg2:#EEEAE3` alternating section,
`--text:#111316` text and dark surfaces (never pure black), `--muted:#737e88`
secondary text, `--dim:#c2ccd4` faint, `--accent:#c7d540` lime accent,
`--border:rgba(0,0,0,0.09)`.

Type: `'Aktiv Grotesk Corp', system-ui, sans-serif` for everything;
`'IBM Plex Mono', monospace` only for short uppercase labels and meta.

Rules: square corners everywhere (`border-radius:0` on buttons, inputs, cards);
no box-shadow — separate with a 1px `--border`; the lime accent is for small
surfaces only, never a large background; buttons are uppercase, `.08em`
tracking, weight 600, `13px 28px` padding, one dark primary button per view;
every section opens with mono tag → 700-weight title (`-.02em` tracking) →
muted description; 8px rhythm, 96px between sections, 64px navbar, 1200px max
width with `clamp(20px,4vw,48px)` gutters; line-height 1.7, 60–70 characters
per line; exactly one hero per page, dark background, accent for emphasis, but
on a light CTA band the button is dark. Tone is factual and engineering-led.
Never use gradients, neon glow, decorative emoji, pill buttons, or a purple/blue
SaaS palette.

Structure: dark hero → content section (tag/title/description + 3-column card
grid inside one shared 1px border) → alternating-background section → light CTA
band → footer.
