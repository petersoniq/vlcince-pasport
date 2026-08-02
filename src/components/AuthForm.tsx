import { useState } from 'react';
import { LogIn, UserPlus, Loader2, TreePine, X } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface Props {
  initialMode?: 'login' | 'register';
  onClose?: () => void;
}

export default function AuthForm({ initialMode = 'login', onClose }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);

    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password);

    if (result.error) {
      setError(result.error);
    } else if (mode === 'register') {
      setInfo('Registrácia prebehla. Ak je potvrdenie e-mailu zapnuté, skontroluj si schránku.');
    }
    setSubmitting(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="self-end text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          aria-label="Zavrieť"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      <div className="flex flex-col items-center gap-2 text-center">
        <TreePine className="h-10 w-10 text-[rgb(var(--brand-700))]" />
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Vlčince – Pasport</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login' ? 'Prihlás sa a začni zbierať dáta v teréne.' : 'Vytvor si účet pre zber dát.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="meno@priklad.sk"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Heslo
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="min. 6 znakov"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {info && (
          <div className="rounded-lg bg-[rgb(var(--brand-50))] px-3 py-2 text-sm text-[rgb(var(--brand-700))]">{info}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-lg bg-[rgb(var(--brand-600))] px-4 py-3 font-semibold text-white transition hover:bg-[rgb(var(--brand-700))] disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : mode === 'login' ? (
            <LogIn className="h-5 w-5" />
          ) : (
            <UserPlus className="h-5 w-5" />
          )}
          {mode === 'login' ? 'Prihlásiť sa' : 'Registrovať sa'}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError(null);
          setInfo(null);
        }}
        className="text-center text-sm text-[rgb(var(--brand-700))] hover:underline"
      >
        {mode === 'login' ? 'Nemáš účet? Zaregistruj sa' : 'Už máš účet? Prihlás sa'}
      </button>
    </div>
  );
}
