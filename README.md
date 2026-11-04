# TripFinder 🌍

PWA pro hledání a plánování výletů po celém světě: destinace podle kontinentu a filtrů, doprava a ubytování od více poskytovatelů s porovnáním cen, účty, ukládání více výletů, spolucestující a sdílení odkazem.

## Spuštění

Potřebuješ **Node.js 22.13+** (kvůli vestavěné SQLite databázi).

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # s automatickým restartem při změně
npm test           # API testy
```

Proměnné prostředí:

| Proměnná     | Výchozí                 | Popis |
|--------------|-------------------------|-------|
| `PORT`       | `3000`                  | Port serveru |
| `DB_PATH`    | `./data/tripfinder.db`  | Soubor SQLite databáze |
| `PROVIDERS`  | všichni                 | Čárkami oddělená id zapnutých poskytovatelů, např. `kiwi,booking,airbnb` |
| `NODE_ENV`   | –                       | `production` zapne `Secure` cookie (nutné HTTPS) |

## Co umí

- **Hledání** – celý svět nebo kontinent, typ výletu (moře, hory, města, příroda…), rozpočet na osobu, nejlepší sezóna, místo odletu, počet osob, termín, řazení.
- **Detail destinace** – info (měna, jazyk, letiště, sezóna, denní útrata) a pod tím nabídky **dopravy** a **ubytování** od více poskytovatelů seřazené podle ceny, filtrovatelné podle poskytovatele, s odkazem na skutečné vyhledávání u poskytovatele.
- **Účty** – registrace a přihlášení (hesla hashovaná scryptem, session v HttpOnly cookie).
- **Výlety** – libovolný počet, ukládání destinací, dopravy, ubytování a poznámek s cenou, součet rozpočtu a cena na osobu.
- **Spolucestující** – pozvání e-mailem s rolí „upravuje“ nebo „jen čte“. Kdo ještě nemá účet, uvidí výlet hned po registraci.
- **Sdílení** – veřejný odkaz jen pro čtení, jde kdykoli zrušit.
- **PWA** – instalovatelná na mobil i desktop, offline režim pro aplikaci a naposledy načtená data.

## Struktura

```
server/
  index.js            start serveru
  app.js              Express API + servírování PWA
  db.js               SQLite schéma (users, sessions, trips, trip_items, trip_members)
  auth.js             hesla, sessions, middleware
  data/destinations.js  katalog destinací + odhad ceny
  providers/
    index.js          rozhraní a registr poskytovatelů
    mock.js           ukázkoví poskytovatelé (Kiwi, Skyscanner, Amadeus, FlixBus, Booking, Airbnb, Expedia, Hostelworld)
public/               frontend (vanilla JS, bez build kroku), manifest, service worker, ikony
test/                 API testy (node:test)
```

## Poskytovatelé (vyhledávače)

Všechny ceny jsou zatím **ukázkové** (`mode: 'mock'`), odkazy „Otevřít“ ale vedou na skutečné hledání u poskytovatele. Návrh, které skutečné služby napojit, je v [docs/poskytovatele.md](docs/poskytovatele.md). Nový poskytovatel = objekt se stejným rozhraním (`id`, `name`, `kind`, `search(ctx)`) přidaný do `server/providers/index.js`.
