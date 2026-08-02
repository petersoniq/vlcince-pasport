import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Kritická chyba konfigurácie - bez týchto premenných by Supabase klient
  // zhodil celú appku na bielu obrazovku ešte pred prvým vykreslením.
  // Namiesto toho zobrazíme zrozumiteľnú hlášku priamo do #root.
  const message =
    'Appka nie je správne nastavená: chýbajú VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Tento build bol zostavený bez .env.local so Supabase kľúčmi.';
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;font-family:sans-serif;color:#b91c1c;background:#fef2f2;">${message}</div>`;
    }
  });
  throw new Error(message);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
