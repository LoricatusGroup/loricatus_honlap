# Loricatus honlap — architektúra

Ez a repó **két dolgot** tartalmaz:

1. A **publikus weboldal** (statikus HTML/CSS/JS, GitHub Pages-en).
2. Egy **saját, könnyű vizuális CMS** (`admin/`), amivel a tartalom szerkeszthető
   és publikálható — kód nélkül, böngészőből.

> ⚠️ **Titkok:** ez a fájl szándékosan **nem** tartalmaz kulcsot, tokent vagy
> jelszót. Minden titok külső helyen él (GitHub Secrets / Supabase / Resend) —
> lásd a [Titkok és környezeti változók](#titkok-és-környezeti-változók) részt.

---

## Nagy kép

```
CEO / szerkesztő (böngésző)
   │
   ├─ Admin szerkesztő  (Vite + React + Tailwind)  ──►  GitHub Pages: /admin-app/
   │        ├─ Belépés: Supabase magic link (e-mail)
   │        ├─ Betölti az ÉLŐ index.html-t, kiolvassa a data-edit mezőket
   │        └─ Mentés / Publikálás ──► Supabase
   │
   ├─ Supabase  ("Ágó frontendbaszogatója" projekt)
   │        ├─ Postgres: page_content, page_versions, assets, form_submissions, allowed_users
   │        ├─ Auth: magic link + domain-alapú hozzáférés (allowed_users)
   │        └─ Edge Function: publish-site
   │                 │ (GitHub repository_dispatch)
   │                 ▼
   ├─ GitHub Actions: publish.yml ──► scripts/inject-content.js
   │        (beégeti a Supabase tartalmát a statikus HTML-be, majd commit + push)
   │                 │
   │                 ▼
   └─ GitHub Actions: deploy.yml ──► GitHub Pages (a publikus, statikus oldal)
```

**Hosting:** minden ingyenes — GitHub Pages (oldal + admin), Supabase (backend),
Resend (e-mail).

---

## Komponensek

### 1. Publikus oldal (repó gyökér)
- `index.html`, `en/index.html`, `it/index.html` — a három nyelv.
- `style.css`, `script.js`, `assets/` — statikus eszközök.
- A szerkeszthető részeket **data-attribútumok** jelölik (lásd lent).
- Kiszolgálás: **GitHub Pages**, a `deploy.yml` workflow-val.

### 2. Admin szerkesztő — `admin/`
- **Vite + React 19 + TypeScript + Tailwind**, `@supabase/supabase-js`,
  `@dnd-kit` (drag & drop), `zod`.
- Buildelve a `/admin-app/` útvonalra kerül (lásd `deploy.yml`).
- Fő fájlok:
  - `src/App.tsx` — belépés + **jogosultság-ellenőrzés** (`current_user_allowed`).
  - `src/pages/Login.tsx` — magic link kérése.
  - `src/pages/Editor.tsx` — a szerkesztő (3 nézet: Élő / Elrendezés / Lista).
  - `src/lib/parseHtml.ts` — a `data-edit*` mezők kiolvasása az élő HTML-ből.
  - `src/lib/parseLayout.ts` — szekció/lista szerkezet és elrendezés-diff.
  - `src/components/` — Live/Layout/Freeform overlay-k, mezőszerkesztők.

### 3. Supabase backend
- **Postgres táblák:**
  - `page_content` — nyelvenként egy sor (`page_slug`): `content`, `theme`,
    `layout` JSONB. Ez az egyetlen tábla, amit a szerkesztő ír.
  - `page_versions` — verziótörténet (opcionális).
  - `assets` — feltöltött képek metaadatai (a fájlok a Storage `assets` bucketben).
  - `form_submissions` — a publikus oldal űrlap-beküldései (anonim insert).
  - `allowed_users` — a hozzáférési allowlist (lásd lent).
- **Auth:** magic link (`signInWithOtp`).
- **Edge Function `publish-site`:** ellenőrzi a jogosultságot, majd elindít egy
  GitHub `repository_dispatch` eseményt a publikáláshoz.

---

## Hogyan működik a szerkesztés (data-attribútumok)

A statikus HTML-ben ezek jelölik a szerkeszthető részeket:

| Attribútum | Jelentés |
|---|---|
| `data-edit="kulcs"` | szöveg |
| `data-edit-html="kulcs"` | HTML tartalom |
| `data-edit-src` | kép (`src`) |
| `data-edit-href` | link (`href`) |
| `data-edit-color` | inline `style` |
| `data-edit-target` | számláló cél (`data-target`) |
| `data-edit-content` | meta `content` |
| `data-section="név"` | szekció (átrendezhető/elrejthető) |
| `data-list="név"` / `data-list-item="id"` | lista és elemei |

A szerkesztő betölti az élő HTML-t, ebből mezőlistát csinál, és a
`page_content.content`-ből ráteszi a mentett felülírásokat. Mentéskor **csak a
megváltozott mezők** kerülnek a `content`-be; a téma a `theme`-be, az elrendezés
(sorrend, rejtés, klónozott elemek, szabad pozíciók) a `layout`-ba.

---

## Hogyan működik a publikálás

1. A szerkesztőben **Publikálás** → előbb ment, majd meghívja a `publish-site`
   edge function-t (a kívánt `locale`-lal).
2. Az edge function ellenőrzi a jogosultságot (`current_user_allowed`), majd
   GitHub `repository_dispatch` (`event_type: publish-site`) eseményt küld.
3. Ez elindítja a **`.github/workflows/publish.yml`**-t, ami lefuttatja a
   **`scripts/inject-content.js`**-t: az `jsdom`-mal beégeti a Supabase
   `content` / `theme` / `layout` tartalmát a megfelelő nyelv HTML-jébe
   (`hu`→`index.html`, `en`→`en/index.html`, `it`→`it/index.html`), majd
   commitol és push-ol.
4. A push elindítja a **`deploy.yml`**-t, ami kirakja az oldalt **GitHub
   Pages**-re. (Ezért kell `PUBLISH_PAT` — a sima `GITHUB_TOKEN`-nel tett push
   nem indítana új workflow-t.)

Az élő oldal kb. **1 perc** múlva frissül.

---

## Hozzáférés-kezelés

A **belépés** magic linkkel bárkinek megy, de **olvasni / szerkeszteni /
publikálni csak jogosult tud** — ezt RLS és az edge function is kikényszeríti.

A jogosultságot az **`allowed_users`** tábla vezérli. Egy sor lehet:
- **pontos e-mail** (egyedi kivétel), vagy
- **teljes domain**, `@loricatus.hu` formában → az egész céget lefedi.

A logika a `current_user_allowed()` Postgres függvényben él (SECURITY DEFINER),
és ugyanezt használja az RLS és a publish edge function is — így egy helyen van.

**Szerkesztő hozzáadása / eltávolítása:** Supabase → Table Editor →
`allowed_users` → sor beszúrása/törlése. (A tábla kliensről nem olvasható;
a dashboardból, service role-lal kezelendő.)

---

## E-mail (magic link)

- Custom SMTP: **Resend**, saját `maydayprod.app` küldő domainnel
  (SPF/DKIM a Cloudflare DNS-ben, EU régió).
- Beállítás helye: Supabase → Authentication → Emails → SMTP Settings.
- A feladó: `noreply@maydayprod.app`.
- Enélkül a Supabase beépített küldője nagyon alacsony limitet ad
  („email rate limit exceeded").

---

## Titkok és környezeti változók

> A **nevek** publikusak, az **értékek** SOHA nem kerülnek a repóba.

| Név | Hol él | Mire kell |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | GitHub Secrets (`deploy.yml` build) | admin app → Supabase (az anon kulcs eleve publikus, RLS véd) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | GitHub Secrets (`publish.yml`) | inject-content.js → Supabase olvasás (service kulcs — **titkos!**) |
| `PUBLISH_PAT` | GitHub Secrets | a publish push, ami indítja a deploy-t |
| `GITHUB_TOKEN`, `GITHUB_REPO` | Supabase Edge Function secrets | a `repository_dispatch` esemény |
| Resend API kulcs | Supabase SMTP jelszó mező | e-mail küldés |

---

## Helyi fejlesztés (admin)

```bash
cd admin
npm install
# admin/.env.local:
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...
npm run dev      # fejlesztői szerver
npm run build    # éles build (tsc + vite)
```

A publikus oldalt nem kell buildelni — statikus fájlok.
