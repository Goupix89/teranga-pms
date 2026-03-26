'use client';
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api';
import { toast } from 'sonner';
import { Settings, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Trash2, Zap } from 'lucide-react';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isOwner = user?.memberships?.some((m) => m.role === 'OWNER') || user?.role === 'SUPERADMIN';

  // Fetch tenant settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<any>('/tenant/settings'),
    enabled: isOwner,
  });

  const settings = settingsData?.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Parametres" subtitle="Configuration de votre compte et integrations" />

      {/* Account info */}
      <div className="card p-6 max-w-2xl">
        <h3 className="font-semibold text-gray-900 mb-4">Informations du compte</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Tenant ID</span>
            <code className="text-xs bg-gray-50 px-2 py-1 rounded">{user?.tenantId}</code>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Slug</span>
            <span className="font-medium">{user?.tenantSlug}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Utilisateur</span>
            <span className="font-medium">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Role</span>
            <span className="font-medium">{user?.role === 'SUPERADMIN' ? 'Super Admin' : user?.memberships?.find((m) => m.role === 'OWNER') ? 'Proprietaire' : 'Employe'}</span>
          </div>
        </div>
      </div>

      {/* FedaPay Integration — OWNER only */}
      {isOwner && (
        <FedaPayConfig settings={settings} isLoading={isLoading} />
      )}
    </div>
  );
}

function FedaPayConfig({ settings, isLoading }: { settings: any; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [secretKey, setSecretKey] = useState('');
  const [isSandbox, setIsSandbox] = useState(true);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [paymentWebhookUrl, setPaymentWebhookUrl] = useState('');
  const [editing, setEditing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fedapay = settings?.fedapay;
  const isConnected = fedapay?.enabled;

  const saveMutation = useMutation({
    mutationFn: (body: any) => apiPatch<any>('/tenant/settings/fedapay', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('Configuration FedaPay enregistree');
      setEditing(false);
      setSecretKey('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => apiPost<any>('/tenant/settings/fedapay/test'),
    onSuccess: (res: any) => {
      if (res.success) {
        setTestResult({ success: true, message: `Connecte (${res.data.mode}) — ${res.data.accountName}` });
      } else {
        setTestResult({ success: false, message: res.error || 'Erreur de connexion' });
      }
    },
    onError: (err: any) => {
      setTestResult({ success: false, message: err.response?.data?.error || 'Erreur de test' });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiDelete<any>('/tenant/settings/fedapay'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('FedaPay deconnecte');
      setTestResult(null);
    },
  });

  const handleSave = () => {
    const body: any = {};
    if (secretKey) body.secretKey = secretKey;
    body.isSandbox = isSandbox;
    if (callbackUrl) body.callbackUrl = callbackUrl;
    body.paymentWebhookUrl = paymentWebhookUrl;
    saveMutation.mutate(body);
  };

  if (isLoading) {
    return (
      <div className="card p-6 max-w-2xl">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">FedaPay</h3>
            <p className="text-xs text-gray-500">Paiement Mobile Money et cartes bancaires</p>
          </div>
        </div>
        {isConnected && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connecte
          </span>
        )}
        {!isConnected && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Non connecte
          </span>
        )}
      </div>

      {/* Connected state */}
      {isConnected && !editing && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cle secrete</span>
              <code className="text-xs bg-white px-2 py-1 rounded border">{fedapay.secretKeyMasked}</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Mode</span>
              <span className={`font-medium ${fedapay.isSandbox ? 'text-amber-600' : 'text-green-600'}`}>
                {fedapay.isSandbox ? 'Sandbox (test)' : 'Production (live)'}
              </span>
            </div>
            {fedapay.callbackUrl && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">URL de retour</span>
                <span className="text-xs font-mono truncate max-w-[200px]">{fedapay.callbackUrl}</span>
              </div>
            )}
            {settings?.paymentWebhookUrl && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Webhook WordPress</span>
                <span className="text-xs font-mono truncate max-w-[200px]">{settings.paymentWebhookUrl}</span>
              </div>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.message}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Tester la connexion
            </button>
            <button onClick={() => { setEditing(true); setIsSandbox(fedapay.isSandbox); setCallbackUrl(fedapay.callbackUrl || ''); setPaymentWebhookUrl(settings?.paymentWebhookUrl || ''); }} className="btn-secondary text-sm">
              Modifier
            </button>
            <button
              onClick={() => { if (confirm('Deconnecter FedaPay ? Les paiements FedaPay ne fonctionneront plus.')) disconnectMutation.mutate(); }}
              disabled={disconnectMutation.isPending}
              className="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Deconnecter
            </button>
          </div>
        </div>
      )}

      {/* Setup / Edit form */}
      {(!isConnected || editing) && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium mb-1">Comment obtenir votre cle FedaPay :</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Connectez-vous sur <strong>app.fedapay.com</strong></li>
              <li>Allez dans <strong>Parametres &gt; API &gt; Cles API</strong></li>
              <li>Copiez la cle <strong>secrete</strong> (sk_sandbox_... ou sk_live_...)</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cle secrete FedaPay</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={isConnected ? 'Laisser vide pour garder la cle actuelle' : 'sk_sandbox_xxxxxxxxxxxxxxxx'}
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sandbox"
                  checked={isSandbox}
                  onChange={() => setIsSandbox(true)}
                  className="text-primary-600"
                />
                <span className="text-sm">Sandbox (test)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sandbox"
                  checked={!isSandbox}
                  onChange={() => setIsSandbox(false)}
                  className="text-primary-600"
                />
                <span className="text-sm">Production (live)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL de retour apres paiement (optionnel)</label>
            <input
              type="url"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="https://monhotel.com/dashboard"
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">Page vers laquelle le client sera redirige apres le paiement</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook paiement WordPress (optionnel)</label>
            <input
              type="url"
              value={paymentWebhookUrl}
              onChange={(e) => setPaymentWebhookUrl(e.target.value)}
              placeholder="https://monsite.com/wp-json/teranga-ba-sync/v1/payment-webhook"
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">URL pour notifier WordPress quand un paiement est effectue sur Teranga PMS</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending || (!secretKey && !isConnected)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isConnected ? 'Mettre a jour' : 'Connecter FedaPay'}
            </button>
            {editing && (
              <button onClick={() => { setEditing(false); setSecretKey(''); }} className="btn-secondary text-sm">
                Annuler
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
