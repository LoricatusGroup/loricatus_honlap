# Loricatus Design System

A loricatus.hu **valódi** arculati értékeiből generálva — nem újrarajzolt
közelítés: a színek, betűtípusok és komponens-szabályok egy az egyben a
`style.css`-ből származnak.

## Mi mire való?

| Fájl | Kinek | Mire |
|---|---|---|
| **`BRAND-PROMPT.md`** | a CEO-nak | **Ezt küldd el.** Egy bemásolható szöveg bármelyik AI-nak; utána a generált HTML már arculathelyes. |
| **`brand.css`** | a generált oldalnak | Egyetlen önhordó fájl: a betűtípusok bele vannak ágyazva, tehát internet és mellékelt fájlok nélkül is jól néz ki. |
| **`page-template.html`** | kiinduláshoz | Kész, működő oldalváz, ami a `brand.css`-t használja. |
| `tokens.css` / `tokens.json` | fejlesztőnek | Csak a változók, ha valaki saját rendszerbe emelné be. |
| `foundations/*.html`, `components/*.html` | Claude Designnak | Előnézeti kártyák; az első soruk a `@dsCard` jelölő. |
| `fonts/`, `assets/` | mindenhez | A valódi betűtípusok és a logó. |

## A leggyorsabb út (a CEO-nak)

1. Nyisd meg a `BRAND-PROMPT.md`-t, másold ki a **„MÁSOLD INNEN ↓ … MÁSOLD IDÁIG ↑"**
   közti részt.
2. Illeszd be az AI-nak *az oldal kérése előtt*.
3. Kérd az oldalt.

Ha pixelpontos egyezés kell, elég ennyit mondani az AI-nak:

```html
<link rel="stylesheet" href="https://loricatus.hu/design-system/brand.css">
```

…és hogy a `brand.css` osztályait használja (`.container`, `.section`,
`.section-tag`, `.section-title`, `.btn btn-primary`, `.grid-3 .card`,
`.hero-dark`). Így a betűtípusok is automatikusan helyesek.

## Szinkron a Claude Design felületére

Ezt **helyi gépen** kell futtatni, mert bejelentkezés kell hozzá (a felhős
környezetben nincs interaktív terminál):

```bash
cd <a repó mappája>
claude
/design-sync
```

A `/design-sync` beolvassa ezt a mappát, és feltölti a kártyákat a Design System
panelre. Előfordulhat, hogy közben átrendezi vagy újragenerálja a fájlokat a
saját formátumába — ez rendben van: a lényeg, hogy valódi, az élő oldalból
származó forrásanyagot kap, nem találgat.

## Frissítés

Ha a `style.css` `:root` blokkja változik, a csomagot újra kell generálni,
hogy ne csússzon el az élő oldaltól. A generátor a tokeneket egy helyen tartja
(`TOKENS`, `ROOT_VARS`, `COMPONENT_CSS`).
