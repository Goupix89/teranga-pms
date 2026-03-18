'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Check, ArrowLeft, ArrowRight } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: {
    maxEstablishments: number;
    maxRooms: number;
    maxUsers: number;
    channelManager: boolean;
    posApp: boolean;
  };
}

const FEATURE_LABELS: Record<string, string> = {
  maxEstablishments: 'Établissements',
  maxRooms: 'Chambres',
  maxUsers: 'Utilisateurs',
  channelManager: 'Channel Manager',
  posApp: 'App POS Android',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [form, setForm] = useState({
    tenantName: '',
    slug: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      toast.error('Paiement annulé. Vous pouvez réessayer.');
    }
  }, [searchParams]);

  useEffect(() => {
    api.get('/registration/plans')
      .then(({ data }) => setPlans(data.data))
      .catch(() => toast.error('Impossible de charger les plans'))
      .finally(() => setLoadingPlans(false));
  }, []);

  // Auto-generate slug from tenant name
  const handleTenantNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      tenantName: value,
      slug: value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    }));
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};

    if (form.tenantName.length < 2) errs.tenantName = 'Minimum 2 caractères';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(form.slug) || form.slug.length < 3)
      errs.slug = 'Slug invalide (min 3 caractères, minuscules/chiffres/tirets)';
    if (!form.email.includes('@')) errs.email = 'Email invalide';
    if (form.firstName.length < 1) errs.firstName = 'Requis';
    if (form.lastName.length < 1) errs.lastName = 'Requis';
    if (form.password.length < 8) errs.password = 'Minimum 8 caractères';
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Au moins une majuscule';
    else if (!/[0-9]/.test(form.password)) errs.password = 'Au moins un chiffre';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Les mots de passe ne correspondent pas';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post('/registration/register', {
        tenantName: form.tenantName,
        slug: form.slug,
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        planSlug: selectedPlan,
        billingInterval: yearly ? 'YEARLY' : 'MONTHLY',
      });

      // Redirect to Stripe Checkout
      window.location.href = data.data.checkoutUrl;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'inscription';
      toast.error(msg);
      setLoading(false);
    }
  };

  const currentPlan = plans.find((p) => p.slug === selectedPlan);

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm mb-8">
            <span className="text-2xl font-bold">H</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight">Hotel PMS</h1>
          <p className="mt-4 text-lg text-primary-100 leading-relaxed">
            Créez votre compte et commencez à gérer votre hôtel en quelques minutes.
          </p>
          <div className="mt-10 space-y-4">
            {['Gestion complète multi-établissements', 'Réservations & facturation intégrées', 'App POS Android incluse', 'Support & mises à jour continues'].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span className="text-primary-100">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — registration form */}
      <div className="flex w-full lg:w-1/2 items-start justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-lg py-8">
          <div className="lg:hidden mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white font-bold">
              H
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  s < step ? 'bg-primary-600 text-white' :
                  s === step ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {s < step ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && <div className={`h-0.5 w-8 ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
            <span className="ml-2 text-sm text-gray-500">
              {step === 1 ? 'Plan' : step === 2 ? 'Compte' : 'Confirmation'}
            </span>
          </div>

          {/* Step 1: Choose Plan */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Choisissez votre plan</h2>
              <p className="mt-1 text-sm text-gray-500">Sélectionnez le plan adapté à vos besoins</p>

              {/* Billing toggle */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <span className={`text-sm ${!yearly ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>Mensuel</span>
                <button
                  type="button"
                  onClick={() => setYearly(!yearly)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${yearly ? 'bg-primary-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${yearly ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-sm ${yearly ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                  Annuel <span className="text-xs text-green-600 font-medium">-17%</span>
                </span>
              </div>

              {loadingPlans ? (
                <div className="mt-8 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {plans.map((plan) => {
                    const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
                    const isSelected = selectedPlan === plan.slug;

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan.slug)}
                        className={`w-full rounded-xl border-2 p-5 text-left transition-all ${
                          isSelected
                            ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                            <p className="mt-1 text-2xl font-bold text-gray-900">
                              {price} <span className="text-sm font-normal text-gray-500">EUR/{yearly ? 'an' : 'mois'}</span>
                            </p>
                          </div>
                          <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                            isSelected ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(plan.features).map(([key, value]) => {
                            const label = FEATURE_LABELS[key] || key;
                            if (typeof value === 'boolean') {
                              if (!value) return null;
                              return (
                                <span key={key} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700">
                                  <Check className="h-3 w-3" /> {label}
                                </span>
                              );
                            }
                            return (
                              <span key={key} className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                                {value === -1 ? 'Illimité' : value} {label.toLowerCase()}
                              </span>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedPlan}
                className="btn-primary w-full py-3 mt-6"
              >
                Continuer <ArrowRight className="ml-2 h-4 w-4 inline" />
              </button>

              <p className="mt-4 text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <Link href="/auth/login" className="font-medium text-primary-600 hover:text-primary-700">
                  Se connecter
                </Link>
              </p>
            </div>
          )}

          {/* Step 2: Account Details */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Créez votre compte</h2>
              <p className="mt-1 text-sm text-gray-500">Informations de votre organisation et administrateur</p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="label">Nom de l&apos;hôtel / organisation</label>
                  <input
                    type="text"
                    value={form.tenantName}
                    onChange={(e) => handleTenantNameChange(e.target.value)}
                    className="input"
                    placeholder="Mon Hôtel"
                  />
                  {errors.tenantName && <p className="mt-1 text-xs text-red-600">{errors.tenantName}</p>}
                </div>

                <div>
                  <label className="label">Identifiant unique (slug)</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className="input"
                    placeholder="mon-hotel"
                  />
                  <p className="mt-1 text-xs text-gray-400">{form.slug || 'mon-hotel'}.hotelpms.com</p>
                  {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prénom</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="input"
                      placeholder="Jean"
                    />
                    {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="label">Nom</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="input"
                      placeholder="Dupont"
                    />
                    {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="label">Adresse email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input"
                    placeholder="jean@mon-hotel.com"
                    autoComplete="email"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label className="label">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="input pr-10"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Min 8 caractères, 1 majuscule, 1 chiffre</p>
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                </div>

                <div>
                  <label className="label">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">
                  <ArrowLeft className="mr-2 h-4 w-4 inline" /> Retour
                </button>
                <button
                  type="button"
                  onClick={() => { if (validateStep2()) setStep(3); }}
                  className="btn-primary flex-1 py-3"
                >
                  Continuer <ArrowRight className="ml-2 h-4 w-4 inline" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && currentPlan && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Confirmation</h2>
              <p className="mt-1 text-sm text-gray-500">Vérifiez vos informations avant de procéder au paiement</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-gray-500">Plan sélectionné</h3>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {currentPlan.name} — {yearly ? currentPlan.yearlyPrice : currentPlan.monthlyPrice} EUR/{yearly ? 'an' : 'mois'}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-gray-500">Organisation</h3>
                  <p className="mt-1 font-semibold text-gray-900">{form.tenantName}</p>
                  <p className="text-sm text-gray-500">{form.slug}.hotelpms.com</p>
                </div>

                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-gray-500">Administrateur</h3>
                  <p className="mt-1 font-semibold text-gray-900">{form.firstName} {form.lastName}</p>
                  <p className="text-sm text-gray-500">{form.email}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">
                    <ArrowLeft className="mr-2 h-4 w-4 inline" /> Retour
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                        Redirection...
                      </>
                    ) : (
                      'Procéder au paiement'
                    )}
                  </button>
                </div>
              </form>

              <p className="mt-4 text-center text-xs text-gray-400">
                Vous serez redirigé vers Stripe pour le paiement sécurisé.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
