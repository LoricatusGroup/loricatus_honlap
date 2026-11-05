# Loricatus tartalomkezelő rendszer — használati útmutató

A loricatus.hu honlap saját tartalomkezelő rendszerrel (CMS) működik. Ebből az
útmutatóból megtudod, hogyan lépsz be, hogyan módosítod a meglévő tartalmat,
hogyan hozol létre újat, és hogyan teszed közzé a változásokat.

Nem kell hozzá informatikai ismeret. Elrontani nem tudsz semmit: minden
publikálás előtt piszkozatban dolgozol, és minden korábbi állapot
visszaállítható.

**Tartalom**

1. [Belépés](#1-belépés)
2. [A felület](#2-a-felület)
3. [Meglévő tartalom módosítása](#3-meglévő-tartalom-módosítása)
4. [Mentés és publikálás](#4-mentés-és-publikálás)
5. [Új tartalom létrehozása](#5-új-tartalom-létrehozása)
6. [Nyelvek](#6-nyelvek)
7. [Színek](#7-színek)
8. [Visszavonás és korábbi állapotok](#8-visszavonás-és-korábbi-állapotok)
9. [Billentyűparancsok](#9-billentyűparancsok)
10. [Amit ne írj át](#10-amit-ne-írj-át)
11. [Gyakori kérdések](#11-gyakori-kérdések)

---

## 1. Belépés

A szerkesztő címe: **https://loricatus.hu/admin-app/**

Nincs jelszó. Add meg az engedélyezett e-mail címed, és kattints a
**„Bejelentkezési link küldése"** gombra. Pár másodpercen belül kapsz egy
levelet; a benne lévő linkre kattintva belépsz.

- A link egyszer használható és rövid ideig érvényes. Ha lejárt, kérj újat.
- Ha azt írja, hogy a cím nem jogosult, szólj az adminisztrátornak — a
  hozzáférés e-mail cím alapján működik.
- A belépés megmarad, nem kell minden alkalommal újra kérned a linket.

---

## 2. A felület

Belépés után a honlap előnézete jelenik meg, körülötte a szerkesztő sávjaival.
Az első belépéskor egy rövid bemutató végigvezet a lényegen — ezt bármikor
újraindíthatod a jobb felső **fiók-menüből** (a kezdőbetűs gomb), a
**„Bemutató / súgó"** ponttal.

**Felül, balról jobbra:**

| Elem | Mire való |
|---|---|
| **Nyelvválasztó (HU / EN / IT)** | Melyik nyelvi változatot szerkeszted |
| **Oldalválasztó** | Melyik oldalt szerkeszted (Főoldal, Rólunk, Referenciák, Blog…) |
| **📄 Tartalom** | Új oldal, blogbejegyzések, korábbi publikálások |
| **Nézetek** | Élő szerkesztés · Elrendezés · Lista |
| **⚙ Eszközök** | Színek, mobil előnézet, előnézet frissítése |
| **↶ ↷** | Visszavonás és újra |
| **MENTÉS** | Piszkozatba ment (a látogatók még nem látják) |
| **PUBLIKÁLÁS** | Közzététel az élő weboldalon |

**A három nézet:**

- **Élő szerkesztés** — a honlapot látod, és közvetlenül abba írsz. Ez a
  legtermészetesebb mód; a legtöbb munkát itt fogod végezni.
- **Elrendezés** — a szekciók sorrendje, elrejtése, új szekció beszúrása.
- **Lista** — az oldal összes szerkeszthető mezője egy hosszú listában, a mező
  nevével együtt. Akkor hasznos, ha keresel valamit, vagy ha egy szöveg az élő
  nézetben nehezen kattintható.

---

## 3. Meglévő tartalom módosítása

### Szöveg

Élő szerkesztés nézetben **kattints a szövegre**, és írd át. A változást azonnal
látod. Kattints mellé, és kész.

Ha egy szöveget nem tudsz elérni kattintással, válts **Lista** nézetre, és ott
keresd meg a mezőt.

### Kép

Kattints a képre. Megjelenik a feltöltő: válaszd ki a géped egyik fájlját, és a
kép kicserélődik. A feltöltött képeket a rendszer tárolja, nem kell külön
kezelned őket.

Ajánlott formátum: **JPG** vagy **WEBP**, fotókhoz legalább 1600 pixel széles.
A logókat és ikonokat hagyd SVG-ben.

### Hivatkozás (link)

A gomboknál és a menüpontoknál két dolgot lehet állítani: a **feliratot** (mi
legyen ráírva) és a **célt** (hová vigyen). A cél megadásakor a rendszer
felkínálja a honlap meglévő oldalait — nem kell címet gépelned.

### Háttérkép

A nagy háttérképeknél a képen kívül a **kivágás helyét** és a **méretezést** is
be tudod állítani, ha a kép rosszul igazodna.

### Listaelemek (projekt, vélemény, partner…)

Ahol több egyforma elem van egymás mellett — projektkártyák, vélemények,
partnerek —, ott **új elemet is hozzáadhatsz**, és a meglévőket **törölheted**.
Az új elem a meglévők mintájára jön létre, utána átírod a tartalmát.

---

## 4. Mentés és publikálás

Ez a két gomb **nem ugyanaz**, és érdemes tudni a különbséget:

**MENTÉS** — piszkozatba ment. A munkád megmarad, de **a látogatók még nem
látják**. Bátran ments gyakran. A rendszer magától is ment néhány másodperccel
az utolsó módosítás után, és akkor is, ha átváltasz egy másik böngészőfülre.

**PUBLIKÁLÁS** — közzéteszi a változásokat. Az élő weboldalon **körülbelül egy
perc múlva** jelennek meg. A publikálás mindig a **kiválasztott nyelvre**
vonatkozik: ha magyarul publikálsz, az angol és olasz változat nem változik.

> **Tipp:** mielőtt publikálsz, nézd át az oldalt az ⚙ Eszközök menü **mobil
> előnézetével** is. A látogatók több mint fele telefonról érkezik.

---

## 5. Új tartalom létrehozása

### Új aloldal

**📄 Tartalom → Oldalak.** Add meg az oldal nevét — ez lesz egyben a menüpont
neve is —, és válaszd ki, miből készüljön:

- **Szerkeszthető blokkok** — a rendszer felépít egy oldalt a meglévő
  szekciótípusokból, és minden eleme szerkeszthető lesz. A legtöbb esetben ezt
  válaszd.
- **Kész fájl feltöltése** — ha van egy kész HTML-oldalad, feltöltheted.

Az új oldal automatikusan bekerül a menübe és az oldaltérképbe. Az első
publikálás után lesz elérhető; addig a szerkesztő „Az oldal még épül…" üzenetet
mutat, és magától megnyílik, amint kész.

### Új szekció meglévő oldalon

**Elrendezés** nézet → **Új szekció**. Választhatsz a kész szekciótípusokból
(szöveg, kártyák, idézet, lépések, GYIK, videó, kapcsolat…). A beszúrt szekciót
ugyanúgy szerkeszted, mint a többit, és a sorrendjét is te állítod be.

### Blogbejegyzés

**📄 Tartalom → Blog.** Itt írod meg a cikket: cím, borítókép, szerző, címkék,
szöveg. A bejegyzés lehet **Piszkozat** (nem látszik) vagy **Publikált**. A
publikált cikkek automatikusan megjelennek a blog oldalán és az RSS-ben.

---

## 6. Nyelvek

A honlap három nyelven érhető el: **magyar, angol, olasz**. A nyelvek
**egymástól függetlenek**: a magyar szöveg átírása nem változtatja meg az
angolt.

Ez azt is jelenti, hogy egy új tartalmat **mindhárom nyelven külön** kell
megírnod és külön publikálnod, ha azt akarod, hogy mindenhol megjelenjen.

A nyelvváltáskor a rendszer figyelmeztet, ha van mentetlen munkád.

---

## 7. Színek

**⚙ Eszközök → Színek.** Itt az oldal alapszínei állíthatók.

A honlap színei az arculati kézikönyv szerint vannak beállítva (antracit, lime,
acél). **Ezekhez csak akkor nyúlj, ha az arculat is változik** — különben az
oldal elveszti az egységes megjelenését. Egy gombbal bármikor visszaállítható az
alapállapot.

---

## 8. Visszavonás és korábbi állapotok

Három biztonsági háló van:

1. **Visszavonás (↶)** — az utolsó lépéseket vonja vissza, mint egy
   szövegszerkesztőben. Billentyűvel: `Ctrl+Z`.
2. **Korábbi publikálások** — **📄 Tartalom → Verziók.** Minden publikálás
   elmentődik. Ha valami félresikerült, egy kattintással visszaállhatsz egy
   korábbi állapotra.
3. **Egyidejű szerkesztés védelme** — ha valaki más is szerkesztette ugyanazt az
   oldalt, a rendszer szól, és nem engedi felülírni a munkáját.

---

## 9. Billentyűparancsok

| Billentyű | Mit csinál |
|---|---|
| `Ctrl` + `S` | Mentés piszkozatba |
| `Ctrl` + `Z` | Visszavonás |
| `Ctrl` + `Shift` + `Z` | Újra |
| `1` / `2` / `3` | Váltás a nézetek között |
| `Esc` | Bemutató vagy ablak bezárása |

(Mac-en `Ctrl` helyett `Cmd`.)

---

## 10. Amit ne írj át

A honlapon van néhány **kötelezően közzéteendő** szöveg. Ezeket a rendszer
szándékosan **nem** teszi szerkeszthetővé, hogy véletlenül se lehessen
módosítani:

- a **Pályázatok** oldalak tartalma (projektazonosítók, támogatási összegek,
  határidők, a kedvezményezett neve és a megvalósítás helyszíne),
- a **kedvezményezetti infoblokk** a főoldal tetején,
- a **Demján Sándor Program** védjegye, a **Neumann János Nonprofit Közhasznú
  Kft.** logója és a hozzájuk tartozó mondat a footerben,
- az **adatkezelési tájékoztató** és a **sütikezelési szabályzat** szövege.

Ha ezek bármelyikén változtatni kell, szólj a fejlesztőnek — ezek pontossága
ellenőrzés tárgya lehet.

---

## 11. Gyakori kérdések

**Mentettem, de az élő oldalon nem látszik.**
A mentés piszkozatba ment. Nyomd meg a **PUBLIKÁLÁS** gombot is, és várj
körülbelül egy percet.

**Publikáltam, de a régi változatot látom.**
A böngésző a korábbi verziót mutatja a gyorsítótárból. Frissíts erősen:
`Ctrl` + `Shift` + `R` (Mac-en `Cmd` + `Shift` + `R`).

**Egy szöveget nem tudok kattintással elérni.**
Válts **Lista** nézetre, ott minden mező megtalálható.

**Átírtam valamit, de meggondoltam magam.**
Ha még nem publikáltál: `Ctrl` + `Z`, vagy töltsd újra az oldalt mentés nélkül.
Ha már publikáltál: **📄 Tartalom → Verziók**, és állíts vissza egy korábbi
állapotot.

**Elrontok valamit, ha kipróbálom?**
Nem. Amíg nem nyomsz PUBLIKÁLÁS-t, a látogatók semmit nem látnak a
változtatásaidból.

---

*Kérdés esetén keresd a fejlesztőt. Ez az útmutató a honlappal együtt frissül;
a legfrissebb változata mindig a projekt `docs/` mappájában található.*
