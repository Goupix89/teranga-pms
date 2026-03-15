'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { Package, Plus, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StockPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'articles' | 'movements'>('articles');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMovement, setShowMovement] = useState(false);

  const [articleForm, setArticleForm] = useState({ name: '', sku: '', unitPrice: '', costPrice: '', currentStock: '0', minimumStock: '0', unit: 'pièce' });
  const [movementForm, setMovementForm] = useState({ articleId: '', type: 'PURCHASE', quantity: '', unitCost: '', reason: '' });

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', page, search],
    queryFn: () => apiGet<any>(`/articles?page=${page}&limit=20&search=${search}`),
    enabled: tab === 'articles',
  });

  const { data: movements, isLoading: movementsLoading } = useQuery({
    queryKey: ['stock-movements', page],
    queryFn: () => apiGet<any>(`/stock-movements?page=${page}&limit=20`),
    enabled: tab === 'movements',
  });

  const { data: allArticles } = useQuery({
    queryKey: ['articles-all'],
    queryFn: () => apiGet<any>('/articles?limit=200'),
  });

  const createArticleMutation = useMutation({
    mutationFn: (body: any) => apiPost('/articles', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['articles'] }); setShowCreate(false); toast.success('Article créé'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const createMovementMutation = useMutation({
    mutationFn: (body: any) => apiPost('/stock-movements', body),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      setShowMovement(false);
      if (data.requiresApproval) {
        toast.warning(`Mouvement créé — Approbation requise (écart ${data.variancePercent}%)`);
      } else {
        toast.success('Mouvement de stock enregistré');
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/stock-movements/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Mouvement approuvé');
    },
  });

  const isLoading = tab === 'articles' ? articlesLoading : movementsLoading;
  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock & Inventaire"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowMovement(true)} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Mouvement</button>
            <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Article</button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['articles', 'movements'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'articles' ? 'Articles' : 'Mouvements'}
          </button>
        ))}
      </div>

      {tab === 'articles' && (
        <>
          <div className="w-64"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Chercher un article..." /></div>
          {(articles?.data || []).length === 0 ? (
            <EmptyState icon={Package} title="Aucun article" />
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead><tr><th>Article</th><th>SKU</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Min</th><th>Statut</th></tr></thead>
                  <tbody>
                    {(articles?.data || []).map((art: any) => (
                      <tr key={art.id}>
                        <td className="font-medium text-gray-900">{art.name}</td>
                        <td className="text-xs text-gray-500">{art.sku || '-'}</td>
                        <td>{art.category?.name || '-'}</td>
                        <td>{formatCurrency(art.unitPrice)}</td>
                        <td className="font-semibold">{art.currentStock} {art.unit}</td>
                        <td className="text-gray-400">{art.minimumStock}</td>
                        <td>
                          {art.currentStock <= art.minimumStock ? (
                            <span className="badge-danger"><AlertTriangle className="mr-1 h-3 w-3" />Bas</span>
                          ) : (
                            <span className="badge-success">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {articles?.meta && <Pagination page={articles.meta.page} totalPages={articles.meta.totalPages} total={articles.meta.total} onPageChange={setPage} />}
            </div>
          )}
        </>
      )}

      {tab === 'movements' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead><tr><th>Article</th><th>Type</th><th>Quantité</th><th>Avant</th><th>Après</th><th>Par</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {(movements?.data || []).map((mov: any) => (
                  <tr key={mov.id}>
                    <td className="font-medium">{mov.article?.name}</td>
                    <td><StatusBadge status={mov.type} /></td>
                    <td className={mov.quantity >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {mov.quantity >= 0 ? '+' : ''}{mov.quantity}
                    </td>
                    <td>{mov.previousStock}</td>
                    <td>{mov.newStock}</td>
                    <td className="text-xs">{mov.performedBy?.firstName} {mov.performedBy?.lastName}</td>
                    <td>
                      {mov.requiresApproval && !mov.approvedAt && <span className="badge-warning">En attente</span>}
                      {mov.approvedAt && <span className="badge-success">Approuvé</span>}
                      {!mov.requiresApproval && !mov.approvedAt && <span className="badge-neutral">Auto</span>}
                    </td>
                    <td>
                      {mov.requiresApproval && !mov.approvedAt && (
                        <button onClick={() => approveMutation.mutate(mov.id)} className="btn-ghost p-1.5 text-emerald-600" title="Approuver">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {movements?.meta && <Pagination page={movements.meta.page} totalPages={movements.meta.totalPages} total={movements.meta.total} onPageChange={setPage} />}
        </div>
      )}

      {/* Create Article Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel article" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); createArticleMutation.mutate({ ...articleForm, unitPrice: Number(articleForm.unitPrice), costPrice: Number(articleForm.costPrice), currentStock: Number(articleForm.currentStock), minimumStock: Number(articleForm.minimumStock) }); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Nom</label><input value={articleForm.name} onChange={(e) => setArticleForm({ ...articleForm, name: e.target.value })} className="input" required /></div>
            <div><label className="label">SKU</label><input value={articleForm.sku} onChange={(e) => setArticleForm({ ...articleForm, sku: e.target.value })} className="input" /></div>
            <div><label className="label">Prix de vente</label><input type="number" value={articleForm.unitPrice} onChange={(e) => setArticleForm({ ...articleForm, unitPrice: e.target.value })} className="input" required min="0" /></div>
            <div><label className="label">Prix d'achat</label><input type="number" value={articleForm.costPrice} onChange={(e) => setArticleForm({ ...articleForm, costPrice: e.target.value })} className="input" min="0" /></div>
            <div><label className="label">Stock initial</label><input type="number" value={articleForm.currentStock} onChange={(e) => setArticleForm({ ...articleForm, currentStock: e.target.value })} className="input" min="0" /></div>
            <div><label className="label">Stock minimum</label><input type="number" value={articleForm.minimumStock} onChange={(e) => setArticleForm({ ...articleForm, minimumStock: e.target.value })} className="input" min="0" /></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary" disabled={createArticleMutation.isPending}>{createArticleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer</button></div>
        </form>
      </Modal>

      {/* Stock Movement Modal */}
      <Modal open={showMovement} onClose={() => setShowMovement(false)} title="Nouveau mouvement de stock" size="md">
        <form onSubmit={(e) => { e.preventDefault(); createMovementMutation.mutate({ articleId: movementForm.articleId, type: movementForm.type, quantity: Number(movementForm.quantity), unitCost: movementForm.unitCost ? Number(movementForm.unitCost) : undefined, reason: movementForm.reason || undefined }); }} className="space-y-4">
          <div>
            <label className="label">Article</label>
            <select value={movementForm.articleId} onChange={(e) => setMovementForm({ ...movementForm, articleId: e.target.value })} className="input" required>
              <option value="">Sélectionner...</option>
              {(allArticles?.data || []).map((a: any) => <option key={a.id} value={a.id}>{a.name} (stock: {a.currentStock})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })} className="input">
              <option value="PURCHASE">Achat</option>
              <option value="ADJUSTMENT">Ajustement inventaire</option>
              <option value="WASTE">Perte / Casse</option>
              <option value="RETURN">Retour fournisseur</option>
              <option value="TRANSFER">Transfert</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Quantité</label><input type="number" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} className="input" required /></div>
            <div><label className="label">Coût unitaire</label><input type="number" value={movementForm.unitCost} onChange={(e) => setMovementForm({ ...movementForm, unitCost: e.target.value })} className="input" min="0" /></div>
          </div>
          <div><label className="label">Raison</label><textarea value={movementForm.reason} onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })} className="input" rows={2} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowMovement(false)} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary" disabled={createMovementMutation.isPending}>{createMovementMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</button></div>
        </form>
      </Modal>
    </div>
  );
}
