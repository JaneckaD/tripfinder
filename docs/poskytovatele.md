# Návrh vyhledávačů pro dopravu a ubytování (ke schválení)

Stav k 4. 11. 2026. Podmínky API se často mění, před napojením je potřeba je ověřit u poskytovatele.

## Doprava

| Poskytovatel | Co nabízí | Přístup k API | Doporučení |
|---|---|---|---|
| **Kiwi.com (Tequila API)** | Letenky, kombinace let + bus/vlak, levné spoje | Partnerský program, registrace firmy, výdělek z provizí | ✅ Dobrý start pro levné lety z ČR |
| **Skyscanner** | Srovnávač letenek napříč prodejci | Jen pro schválené partnery (B2B), pro malý projekt těžko dostupné | ⚠️ Jen odkazy (deep link) |
| **Amadeus for Developers** | Data přímo z GDS aerolinek, ceny a dostupnost letů | Self-service API, zdarma testovací prostředí, v produkci platba za volání | ✅ Nejjednodušší reálné API |
| **FlixBus / RegioJet** | Autobusy a vlaky po Evropě | Bez veřejného API, jen affiliate odkazy | ⚠️ Jen odkazy |
| **Google Flights** | Přehled letů | Bez API | ⚠️ Jen odkazy |

## Ubytování

| Poskytovatel | Co nabízí | Přístup k API | Doporučení |
|---|---|---|---|
| **Booking.com** | Hotely, apartmány, penziony | Affiliate Partner program (schválení nutné), Demand API pro partnery | ✅ Affiliate + odkazy, API po schválení |
| **Airbnb** | Byty, domy, soukromé pokoje | Veřejné API neexistuje | ⚠️ Jen odkazy |
| **Expedia / Hotels.com (Rapid API)** | Hotely, resorty, balíčky | Partner program, schválení nutné | ✅ Volitelně |
| **Hostelworld** | Levné hostely | Affiliate program | ⚠️ Volitelně |
| **Amadeus Hotel API** | Hotely z GDS | Stejný účet jako pro lety | ✅ Rychlá reálná data hotelů |

## Doporučený postup

1. Začít s **Amadeus** (lety + hotely) – reálné ceny hned po registraci zdarma.
2. Přidat **Kiwi.com** pro levné lety a kombinace.
3. U **Booking.com, Airbnb, Skyscanner** zatím ukazovat odkazy s předvyplněným hledáním a API doplnit po schválení partnerství.

V aplikaci stačí přepnout poskytovatele z `mock` na `live` implementaci a nastavit API klíče v proměnných prostředí.
