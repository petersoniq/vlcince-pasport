# Nastavenie GitHub Pages nasadenia

Po vytvorení repozitára a pripojení tokenu je potrebné (urobím to za teba, len pre záznam):

1. **Repo Settings → Secrets and variables → Actions** – pridať 3 secrets:
   - `VITE_SUPABASE_URL` = `https://oajbfqrdufsrcyrtsubv.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (anon key z Supabase)
   - `VITE_VAPID_PUBLIC_KEY` = (VAPID public key pre push notifikácie)

2. **Repo Settings → Pages → Source** = "GitHub Actions" (nie "Deploy from branch")

3. **`.github/workflows/deploy.yml`** (už pripravené) automaticky zbuildí a nasadí appku pri
   každom push do `main` vetvy – žiadne manuálne kredity, žiadny drag & drop.

4. Appka pobeží na `https://<username>.github.io/<repo-nazov>/`

5. Ak appka nakoniec dostane vlastnú doménu, treba v `vite.config.ts` zmeniť `VITE_BASE_PATH`
   env premennú v `.github/workflows/deploy.yml` na `/` namiesto `/<repo-nazov>/`.
