# loricatus_honlap – útmutató Claude-nak

A loricatus.hu statikus weboldala (HTML/CSS/JS a repó gyökerében, több nyelven: `en/`,
`it/`) és a saját CMS (`admin/`, Vite + React, Supabase). Részletek: `ARCHITECTURE.md`.

A felhasználó magyarul ír, válaszolj magyarul.

## Fontos: a `main` = éles oldal

Minden push a `main`-re azonnal kimegy a GitHub Pagesre (`deploy.yml`). Ezért:

- Mindig ágon dolgozz, és PR-t nyiss. A `main`-re közvetlenül soha ne pusholj.
- A PR-en a `pr-check.yml` fut (admin build + `inject-content` teszt); merge csak zöldön.
- A CMS publikálása (`publish.yml`) is a `main`-re commitol: a `pages.json`-t és a
  tartalom-HTML-t a CMS is írja, ezért mergelés előtt frissíts a `main`-ről.

## Ellenőrzések

```bash
cd admin && npm ci && VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build
cd scripts && npm install && node inject-content.test.js
cd admin && npm run lint     # egyelőre tájékoztató, kb. 33 meglévő hiba
```

A statikus oldalt böngészőben `python3 -m http.server` a gyökérből, Playwrighttal
képernyőképet készíthetsz róla.

## Supabase

- Projekt: „Ágó frontendbaszogatója” (`rksqwamubvnxuthumphi`). A felhős konténer
  hálózata a `*.supabase.co`-t alapból nem éri el; a Supabase connectoron (MCP) át
  olvass, ha kell.
- Az élő adatbázisban vannak olyan migrációk, amelyek a `supabase/migrations/`-ből
  hiányoznak (2026-07-08-as RLS-átállás). Séma-változtatás előtt az élő állapotot
  nézd meg, ne a repót. A `PHASE0_CUTOVER.md` „nincs alkalmazva” állítása elavult.
- Éles adatbázist módosító lépés (migráció, edge function deploy) csak Peti kifejezett
  kérésére.

## Tilos

- Kulcs, token, jelszó commitolása (minden titok GitHub Secretsben / Supabase-ben él).
- Az `epiteskovetes-hu-mentes/` tükör módosítása, hacsak nem kifejezetten az a feladat.
