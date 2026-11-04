# TripFinder 🌍

PWA pro hledání a plánování výletů po celém světě: destinace podle kontinentu a filtrů, doprava a ubytování od více poskytovatelů s porovnáním cen, účty, ukládání více výletů, spolucestující a sdílení odkazem.

## Nasazení na internet

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/JaneckaD/tripfinder)

Nejdřív si založ bezplatnou databázi **Turso**, aby se účty a výlety neztrácely (disk na bezplatném Renderu se při každém uspání smaže):

1. Zaregistruj se na [turso.tech](https://turso.tech) (přes GitHub, zdarma).
2. *Databases → Create Database*, název třeba `tripfinder`, region nejblíž (např. Frankfurt).
3. U databáze zkopíruj **URL** (`libsql://tripfinder-….turso.io`) a vytvoř token (*Create Token*, bez expirace).

Pak klikni na tlačítko, přihlas se na Render přes GitHub a potvrď. Render se zeptá na `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` a API klíče (ty můžeš nechat prázdné) a za pár minut dostaneš adresu typu `https://tripfinder-xxxx.onrender.com`. Každé sloučení do `main` se nasadí samo.

Bezplatný tarif po 15 minutách nečinnosti usne a první načtení pak trvá asi 30 až 60 sekund.

## Spuštění

Potřebuješ **Node.js 22+**. Lokálně se data ukládají do souboru `data/tripfinder.db`, s proměnnými `TURSO_DATABASE_URL` a `TURSO_AUTH_TOKEN` do cloudové databáze Turso.

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
| `PROVIDERS`  | všichni                 | Čárkami oddělená id zapnutých poskytovatelů, např. `travelpayouts,serpapi,airbnb` |
| `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER` | – | Letenky z Aviasales (viz níže) |
| `SERPAPI_KEY`, `SERPAPI_MONTHLY_LIMIT` | –, `240` | Google Flights + Airbnb |
| `NODE_ENV`   | –                       | `production` zapne `Secure` cookie (nutné HTTPS) |

## Co umí

- **Hledání** – celý svět nebo kontinent, typ výletu (moře, hory, města, příroda…), rozpočet na osobu, nejlepší sezóna, místo odletu, počet osob, termín, řazení.
- **Detail destinace** – info (měna, jazyk, letiště, sezóna, denní útrata) a pod tím nabídky **dopravy** a **ubytování** od více poskytovatelů seřazené podle ceny, filtrovatelné podle poskytovatele, s odkazem na skutečné vyhledávání u poskytovatele.
- **Libovolné místo na světě** – našeptávač Odkud/Kam hledá města, adresy i památky přes [Photon](https://photon.komoot.io) (OpenStreetMap, bez klíče) a ke každému místu dohledá nejbližší letiště (databáze OurAirports v `server/data/airports.json`).
- **Spoje s přestupy** – let s přestupem, doprava na letiště a z letiště, přímý vlak/autobus i kombinace vlak + autobus. Každý spoj i ubytování jde rozkliknout do detailu (jízdní řád po úsecích, mapa, fotky).
- **Okružní cesta** – více měst a zemí za sebou, noci v každé zastávce, doprava mezi nimi a ubytování, mapa trasy a uložení jako výlet.
- **Mapa** – Leaflet + dlaždice CARTO Voyager; lety oranžovo-červeně obloukem, vlaky modře, autobusy zeleně.
- **Akce na půl roku** – nejlevnější letenky (Travelpayouts `prices/latest`, bez klíče ukázkové ceny) a zvýhodněné ubytování po měsících.
- **Prozkoumat** – mapa s piny s fotkami zajímavých míst v okolí (příroda, památky, kultura) z Wikipedie, detail místa a navigace k němu.
- **Pěšky a autem** – trasy po cestách a silnicích z OpenStreetMap ([OSRM na routing.openstreetmap.de](https://routing.openstreetmap.de)) s pokyny po krocích a odkazem do Google Maps.
- **Ubytování jen z Airbnb** – se `SERPAPI_KEY` skutečné inzeráty (SerpApi `engine=airbnb`) s fotkami a přímým odkazem na inzerát, bez klíče ukázka s odkazem na hledání Airbnb ve stejném místě a termínu.
- **Cestovatelský pas** – dokončený výlet přidá do profilu razítko každé navštívené země (Francie má croissant, Itálie pizzu…).
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
  db.js               databáze libSQL/Turso a schéma (users, sessions, trips, trip_items, trip_members)
  auth.js             hesla, sessions, middleware
  data/destinations.js  katalog destinací + odhad ceny
  providers/
    index.js          rozhraní a registr poskytovatelů
    mock.js           ukázková data + odkazy na Booking, Airbnb, Skyscanner…
    live/             skuteční poskytovatelé (Travelpayouts, SerpApi – Google Flights a Airbnb), mezipaměť a limity
public/               frontend (vanilla JS, bez build kroku), manifest, service worker, ikony
test/                 API testy (node:test)
```

## Skutečné ceny (API klíče)

Bez klíčů běží aplikace s ukázkovými cenami. Jakmile vložíš klíč, příslušný poskytovatel se zapne sám. Zkopíruj `.env.example` jako `.env`, doplň klíče a restartuj server (`npm start` soubor `.env` načte automaticky).

1. **Travelpayouts** (letenky, zdarma): zaregistruj se na [travelpayouts.com](https://www.travelpayouts.com), připoj program Aviasales a v sekci *Tools → API* zkopíruj **API token** do `TRAVELPAYOUTS_TOKEN`. Číslo partnera (*marker*) dej do `TRAVELPAYOUTS_MARKER`, pak dostáváš provizi z rezervací přes odkazy.
2. **SerpApi** (Google Flights + Airbnb, 250 hledání měsíčně zdarma): registrace na [serpapi.com](https://serpapi.com), klíč z *Dashboard → Your API Key* do `SERPAPI_KEY`. Aplikace výsledky ukládá na 24 hodin a po `SERPAPI_MONTHLY_LIMIT` hledáních v měsíci SerpApi sama vypne.

Když nějaké API selže, aplikace ukáže upozornění a zbylé výsledky. Booking.com, Airbnb, Skyscanner, Kiwi a vlaky nemají bezplatné API, takže se pod výsledky zobrazují jako odkazy „Porovnat i na…“ s předvyplněným hledáním.

## Poskytovatelé (vyhledávače)

Všechny ceny jsou zatím **ukázkové** (`mode: 'mock'`), odkazy „Otevřít“ ale vedou na skutečné hledání u poskytovatele. Přehled, které skutečné služby jde zdarma napojit, je v [docs/poskytovatele.md](docs/poskytovatele.md). Nový poskytovatel = objekt se stejným rozhraním (`id`, `name`, `kind`, `search(ctx)`) přidaný do `server/providers/index.js`.
