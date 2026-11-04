# Z čeho můžeme brát data (zdarma nebo skoro zdarma)

Ověřeno 4. 11. 2026. Podmínky se často mění, takže před napojením je ještě jednou zkontroluju u poskytovatele.

**Důležitá změna oproti prvnímu návrhu:** Amadeus zrušil bezplatné API 17. 7. 2026 a Kiwi.com (Tequila) od roku 2024 přijímá nové vývojáře jen na pozvání. Ani jedno tedy použít nejde.

## ✈️ Doprava (lety)

| Možnost | Co dává | Cena | Registrace | Háček |
|---|---|---|---|---|
| **Travelpayouts – Data API (Aviasales)** ✅ | Skutečné ceny letenek, kalendář cen, nejlevnější lety | Zdarma | Zdarma, bez firmy | Ceny jsou z mezipaměti (pár hodin až dní staré), ne živé. Vyděláváš provizi z odkazů. Živé vyhledávání má až od 50 000 uživatelů měsíčně. |
| **SerpApi – Google Flights** ✅ | Živé ceny z Google Flights (všechny aerolinky) | 250 hledání měsíčně zdarma | Zdarma, bez karty | Na malé používání stačí, při víc uživatelích je placený. Výsledky budu ukládat do mezipaměti. |
| **Duffel** | Živé ceny přímo od aerolinek, jde i rezervovat | Testovací režim zdarma (vymyšlená data), ostra verze téměř zdarma | Samoobslužná | Když se nic nerezervuje, platí se malý poplatek za hledání (cca 0,005 $). |
| Kiwi.com – MCP server | Lety bez klíče | Zdarma | Bez registrace | Určený pro AI chaty, není to oficiální API. Spíš experiment. |
| ~~Amadeus~~ | | | | Bezplatné API zrušeno 17. 7. 2026 |
| ~~Kiwi Tequila~~ | | | | Jen na pozvání od 2024 |
| ~~Skyscanner~~ | | | | Jen pro velké partnery |

## 🏨 Ubytování

| Možnost | Co dává | Cena | Registrace | Háček |
|---|---|---|---|---|
| **LiteAPI (Nuitée)** ✅ | Skutečné ceny a dostupnost hotelů po celém světě, jde i rezervovat | Základní funkce zdarma, vydělává se marží z rezervací | Zdarma, bez karty pro testovací klíč | Pro ostrý klíč chce zadat kartu. Testovací režim možná nevrací skutečné ceny. |
| **SerpApi – Google Hotels** ✅ | Ceny jednoho hotelu u více prodejců najednou (Booking.com, Expedia, Hotels.com, Agoda…) | Ze stejných 250 hledání měsíčně zdarma | Zdarma, bez karty | Přesně to „kolik to stojí přes Booking, Expedii…“, ale limit se dělí s lety. |
| StayAPI | Data z Booking, Airbnb, Expedia | Jen 50 požadavků na zkoušku | Bez karty | Pak placené. |
| OpenStreetMap | Polohy hotelů a hostelů | Zdarma | Bez registrace | Bez cen. |
| ~~Booking.com, Airbnb, Expedia~~ | | | | API jen pro schválené partnery (Airbnb nemá žádné). Zůstanou odkazy s předvyplněným hledáním. |
| ~~Hotellook (Travelpayouts)~~ | | | | Zrušeno 20. 10. 2025 |

## 🚆 Vlaky a autobusy

Bezplatné API s cenami jízdenek není. Neoficiální API Deutsche Bahn přestalo fungovat. Pro RegioJet, FlixBus, ČD a Omio proto nechám odkazy s předvyplněným hledáním.

## 🌤️ Bonus: informace o destinacích (zdarma, bez klíče)

- **Open-Meteo**: počasí a předpověď
- **REST Countries**: měna, jazyk, vlajka, předvolba
- **Wikipedie / Wikivoyage**: popis místa a tipy na výlety
- **Unsplash**: fotky destinací (bezplatný klíč)

## Doporučení

1. **Lety:** Travelpayouts (zdarma, bez limitu) a k tomu SerpApi Google Flights pro živou cenu na vyžádání.
2. **Ubytování:** LiteAPI (skutečné hotely) a k tomu SerpApi Google Hotels pro porovnání cen u Booking, Expedie atd.
3. **Booking, Airbnb, Skyscanner, vlaky a autobusy:** odkazy s předvyplněným hledáním, jak už to v aplikaci funguje.
4. **Bonus:** počasí a informace o zemi z Open-Meteo a REST Countries.

Ke každé službě si založíš účet a klíč vložíš do proměnných prostředí. V kódu se klíče neukládají.
