import { useState } from 'react';
import { MapPin, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-ink p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-brand to-duty">
            <MapPin size={18} className="text-white" />
          </div>
          <span className="font-bold text-white">FieldForce</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-[-0.03em] text-white">
            Every duty hour, visit and order in one place.
          </h1>
          <p className="mt-4 leading-relaxed text-slate-400">
            Onboard your field team, watch the day unfold on the live map, and
            close the month with numbers you can trust.
          </p>
        </div>

        <p className="text-xs text-slate-500">
          Location is recorded only during duty hours, and only for employees
          whose tracking you have enabled.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-brand to-duty">
              <MapPin size={20} className="text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-[-0.03em]">
            Sign in to the console
          </h2>
          <p className="mt-2 text-sm text-muted">
            Admin and manager accounts only.
          </p>

          {error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-bad-wash px-4 py-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-bad" />
              <p className="text-[13px] leading-snug text-bad">{error}</p>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">
                Email
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                autoComplete="username"
                placeholder="you@company.com"
                className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">
                Password
              </span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 pr-11 text-sm outline-none placeholder:text-muted focus:border-indigo-brand"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button
              onClick={submit}
              disabled={busy}
              className="w-full rounded-xl bg-indigo-brand py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-deep disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
