'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Check, ArrowLeft, ArrowRight, CreditCard, Clock, Star } from 'lucide-react';

const TIMEZONES = [
  { value: 'Africa/Porto-Novo', label: 'Bénin (UTC+1)' },
  { value: 'Africa/Abidjan', label: 'Côte d\'Ivoire (UTC+0)' },
  { value: 'Africa/Dakar', label: 'Sénégal (UTC+0)' },
  { value: 'Africa/Lagos', label: 'Nigéria (UTC+1)' },
  { value: 'Africa/Douala', label: 'Cameroun (UTC+1)' },
  { value: 'Africa/Bamako', label: 'Mali (UTC+0)' },
  { value: 'Africa/Ouagadougou', label: 'Burkina Faso (UTC+0)' },
  { value: 'Africa/Lome', label: 'Togo (UTC+0)' },
  { value: 'Africa/Accra', label: 'Ghana (UTC+0)' },
  { value: 'Africa/Libreville', label: 'Gabon (UTC+1)' },
  { value: 'Europe/Paris', label: 'France (UTC+1/+2)' },
];

const CURRENCIES = [
  { value: 'XOF', label: 'FCFA (XOF)' },
  { value: 'XAF', label: 'FCFA Centrafrique (XAF)' },
  { value: 'GHS', label: 'Cedi ghanéen (GHS)' },
  { value: 'NGN', label: 'Naira nigérian (NGN)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar américain (USD)' },
];

const COUNTRIES = [
  { value: 'BJ', label: 'Bénin' },
  { value: 'CI', label: 'Côte d\'Ivoire' },
  { value: 'SN', label: 'Sénégal' },
  { value: 'TG', label: 'Togo' },
  { value: 'BF', label: 'Burkina Faso' },
  { value: 'ML', label: 'Mali' },
  { value: 'NG', label: 'Nigéria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'CM', label: 'Cameroun' },
  { value: 'GA', label: 'Gabon' },
  { value: 'FR', label: 'France' },
];

function KubaPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
      <defs>
        <pattern id="kuba-reg" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 12L12 0L24 12L12 24Z" fill="none" stroke="#D4A857" strokeWidth="0.5" />
          <circle cx="12" cy="12" r="1.5" fill="#B85042" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kuba-reg)" />
    </svg>
  );
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays?: number;
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
  const [skipTrial, setSkipTrial] = useState(false);

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
    // Establishment fields
    address: '',
    city: '',
    country: 'BJ',
    phone: '',
    establishmentEmail: '',
    website: '',
    starRating: 0,
    timezone: 'Africa/Porto-Novo',
    currency: 'XOF',
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
        skipTrial,
        address: form.address,
        city: form.city,
        country: form.country,
        phone: form.phone || undefined,
        establishmentEmail: form.establishmentEmail || undefined,
        website: form.website || undefined,
        starRating: form.starRating > 0 ? form.starRating : undefined,
        timezone: form.timezone,
        currency: form.currency,
      });

      const result = data.data;

      if (result.trial) {
        // Trial plan — account activated immediately, redirect to login
        toast.success(result.message || `Essai gratuit de ${result.trialDays} jours activé !`);
        window.location.href = '/auth/login';
      } else if (result.checkoutUrl) {
        // Payment required — redirect to FedaPay checkout
        window.location.href = result.checkoutUrl;
      } else {
        toast.success('Inscription réussie !');
        window.location.href = '/auth/login';
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'inscription';
      toast.error(msg);
      setLoading(false);
    }
  };

  const currentPlan = plans.find((p) => p.slug === selectedPlan);

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (same as login) */}
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

      {/* Right panel — registration form */}
      <div className="flex w-full lg:w-1/2 items-start justify-center p-8 bg-wood-50 overflow-y-auto">
        <div className="w-full max-w-lg py-8">
          <div className="lg:hidden mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white font-bold">
              T
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
              <h2 className="font-display text-2xl font-bold text-wood-800">Choisissez votre plan</h2>
              <p className="mt-1 text-sm text-wood-500">Sélectionnez le plan adapté à vos besoins</p>
              <div className="divider-teranga my-6" />

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
                              {Number(price).toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-500">FCFA/{yearly ? 'an' : 'mois'}</span>
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
              <h2 className="font-display text-2xl font-bold text-wood-800">Créez votre compte</h2>
              <p className="mt-1 text-sm text-wood-500">Informations de votre organisation et administrateur</p>
              <div className="divider-teranga my-6" />

              <div className="mt-6 space-y-4">
                {/* Organisation */}
                <p className="text-xs font-semibold uppercase tracking-wide text-wood-400">Établissement</p>

                <div>
                  <label className="label">Nom de l&apos;hôtel / organisation <span className="text-red-500">*</span></label>
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
                  <label className="label">Identifiant unique (slug) <span className="text-red-500">*</span></label>
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

                {/* Star rating */}
                <div>
                  <label className="label">Classification (étoiles)</label>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setForm({ ...form, starRating: form.starRating === star ? 0 : star })}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            star <= form.starRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    {form.starRating > 0 && (
                      <span className="ml-2 text-sm text-gray-500">{form.starRating} étoile{form.starRating > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">Adresse</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="input"
                    placeholder="123 Rue de l'Hôtel"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Ville</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="input"
                      placeholder="Cotonou"
                    />
                  </div>
                  <div>
                    <label className="label">Pays</label>
                    <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input">
                      {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Téléphone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="input"
                      placeholder="+229 97 00 00 00"
                    />
                  </div>
                  <div>
                    <label className="label">Email de l&apos;établissement</label>
                    <input
                      type="email"
                      value={form.establishmentEmail}
                      onChange={(e) => setForm({ ...form, establishmentEmail: e.target.value })}
                      className="input"
                      placeholder="contact@mon-hotel.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Site web</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="input"
                    placeholder="https://www.mon-hotel.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Fuseau horaire</label>
                    <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="input">
                      {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Devise</label>
                    <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input">
                      {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Admin account */}
                <p className="text-xs font-semibold uppercase tracking-wide text-wood-400 pt-2">Compte administrateur</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prénom <span className="text-red-500">*</span></label>
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
                    <label className="label">Nom <span className="text-red-500">*</span></label>
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
                  <label className="label">Adresse email <span className="text-red-500">*</span></label>
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
                  <label className="label">Mot de passe <span className="text-red-500">*</span></label>
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
                  <label className="label">Confirmer le mot de passe <span className="text-red-500">*</span></label>
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
              <h2 className="font-display text-2xl font-bold text-wood-800">Confirmation</h2>
              <p className="mt-1 text-sm text-wood-500">Vérifiez vos informations avant de procéder au paiement</p>
              <div className="divider-teranga my-6" />

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-gray-500">Plan sélectionné</h3>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {currentPlan.name} — {Number(yearly ? currentPlan.yearlyPrice : currentPlan.monthlyPrice).toLocaleString('fr-FR')} FCFA/{yearly ? 'an' : 'mois'}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-gray-500">Établissement</h3>
                  <p className="mt-1 font-semibold text-gray-900">{form.tenantName}</p>
                  <p className="text-sm text-gray-500">{form.slug}.hotelpms.com</p>
                  {form.starRating > 0 && (
                    <div className="mt-1 flex items-center gap-0.5">
                      {Array.from({ length: form.starRating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  )}
                  {(form.city || form.country) && (
                    <p className="text-sm text-gray-500">{[form.city, form.country].filter(Boolean).join(', ')}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{form.timezone} · {form.currency}</p>
                </div>

                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-gray-500">Administrateur</h3>
                  <p className="mt-1 font-semibold text-gray-900">{form.firstName} {form.lastName}</p>
                  <p className="text-sm text-gray-500">{form.email}</p>
                </div>

                {/* Payment method choice when plan has trial */}
                {currentPlan.trialDays && currentPlan.trialDays > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Mode d&apos;activation</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSkipTrial(false)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          !skipTrial
                            ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Clock className={`h-5 w-5 mb-2 ${!skipTrial ? 'text-primary-600' : 'text-gray-400'}`} />
                        <p className="font-medium text-sm text-gray-900">Essai gratuit</p>
                        <p className="text-xs text-gray-500 mt-1">{currentPlan.trialDays} jours sans engagement</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkipTrial(true)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          skipTrial
                            ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <CreditCard className={`h-5 w-5 mb-2 ${skipTrial ? 'text-primary-600' : 'text-gray-400'}`} />
                        <p className="font-medium text-sm text-gray-900">Payer maintenant</p>
                        <p className="text-xs text-gray-500 mt-1">Activation immédiate</p>
                      </button>
                    </div>
                  </div>
                )}
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
                    ) : currentPlan.trialDays && currentPlan.trialDays > 0 && !skipTrial ? (
                      'Commencer l\'essai gratuit'
                    ) : (
                      'Procéder au paiement'
                    )}
                  </button>
                </div>
              </form>

              <p className="mt-4 text-center text-xs text-gray-400">
                {currentPlan.trialDays && currentPlan.trialDays > 0 && !skipTrial
                  ? 'Votre essai gratuit commence immédiatement. Aucun paiement requis.'
                  : 'Vous serez redirigé vers FedaPay pour le paiement sécurisé.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
