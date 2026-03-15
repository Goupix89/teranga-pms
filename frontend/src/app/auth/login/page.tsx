'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuthStore';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';

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
      setAuth(data.data.accessToken, data.data.user);
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
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm mb-8">
            <span className="text-2xl font-bold">H</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            Hotel PMS
          </h1>
          <p className="mt-4 text-lg text-primary-100 leading-relaxed">
            Plateforme complète de gestion hôtelière. Gérez vos chambres, réservations, factures
            et stocks depuis une interface unique.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { n: '8+', l: 'Modules intégrés' },
              { n: '100%', l: 'Multi-tenant' },
              { n: 'POS', l: 'App Android incluse' },
              { n: 'API', l: 'Channel Manager' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/10 backdrop-blur-sm p-4">
                <p className="text-2xl font-bold">{s.n}</p>
                <p className="text-sm text-primary-200">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white font-bold">
              H
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900">Connexion</h2>
          <p className="mt-1 text-sm text-gray-500">
            Accédez à votre espace de gestion
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="label">Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@hoteldemo.com"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

          <p className="mt-6 text-center text-sm text-gray-500">
            Pas encore de compte ?{' '}
            <Link href="/auth/register" className="font-medium text-primary-600 hover:text-primary-700">
              Inscrivez-vous
            </Link>
          </p>

          <div className="mt-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Compte de démonstration :</p>
            <p className="text-xs text-gray-600">Email: <code className="bg-white px-1.5 py-0.5 rounded text-primary-700">admin@hoteldemo.com</code></p>
            <p className="text-xs text-gray-600 mt-1">Mot de passe: <code className="bg-white px-1.5 py-0.5 rounded text-primary-700">Admin123!</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
