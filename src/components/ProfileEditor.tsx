import { useEffect, useState } from 'react';
import { User, Camera, Loader2, Check, LogOut, ShieldCheck, Bell, Palette, KeyRound, LifeBuoy } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { pushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '../lib/push';
import { useAccent, ACCENT_OPTIONS } from '../lib/accent';
import { APP_VERSION, APP_RELEASE_DATE } from '../version';
import Toggle from './Toggle';

interface Props {
  onClose: () => void;
}

/** Karta so sekciou - jednotný vizuálny obal (podľa dizajn manuálu:
 *  "Profil" / "Nastavenie aplikácie" / "O aplikácii" ako samostatné bloky). */
function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export default function ProfileEditor({ onClose }: Props) {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [contactEmail, setContactEmail] = useState(profile?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(profile?.contact_phone ?? '');
  const [showContact, setShowContact] = useState(profile?.show_contact ?? false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  useEffect(() => {
    if (pushSupported()) {
      isPushSubscribed().then(setPushSubscribed);
    }
  }, []);

  if (!user) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setError(null);

    const path = `${user.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      setError(`Nahranie avataru zlyhalo: ${uploadError.message}`);
      setAvatarUploading(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
    setAvatarUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        show_contact: showContact,
        avatar_url: avatarUrl,
      })
      .eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const handleTogglePush = async (next: boolean) => {
    setPushBusy(true);
    setPushError(null);
    if (!next) {
      await unsubscribeFromPush();
      setPushSubscribed(false);
    } else {
      const { error: subError } = await subscribeToPush(user.id);
      if (subError) setPushError(subError);
      else setPushSubscribed(true);
    }
    setPushBusy(false);
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    setResettingPassword(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email);
    setResettingPassword(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setPasswordResetSent(true);
    setTimeout(() => setPasswordResetSent(false), 5000);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Hlavička s avatarom - centrovaná, podľa dizajn manuálu */}
      <div className="flex flex-col items-center gap-2 pb-1">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-9 w-9 text-slate-400" />
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[rgb(var(--brand-600))] text-white shadow">
            {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {displayName || 'Bez mena'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
        {isAdmin && (
          <span className="flex items-center gap-1 rounded-full bg-[rgb(var(--brand-100))] px-2 py-1 text-xs font-medium text-[rgb(var(--brand-700))] dark:bg-[rgb(var(--brand-900))] dark:text-[rgb(var(--brand-300))]">
            <ShieldCheck className="h-3.5 w-3.5" /> Administrátor
          </span>
        )}
      </div>

      {/* Karta: Profil */}
      <SettingsCard title="Profil">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div>
            <label htmlFor="display_name" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Zobrazované meno
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="napr. Peter Z."
            />
          </div>

          <div>
            <label htmlFor="contact_email" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Kontaktný e-mail (voliteľné)
            </label>
            <input
              id="contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="contact_phone" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Telefón (voliteľné)
            </label>
            <input
              id="contact_phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showContact}
              onChange={(e) => setShowContact(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-[rgb(var(--brand-600))] dark:border-slate-600"
            />
            Zobrazovať kontakt verejne pri mojich príspevkoch
          </label>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-lg bg-[rgb(var(--brand-600))] px-4 py-2.5 font-semibold text-white transition hover:bg-[rgb(var(--brand-700))] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Uložiť profil
          </button>
          {saved && <p className="text-center text-sm text-[rgb(var(--brand-700))] dark:text-[rgb(var(--brand-400))]">Profil bol uložený.</p>}
        </form>

        <button
          onClick={handlePasswordReset}
          disabled={resettingPassword}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {resettingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
          Zmeniť heslo
        </button>
        {passwordResetSent && (
          <p role="status" className="text-center text-xs text-[rgb(var(--brand-700))] dark:text-[rgb(var(--brand-400))]">
            Odkaz na zmenu hesla bol odoslaný na {user.email}.
          </p>
        )}
      </SettingsCard>

      {/* Karta: Nastavenie aplikácie */}
      <SettingsCard title="Nastavenie aplikácie">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-300">Tmavý režim</span>
          <Toggle checked={theme === 'dark'} onChange={toggleTheme} label="Prepnúť tmavý režim" />
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Palette className="h-4 w-4" />
            Farebná téma
          </div>
          <div className="flex gap-2">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setAccent(opt.key)}
                title={opt.label}
                aria-label={opt.label}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  accent === opt.key ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-800' : ''
                }`}
                style={{ backgroundColor: opt.swatch }}
              >
                {accent === opt.key && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && pushSupported() && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Bell className="h-4 w-4" />
              Upozornenia (poškodené/chýbajúce)
            </span>
            <Toggle checked={pushSubscribed} onChange={handleTogglePush} disabled={pushBusy} label="Upozornenia na kritické záznamy" />
          </div>
        )}
        {pushError && <p className="text-xs text-red-600">{pushError}</p>}
      </SettingsCard>

      {/* Karta: O aplikácii */}
      <SettingsCard title="O aplikácii">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Verzia</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {APP_VERSION} ({new Date(APP_RELEASE_DATE).toLocaleDateString('sk-SK')})
          </span>
        </div>
        <a
          href="mailto:podpora@vlcince-pasport.app"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          Podpora
        </a>
      </SettingsCard>

      <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Zavrieť
        </button>
        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" /> Odhlásiť sa
        </button>
      </div>
    </div>
  );
}
