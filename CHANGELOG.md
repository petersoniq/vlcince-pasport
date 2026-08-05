# Changelog

Všetky významné zmeny v tomto projekte sú zaznamenané v tomto súbore.

Formát vychádza z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
a projekt sa riadi [Semantic Versioning](https://semver.org/lang/sk/).

## [1.3.1] – 2026-08-05

### Opravené
- Tlačidlo prepínania heatmapy prekrývalo Leaflet zoom +/− ovládač (bolo umiestnené na rovnaké miesto vľavo hore) - presunuté vpravo hore pod legendu

## [1.3.0] – 2026-08-05

Druhá vlna nového vizuálneho dizajnu (heatmapa + mini-mapa polohy).

### Pridané
- **Heatmapa hustoty hlásení** na mape – prepínacie tlačidlo (plameň vpravo hore) zobrazí tepelnú mapu poškodených/chýbajúcich záznamov namiesto jednotlivých značiek, užitočné pre admina pri plánovaní údržby
- **Mini-mapa polohy** v zbernom formulári – malý neinteraktívny náhľad "si tu" priamo pod GPS indikátorom, zobrazuje sa aj pri použití poslednej známej polohy

### Technické
- Leaflet sa v zbernom formulári (predvolená obrazovka appky) načíta lenivo (`React.lazy`) až po získaní GPS súradníc - hlavný balík appky vzrástol len o ~1 kB vďaka zdieľanému chunku s mapovou záložkou

## [1.2.1] – 2026-08-05

### Opravené
- Text kategórií a stavov v Admin paneli (záložka "Kategórie") bol v tmavom režime tmavý a nečitateľný na tmavom pozadí - chýbala farba textu na štítkoch aj vstupných poliach pre pridávanie nových kategórií/stavov
- GitHub Releases pre v1.1.0 a v1.2.0 chýbali (existovali len git tagy) - doplnené so správnym obsahom changelogu

## [1.2.0] – 2026-08-04

Prvá vlna nového vizuálneho dizajnu (podľa dizajn manuálu pre svetlú/tmavú tému).
Farebná téma appky (prepínač zelená/modrá/fialová/ružová) zostáva plne funkčná.

### Pridané
- **Zberný formulár**: kartové tlačidlá kategórií (ikona + text), ikony pri stavoch, zoskupená sekcia "Detail a foto"
- **GPS fallback**: ak signál zlyhá, appka namiesto zablokovania použije poslednú známu polohu z tohto zariadenia (s jasným upozornením)
- **Nastavenia používateľa**: prehľadné karty Profil / Nastavenie aplikácie / O aplikácii, iOS-štýl prepínače, možnosť zmeny hesla
- **Admin dashboard**: nová záložka "Prehľad" so štatistickými kartami (celkový počet, rozdelenie stavov, najaktívnejší zberači, posledná aktualizácia) a zoznamom posledných kritických hlásení

### Poznámka
Heatmapa na mape (z dizajn manuálu) zatiaľ nie je implementovaná - vyžaduje ďalšiu knižnicu
a samostatný krok, plánované do ďalšej verzie.

## [1.1.0] – 2026-08-04

### Pridané
- **Viacnásobné fotky** pri zázname (až 4), s klientskou kompresiou (max. 1600px, JPEG 80%) pred uploadom
- **Konfigurovateľné kategórie a stavy** – admin ich môže pridávať/deaktivovať priamo v appke (Admin panel → Kategórie), namiesto pevných hodnôt v databáze
- **Onboarding tutoriál** – 4-krokový sprievodca pri prvom prihlásení
- **Cleanup nepoužitých fotiek** – admin nástroj na vymazanie osirotených súborov v Storage
- **Background Sync API** – offline záznamy sa teraz dokážu odoslať aj po zatvorení appky (nielen kým je otvorená), vďaka natívnemu prehliadačovému mechanizmu
- **Prístupnosť (a11y)** – skip-link, `aria-current`/`aria-pressed`/`aria-label` na interaktívnych prvkoch, zatváranie modalov klávesou Escape, `role="dialog"` na modaloch

### Zmenené
- Kategórie/stavy prestali byť pevné databázové enumy - teraz sú to konfigurovateľné tabuľky (`categories`, `conditions`) s FK väzbou

## [1.0.0] – 2026-08-02

Prvé stabilné vydanie appky Vlčince – Pasport.

### Pridané

**Zber a vizualizácia dát**
- Offline-first zberná PWA appka s IndexedDB frontou a automatickou synchronizáciou
- Interaktívna mapa (Leaflet) so zhlukovaním markerov, ikonami podľa kategórie a legendou
- Filtrovanie podľa kategórie, stavu, vlastných záznamov a **obdobia vytvorenia (od–do)**
- Štatistiky s grafmi + export do CSV a GeoJSON
- Editácia vlastných záznamov priamo na mape vrátane zmeny polohy ťahaním značky

**Autentifikácia a role**
- Registrácia/prihlásenie cez Supabase Auth
- Role `user`/`admin` s Row Level Security politikami (autor alebo admin môže upravovať/mazať)
- Verejná úvodná obrazovka (mapa dostupná aj bez prihlásenia) s prekliknutím na registráciu/login
- Používateľské profily s avatarom a voliteľným zverejnením kontaktu

**Komunita**
- Diskusia (komentáre) ku každému záznamu
- História zmien stavu (kedy sa čo pokazilo/opravilo)

**Administrácia**
- Admin panel – správa používateľov (zmena role), hromadné akcie nad záznamami (zmena stavu, mazanie)
- Push notifikácie adminom pri nahlásení poškodeného/chýbajúceho záznamu (s ochranou proti zaplaveniu pri hromadných akciách)

**PWA**
- Inštalovateľná ako natívna appka (ikony, manifest, install prompt)
- Vlastný Service Worker s offline cache mapových dlaždíc a tlačidlom na predstiahnutie mapy sídliska

**Dizajn**
- Svetlý/tmavý režim
- Prepínateľná farebná téma appky (zelená/modrá/fialová/ružová)
- Vizuálny GPS indikátor kvality signálu namiesto surových súradníc
- Responzívny layout so správnym `safe-area` a `z-index` vrstvením

**Infraštruktúra**
- Supabase backend (PostgreSQL + PostGIS, Storage, Realtime, Edge Functions)
- Automatický CI/CD deploy na GitHub Pages cez GitHub Actions pri každom push
- Code-splitting (lazy loading) pre zníženie počiatočnej veľkosti appky

### Opravené
- Farba aktívneho tlačidla "Stav" (predtým čierna bez rozlíšenia v tmavom režime, teraz značková farba)
- `touch-action: manipulation` pre spoľahlivejšie kliknutia na mobilných zariadeniach
- Viacero chýbajúcich `dark:` variantov naprieč komponentmi
- Bezpečnostné sprísnenie RLS politík a `EXECUTE` práv na trigger funkciách

---

[1.0.0]: https://github.com/petersoniq/vlcince-pasport/releases/tag/v1.0.0
