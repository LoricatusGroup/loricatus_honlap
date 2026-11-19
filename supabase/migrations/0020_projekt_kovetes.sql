-- Ügyfél-projektkövetés (2026-11-18)
--
-- A CRM (NAS) percenként ide küldi a követett projektek NYILVÁNOS
-- pillanatképét (lépés, határidők — e-mail, név, összeg nélkül) a
-- `kovetes-publikal` függvényen át. A loricatus.hu/projektkovetes/ oldal a
-- `kovetes-lekerdez` függvényt hívja a megrendelő kódjával. A NAS-hoz így a
-- nyilvános internetről semmi nem ér el.
--
-- Mindkét tábla RLS mögött van, policy NÉLKÜL: az anon és a bejelentkezett
-- szerepkör semmit nem lát és nem ír; csak a függvények (service role).

create table if not exists public.projekt_kovetes (
  -- A teljes kód (LRCTS2026-85-K7QM) SHA-256-ja; maga a kód nincs tárolva.
  kod_hash   text primary key check (kod_hash ~ '^[0-9a-f]{64}$'),
  adat       jsonb not null,
  frissitve  timestamptz not null default now()
);

create table if not exists public.projekt_kovetes_probalkozas (
  id       bigint generated always as identity primary key,
  -- 'ip:<sha256>' (a látogató IP-je hash-elve) vagy 'kod:<LRCTS2026-85>' (a kód nyilvános eleje)
  kulcs    text not null,
  sikeres  boolean not null,
  at       timestamptz not null default now()
);
create index if not exists projekt_kovetes_probalkozas_kulcs_at
  on public.projekt_kovetes_probalkozas (kulcs, at desc);

alter table public.projekt_kovetes enable row level security;
alter table public.projekt_kovetes_probalkozas enable row level security;
revoke all on public.projekt_kovetes from anon, authenticated;
revoke all on public.projekt_kovetes_probalkozas from anon, authenticated;
