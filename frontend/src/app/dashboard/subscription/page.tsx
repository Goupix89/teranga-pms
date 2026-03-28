'use client';
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from 'sonner';
import {
  Crown, Calendar, CreditCard, CheckCircle2, AlertTriangle,
  XCircle, Clock, Loader2, Users, Building2, DoorOpen,
  Zap, Shield, Search,
} from 'lucide-react';
import type { Subscription, SubscriptionPlan } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  TRIAL: { label: 'Essai gratuit', color: 'bg-blue-100 text-blue-700', icon: Clock },
  ACTIVE: { label: 'Actif', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  PENDING: { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  PAST_DUE: { label: 'En retard', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  SUSPENDED: { label: 'Suspendu', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Annule', color: 'bg-gray-100 text-gray-600', icon: XCircle },
};

export default function SubscriptionPage() {
  const { user, currentEstablishmentRole } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const isOwnerOrDAF = currentEstablishmentRole === 'OWNER' || currentEstablishmentRole === 'DAF';
  const hasAccess = isSuperAdmin || isOwnerOrDAF;

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Acces reserve aux proprietaires et DAF.</p>
      </div>
    );
  }

  if (isSuperAdmin) {
    return <SuperAdminView />;
  }

  return <TenantView />;
}

// =============================================================================
// SUPERADMIN VIEW — All tenants subscriptions
// =============================================================================

interface TenantWithSub {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  subscription: (Subscription & { plan: any }) | null;
  _count: { rooms: number; users: number; establishments: number };
}

function SuperAdminView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activateTarget, setActivateTarget] = useState<TenantWithSub | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions-all'],
    queryFn: () => apiGet<{ data: TenantWithSub[] }>('/subscriptions/all'),
  });

  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => apiGet<{ data: SubscriptionPlan[] }>('/subscriptions/plans'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const tenants = (data?.data || []).filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );
  const plans = plansData?.data || [];

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.subscription?.status === 'ACTIVE').length,
    trial: tenants.filter((t) => t.subscription?.status === 'TRIAL').length,
    pastDue: tenants.filter((t) => t.subscription?.status === 'PAST_DUE' || t.subscription?.status === 'SUSPENDED').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion des abonnements" subtitle="Vue d'ensemble de tous les etablissements" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} icon={Building2} color="text-gray-600" />
        <StatCard label="Actifs" value={stats.active} icon={CheckCircle2} color="text-emerald-600" />
        <StatCard label="Essais" value={stats.trial} icon={Clock} color="text-blue-600" />
        <StatCard label="En retard / Suspendus" value={stats.pastDue} icon={AlertTriangle} color="text-orange-600" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un etablissement..."
          className="input pl-10 w-full max-w-md"
        />
      </div>

      {/* Tenants table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Etablissement</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Expiration</th>
                <th className="text-left px-4 py-3 font-medium">Utilisation</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => {
                const sub = t.subscription;
                const statusCfg = STATUS_CONFIG[sub?.status || 'PENDING'] || STATUS_CONFIG.PENDING;
                const StatusIcon = statusCfg.icon;
                const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
                const trialEnd = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
                const endDate = periodEnd || trialEnd;
                const daysLeft = endDate
                  ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : null;

                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{sub?.plan?.name || t.plan || '—'}</span>
                      {sub?.billingInterval && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({sub.billingInterval === 'YEARLY' ? 'annuel' : 'mensuel'})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {endDate ? (
                        <div>
                          <p className="text-sm">{endDate.toLocaleDateString('fr-FR')}</p>
                          {daysLeft !== null && (
                            <p className={`text-xs ${daysLeft <= 7 ? 'text-orange-600' : 'text-gray-400'}`}>
                              {daysLeft} jour{daysLeft !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span title="Chambres"><DoorOpen className="w-3 h-3 inline" /> {t._count.rooms}</span>
                        <span title="Utilisateurs"><Users className="w-3 h-3 inline" /> {t._count.users}</span>
                        <span title="Etablissements"><Building2 className="w-3 h-3 inline" /> {t._count.establishments}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setActivateTarget(t)}
                        className="btn-outline text-xs px-3 py-1 flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3" /> Modifier
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Aucun etablissement trouve
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activate modal */}
      {activateTarget && (
        <ActivateModal
          plans={plans}
          tenantId={activateTarget.id}
          tenantName={activateTarget.name}
          currentPlan={activateTarget.plan}
          currentStatus={activateTarget.subscription?.status}
          onClose={() => setActivateTarget(null)}
          onSuccess={() => {
            setActivateTarget(null);
            queryClient.invalidateQueries({ queryKey: ['subscriptions-all'] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color}`} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// =============================================================================
// TENANT VIEW — OWNER / DAF see their own subscription
// =============================================================================

function TenantView() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiGet<{ data: {
      subscription: Subscription;
      tenant: { name: string; slug: string; plan: string; isActive: boolean };
      usage: { rooms: number; users: number; establishments: number };
    } }>('/subscriptions'),
  });

  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => apiGet<{ data: SubscriptionPlan[] }>('/subscriptions/plans'),
  });

  const renewMutation = useMutation({
    mutationFn: () => apiPost<{ data: { checkoutUrl: string } }>('/subscriptions/renew'),
    onSuccess: (res) => {
      if (res.data?.checkoutUrl) {
        window.open(res.data.checkoutUrl, '_blank');
        toast.success('Lien de paiement ouvert dans un nouvel onglet');
      }
    },
    onError: () => toast.error('Erreur lors de la generation du lien de paiement'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const sub = data?.data?.subscription;
  const tenant = data?.data?.tenant;
  const usage = data?.data?.usage;
  const plans = plansData?.data || [];
  const features = (sub?.plan?.features || {}) as Record<string, any>;
  const statusCfg = STATUS_CONFIG[sub?.status || 'PENDING'] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;

  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const trialEnd = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Mon abonnement" subtitle="Consultez votre plan et gerez votre facturation" />

      {/* Status banner */}
      {(sub?.status === 'PAST_DUE' || sub?.status === 'SUSPENDED') && (
        <div className={`p-4 rounded-lg border ${sub.status === 'SUSPENDED' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${sub.status === 'SUSPENDED' ? 'text-red-500' : 'text-orange-500'}`} />
            <div>
              <p className="font-medium">
                {sub.status === 'SUSPENDED'
                  ? 'Votre abonnement est suspendu. Contactez l\'administrateur ou renouvelez.'
                  : 'Votre paiement est en retard. Renouvelez avant la suspension.'}
              </p>
              {sub.gracePeriodEndsAt && (
                <p className="text-sm text-gray-600 mt-1">
                  Suspension automatique le {new Date(sub.gracePeriodEndsAt).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
            <button
              onClick={() => renewMutation.mutate()}
              disabled={renewMutation.isPending}
              className="ml-auto btn-primary text-sm"
            >
              {renewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              <span className="ml-2">Payer maintenant</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current plan card */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Crown className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{sub?.plan?.name || 'Aucun plan'}</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusCfg.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">
                {sub?.billingInterval === 'YEARLY'
                  ? `${Number(sub?.plan?.yearlyPrice || 0).toLocaleString('fr-FR')} FCFA`
                  : `${Number(sub?.plan?.monthlyPrice || 0).toLocaleString('fr-FR')} FCFA`}
              </p>
              <p className="text-sm text-gray-500">
                / {sub?.billingInterval === 'YEARLY' ? 'an' : 'mois'}
              </p>
            </div>
          </div>

          {/* Period info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mb-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Periode en cours</p>
              <p className="font-medium">
                {sub?.currentPeriodStart
                  ? `${new Date(sub.currentPeriodStart).toLocaleDateString('fr-FR')} — ${periodEnd?.toLocaleDateString('fr-FR')}`
                  : 'Non definie'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">
                {sub?.status === 'TRIAL' ? 'Fin de l\'essai' : 'Jours restants'}
              </p>
              <p className="font-medium">
                {daysLeft !== null ? (
                  <span className={daysLeft <= 7 ? 'text-orange-600' : ''}>
                    {daysLeft} jour{daysLeft !== 1 ? 's' : ''}
                  </span>
                ) : '—'}
              </p>
            </div>
          </div>

          {/* Usage vs limits */}
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            Utilisation du plan
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <UsageBar label="Chambres" icon={DoorOpen} current={usage?.rooms || 0} max={features.maxRooms} />
            <UsageBar label="Utilisateurs" icon={Users} current={usage?.users || 0} max={features.maxUsers} />
            <UsageBar label="Etablissements" icon={Building2} current={usage?.establishments || 0} max={features.maxEstablishments} />
          </div>

          {/* Features */}
          <div className="mt-4 flex gap-3 flex-wrap">
            {features.channelManager && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs">
                <CheckCircle2 className="w-3 h-3" /> Channel Manager
              </span>
            )}
            {features.posApp && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs">
                <CheckCircle2 className="w-3 h-3" /> Application POS
              </span>
            )}
          </div>
        </div>

        {/* Actions card */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold">Actions</h3>

          {sub?.status !== 'CANCELLED' && (
            <button
              onClick={() => renewMutation.mutate()}
              disabled={renewMutation.isPending}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {renewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Renouveler via FedaPay
            </button>
          )}

          {sub?.lastPaymentAt && (
            <div className="p-3 bg-gray-50 rounded text-sm">
              <p className="text-gray-500">Dernier paiement</p>
              <p className="font-medium">
                {new Date(sub.lastPaymentAt).toLocaleDateString('fr-FR')}
              </p>
              {sub.lastPaymentRef && (
                <p className="text-xs text-gray-400 mt-1">Ref: {sub.lastPaymentRef}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      {sub?.payments && sub.payments.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Historique des paiements
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Montant</th>
                  <th className="text-left px-4 py-2">Periode</th>
                  <th className="text-left px-4 py-2">Statut</th>
                  <th className="text-left px-4 py-2">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sub.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString('fr-FR') : new Date(p.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {Number(p.amount).toLocaleString('fr-FR')} {p.currency}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(p.periodStart).toLocaleDateString('fr-FR')} — {new Date(p.periodEnd).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {p.status === 'PAID' ? 'Paye' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">{p.fedapayTxnId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Available plans (read-only for OWNER/DAF) */}
      {plans.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Plans disponibles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.slug === tenant?.plan;
              const pf = plan.features as Record<string, any>;
              return (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border-2 ${
                    isCurrent ? 'border-primary-500 bg-primary-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg">{plan.name}</h4>
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                        Plan actuel
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Number(plan.monthlyPrice).toLocaleString('fr-FR')} <span className="text-sm font-normal text-gray-500">FCFA/mois</span>
                  </p>
                  <p className="text-sm text-gray-500 mb-3">
                    ou {Number(plan.yearlyPrice).toLocaleString('fr-FR')} FCFA/an
                  </p>
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <DoorOpen className="w-3 h-3 text-gray-400" />
                      {pf.maxRooms === -1 ? 'Chambres illimitees' : `${pf.maxRooms} chambres`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-gray-400" />
                      {pf.maxUsers === -1 ? 'Utilisateurs illimites' : `${pf.maxUsers} utilisateurs`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-gray-400" />
                      {pf.maxEstablishments === -1 ? 'Etablissements illimites' : `${pf.maxEstablishments} etablissement${pf.maxEstablishments > 1 ? 's' : ''}`}
                    </li>
                    {pf.channelManager && (
                      <li className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> Channel Manager
                      </li>
                    )}
                    {pf.posApp && (
                      <li className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> App POS
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

function UsageBar({
  label, icon: Icon, current, max,
}: {
  label: string;
  icon: React.ElementType;
  current: number;
  max?: number;
}) {
  const unlimited = !max || max === -1;
  const pct = unlimited ? 0 : Math.min(100, (current / max) * 100);
  const isNearLimit = !unlimited && pct >= 80;

  return (
    <div className="p-3 bg-gray-50 rounded">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="font-semibold">
        {current}{unlimited ? '' : ` / ${max}`}
      </p>
      {!unlimited && (
        <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-orange-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {unlimited && <p className="text-xs text-gray-400">Illimite</p>}
    </div>
  );
}

function ActivateModal({
  plans, tenantId, tenantName, currentPlan, currentStatus, onClose, onSuccess,
}: {
  plans: SubscriptionPlan[];
  tenantId: string;
  tenantName: string;
  currentPlan?: string;
  currentStatus?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [planSlug, setPlanSlug] = useState(currentPlan || plans[0]?.slug || '');
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [months, setMonths] = useState('1');

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/subscriptions/activate', {
        tenantId,
        planSlug,
        billingInterval,
        months: parseInt(months) || 1,
      }),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Abonnement active');
      onSuccess();
    },
    onError: () => toast.error('Erreur lors de l\'activation'),
  });

  const statusCfg = STATUS_CONFIG[currentStatus || 'PENDING'] || STATUS_CONFIG.PENDING;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="font-semibold text-lg mb-1">Modifier l&apos;abonnement</h3>
        <p className="text-sm text-gray-500 mb-1">{tenantName}</p>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-4 ${statusCfg.color}`}>
          {statusCfg.label}
        </span>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
              className="input w-full"
            >
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} — {Number(p.monthlyPrice).toLocaleString('fr-FR')} FCFA/mois
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequence</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setBillingInterval('MONTHLY'); setMonths('1'); }}
                className={`flex-1 py-2 rounded text-sm font-medium border ${
                  billingInterval === 'MONTHLY' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-200'
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => { setBillingInterval('YEARLY'); setMonths('12'); }}
                className={`flex-1 py-2 rounded text-sm font-medium border ${
                  billingInterval === 'YEARLY' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-200'
                }`}
              >
                Annuel
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duree (mois)
            </label>
            <input
              type="number"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              min="1"
              max="24"
              className="input w-full"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 btn-outline">Annuler</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Activer / Modifier
          </button>
        </div>
      </div>
    </div>
  );
}
