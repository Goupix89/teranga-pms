'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { PageHeader, Pagination, Modal, EmptyState, LoadingPage } from '@/components/ui';
import { AlertTriangle, Plus, CheckCircle, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { StockAlert } from '@/types';

export default function StockAlertsPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const isDAF = currentEstRole === 'DAF' || isSuperAdmin;
  const canCreate = isDAF || currentEstRole === 'MANAGER';

  const [page, setPage] = useState(1);
  const [showResolved, setShowResolved] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ articleId: '', message: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['stock-alerts', page, showResolved, currentEstId],
    queryFn: () => apiGet<any>(`/stock-alerts?page=${page}&limit=20&isResolved=${showResolved}${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });

  const { data: unresolvedCount } = useQuery({
    queryKey: ['stock-alert-count', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/stock-alerts/count/${currentEstId}`) : null,
    enabled: !!currentEstId,
  });

  const { data: articlesData } = useQuery({
    queryKey: ['articles-for-alert'],
    queryFn: () => apiGet<any>('/articles?limit=200'),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost('/stock-alerts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alert-count'] });
      setShowModal(false);
      setForm({ articleId: '', message: '' });
      toast.success('Alerte envoyée au DAF');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/stock-alerts/${id}/resolve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-alert-count'] });
      toast.success('Alerte résolue');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const alerts = data?.data || [];
  const meta = data?.meta;
  const articles = articlesData?.data || [];
  const count = unresolvedCount?.data?.count || 0;

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertes de Stock"
        subtitle={count > 0 ? `${count} alerte${count > 1 ? 's' : ''} non résolue${count > 1 ? 's' : ''}` : 'Aucune alerte active'}
        action={
          canCreate && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" /> Nouvelle alerte
            </button>
          )
        }
      />

      {/* Toggle resolved */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowResolved(false); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!showResolved ? 'bg-red-50 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <AlertTriangle className="inline-block h-4 w-4 mr-1" /> Non résolues
        </button>
        <button
          onClick={() => { setShowResolved(true); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showResolved ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <CheckCircle className="inline-block h-4 w-4 mr-1" /> Résolues
        </button>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={showResolved ? CheckCircle : AlertTriangle}
          title={showResolved ? 'Aucune alerte résolue' : 'Aucune alerte active'}
          description={showResolved ? '' : 'Les alertes de pénurie de stock apparaîtront ici'}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert: StockAlert) => (
            <div key={alert.id} className={`card p-5 border-l-4 ${alert.isResolved ? 'border-l-green-400' : 'border-l-red-400'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{alert.article?.name}</span>
                      {alert.article?.sku && <span className="text-xs text-gray-400">({alert.article.sku})</span>}
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mb-2">{alert.message}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Stock actuel : <span className={`font-medium ${(alert.article?.currentStock || 0) <= (alert.article?.minimumStock || 0) ? 'text-red-600' : 'text-gray-700'}`}>{alert.article?.currentStock}</span> / min. {alert.article?.minimumStock}</span>
                    <span>Par : {alert.createdBy?.firstName} {alert.createdBy?.lastName}</span>
                    <span>{formatDateTime(alert.createdAt)}</span>
                    {alert.resolvedAt && <span>Résolu le {formatDateTime(alert.resolvedAt)}</span>}
                  </div>
                </div>

                {!alert.isResolved && isDAF && (
                  <button
                    onClick={() => resolveMutation.mutate(alert.id)}
                    disabled={resolveMutation.isPending}
                    className="btn-ghost text-green-600 hover:bg-green-50 p-2 ml-4"
                    title="Marquer comme résolu"
                  >
                    {resolveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
        </div>
      )}

      {/* Create alert modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Signaler une pénurie" size="md">
        <form onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate({
            establishmentId: currentEstId,
            articleId: form.articleId,
            message: form.message,
          });
        }} className="space-y-4">
          <div>
            <label className="label">Article</label>
            <select value={form.articleId} onChange={(e) => setForm({ ...form, articleId: e.target.value })} className="input" required>
              <option value="">Sélectionner un article</option>
              {articles.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name} — Stock: {a.currentStock} / Min: {a.minimumStock}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="input"
              rows={3}
              required
              placeholder="Décrivez la situation de pénurie..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer l'alerte
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
