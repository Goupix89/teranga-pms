'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuthStore';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';

function KubaPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
      <defs>
        <pattern id="kuba" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 12L12 0L24 12L12 24Z" fill="none" stroke="#D4A857" strokeWidth="0.5" />
          <circle cx="12" cy="12" r="1.5" fill="#B85042" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kuba)" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.data.accessToken, data.data.refreshToken, data.data.user);
      toast.success(`Bienvenue, ${data.data.user.firstName} !`);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erreur de connexion';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding with Kuba pattern */}
      <div className="hidden lg:flex lg:w-1/2 bg-wood-800 items-center justify-center p-12 relative overflow-hidden">
        <KubaPattern />
        <div className="max-w-md relative z-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/20 backdrop-blur-sm mb-8">
            <span className="text-2xl font-bold text-accent-500">T</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight text-accent-500">
            TERANGA
          </h1>
          <p className="mt-2 text-lg text-wood-400 font-display italic">
            L&apos;hospitalit&eacute; connect&eacute;e
          </p>
          <p className="mt-4 text-base text-wood-400 leading-relaxed">
            Plateforme compl&egrave;te de gestion h&ocirc;teli&egrave;re. G&eacute;rez vos chambres, r&eacute;servations, commandes
            et stocks depuis une interface unique.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { n: '8+', l: 'Modules intégrés' },
              { n: '100%', l: 'Multi-tenant' },
              { n: 'POS', l: 'App Android incluse' },
              { n: 'API', l: 'Channel Manager' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/5 backdrop-blur-sm p-4 border border-accent-500/10">
                <p className="text-2xl font-bold text-accent-500">{s.n}</p>
                <p className="text-sm text-wood-400">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Decorative mask motif */}
          <div className="mt-12 flex justify-center opacity-30">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <rect x="24" y="12" width="32" height="44" rx="16" fill="none" stroke="#D4A857" strokeWidth="1.5"/>
              <circle cx="34" cy="30" r="4" fill="none" stroke="#B85042" strokeWidth="1.5"/>
              <circle cx="46" cy="30" r="4" fill="none" stroke="#B85042" strokeWidth="1.5"/>
              <line x1="40" y1="38" x2="40" y2="48" stroke="#A7BEAE" strokeWidth="1.5"/>
              <line x1="34" y1="48" x2="46" y2="48" stroke="#A7BEAE" strokeWidth="1.5"/>
              <path d="M28 60L40 72L52 60" fill="none" stroke="#D4A857" strokeWidth="1" strokeDasharray="3 2"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-wood-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white font-bold">
              T
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold text-wood-800">Connexion</h2>
          <p className="mt-1 text-sm text-wood-500">
            Acc&eacute;dez &agrave; votre espace de gestion
          </p>

          {/* Teranga divider */}
          <div className="divider-teranga my-6" />

          {error && (
            <div className="mb-4 rounded-lg bg-primary-50 border border-primary-200 p-3">
              <p className="text-sm text-primary-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="daf@hoteldemo.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-wood-400 hover:text-wood-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-wood-500">
            Pas encore de compte ?{' '}
            <Link href="/auth/register" className="font-semibold text-primary-500 hover:text-primary-600">
              Inscrivez-vous
            </Link>
          </p>

          <div className="mt-6 rounded-lg bg-wood-100 border border-wood-200 p-4">
            <p className="text-xs font-semibold text-wood-500 mb-2">Compte de d&eacute;monstration :</p>
            <p className="text-xs text-wood-600">Email: <code className="bg-white px-1.5 py-0.5 rounded text-primary-600 font-mono">daf@hoteldemo.com</code></p>
            <p className="text-xs text-wood-600 mt-1">Mot de passe: <code className="bg-white px-1.5 py-0.5 rounded text-primary-600 font-mono">Daf12345!</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
