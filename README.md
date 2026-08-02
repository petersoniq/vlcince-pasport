# Vlčince – Pasport mobiliáru a zelene

Komunitná PWA appka na pasportizáciu (zber a vizualizáciu) mobiliáru a zelene
sídliska Vlčince, Žilina. Zber dát v teréne (offline-first), interaktívna mapa,
štatistiky, správa používateľov a rolí, push notifikácie pre adminov.

🔗 **Live appka:** https://petersoniq.github.io/vlcince-pasport/

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + PostGIS, Auth, Storage, Realtime, Edge Functions)
- **Mapa:** Leaflet + react-leaflet + marker clustering
- **PWA:** vite-plugin-pwa (injectManifest), Web Push notifikácie
- **Hosting:** GitHub Pages, automatický deploy cez GitHub Actions pri každom push do `main`

## Vývoj

```bash
npm install
cp .env.local.example .env.local   # doplň Supabase + VAPID kľúče
npm run dev
```

## Nasadenie

Push do `main` vetvy automaticky spustí `.github/workflows/deploy.yml`:
build appky (s injektovanými secrets) → nasadenie na GitHub Pages.

Repo secrets (Settings → Secrets and variables → Actions):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`

Appka automaticky funguje aj na koreňovej doméne (napr. Netlify) aj v podpriečinku
(GitHub Pages `/vlcince-pasport/`) vďaka `VITE_BASE_PATH` premennej vo workflow.

## Databázová schéma

Kompletná SQL schéma (tabuľky, RLS politiky, triggery, Edge Functions) je
v `supabase/schema.sql`.
