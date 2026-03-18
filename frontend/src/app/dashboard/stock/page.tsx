'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, StatusBadge, Pagination, Modal, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { Package, Plus, CheckCircle, AlertTriangle, Loader2, Clock, ImageIcon, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function StockPage() {
  const queryClient = useQueryClient();
  const { currentEstablishmentRole } = useAuthStore();
  const [tab, setTab] = useState<'articles' | 'movements'>('articles');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showMovement, setShowMovement] = useState(false);

  const defaultForm = { name: '', sku: '', unitPrice: '', costPrice: '', currentStock: '', minimumStock: '', unit: 'plat', description: '', imageUrl: '', categoryId: '' };
  const [articleForm, setArticleForm] = useState(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [movementForm, setMovementForm] = useState({ articleId: '', type: 'PURCHASE', quantity: '', unitCost: '', reason: '' });

  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const isDAF = currentEstablishmentRole === 'DAF';
  const isManager = currentEstablishmentRole === 'MANAGER';

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<any>('/categories'),
  });

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', page, search, categoryFilter],
    queryFn: () => apiGet<any>(`/articles?page=${page}&limit=20&search=${search}${categoryFilter ? `&categoryId=${categoryFilter}` : ''}`),
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

  // Image upload handler
  const handleImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors(prev => ({ ...prev, image: 'L\'image ne doit pas dépasser 5 Mo' }));
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setFieldErrors(prev => ({ ...prev, image: 'Format non supporté. Utilisez JPG, PNG ou WebP.' }));
      return;
    }
    setFieldErrors(prev => { const { image, ...rest } = prev; return rest; });
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = res.data.data.imageUrl;
      setArticleForm(prev => ({ ...prev, imageUrl }));
      setImagePreview(URL.createObjectURL(file));
    } catch (err: any) {
      setFieldErrors(prev => ({ ...prev, image: err.response?.data?.error || 'Erreur lors de l\'upload' }));
    } finally {
      setIsUploading(false);
    }
  };

  const createArticleMutation = useMutation({
    mutationFn: (body: any) => apiPost('/articles', body),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setShowCreate(false);
      setArticleForm(defaultForm);
      setFieldErrors({});
      setImagePreview(null);
      if (data.requiresApproval) {
        toast.warning('Article créé — En attente d\'approbation DAF');
      } else {
        toast.success('Article créé avec succès');
      }
    },
    onError: (err: any) => {
      const details = err.response?.data?.details;
      if (details && Array.isArray(details)) {
        const errors: Record<string, string> = {};
        details.forEach((d: any) => {
          if (d.field) errors[d.field] = d.message;
        });
        setFieldErrors(errors);
        // Also show a toast summary so user knows there are errors
        const messages = details.map((d: any) => d.message).join(', ');
        toast.error(`Veuillez corriger : ${messages}`);
      } else {
        toast.error(err.response?.data?.error || 'Erreur lors de la création');
      }
    },
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

  const handleSubmitArticle = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Client-side validation with clear messages
    const errors: Record<string, string> = {};
    if (!articleForm.name.trim()) errors.name = 'Le nom de l\'article est requis';
    if (!articleForm.unitPrice || Number(articleForm.unitPrice) < 0) errors.unitPrice = 'Le prix de vente est requis et doit être positif';
    if (!articleForm.categoryId) errors.categoryId = 'Veuillez sélectionner une catégorie (Restaurant ou Boissons)';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    createArticleMutation.mutate({
      name: articleForm.name,
      sku: articleForm.sku || undefined,
      unitPrice: Number(articleForm.unitPrice),
      costPrice: articleForm.costPrice ? Number(articleForm.costPrice) : 0,
      currentStock: articleForm.currentStock ? Number(articleForm.currentStock) : 0,
      minimumStock: articleForm.minimumStock ? Number(articleForm.minimumStock) : 0,
      unit: articleForm.unit,
      categoryId: articleForm.categoryId || undefined,
      description: articleForm.description || undefined,
      imageUrl: articleForm.imageUrl || undefined,
      establishmentId: currentEstId || undefined,
    });
  };

  const isLoading = tab === 'articles' ? articlesLoading : movementsLoading;
  if (isLoading) return <LoadingPage />;

  const catList = categories?.data || categories || [];

  const resolveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu & Articles"
        subtitle={isManager ? 'Créez des articles — ils seront validés par le DAF' : undefined}
        action={
          <div className="flex gap-2">
            {(isDAF || isManager) && (
              <button onClick={() => setShowMovement(true)} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Mouvement</button>
            )}
            <button onClick={() => { setShowCreate(true); setFieldErrors({}); setImagePreview(null); }} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Article</button>
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
            {t === 'articles' ? 'Articles du menu' : 'Mouvements de stock'}
          </button>
        ))}
      </div>

      {tab === 'articles' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Chercher un article..." />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="input w-48"
            >
              <option value="">Toutes catégories</option>
              {catList.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {(articles?.data || []).length === 0 ? (
            <EmptyState icon={Package} title="Aucun article" />
          ) : (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Article</th>
                      <th>Catégorie</th>
                      <th>Prix</th>
                      <th>Stock</th>
                      <th>Min</th>
                      <th>Niveau</th>
                      <th>Approbation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(articles?.data || []).map((art: any) => (
                      <tr key={art.id} className={!art.isApproved ? 'opacity-60' : ''}>
                        <td className="w-10">
                          {art.imageUrl ? (
                            <img src={resolveImageUrl(art.imageUrl)} alt={art.name} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-wood-100">
                              <ImageIcon className="h-4 w-4 text-wood-400" />
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="font-medium text-gray-900">{art.name}</div>
                          {art.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{art.description}</div>}
                          {art.sku && <div className="text-xs text-gray-400 font-mono">{art.sku}</div>}
                        </td>
                        <td>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            art.category?.name === 'Restaurant' ? 'bg-primary-100 text-primary-700' :
                            art.category?.name === 'Boissons' ? 'bg-blue-100 text-blue-700' :
                            'bg-wood-100 text-wood-600'
                          }`}>
                            {art.category?.name || '-'}
                          </span>
                        </td>
                        <td className="font-semibold">{formatCurrency(art.unitPrice)}</td>
                        <td className="font-semibold">{art.currentStock} {art.unit}</td>
                        <td className="text-gray-400">{art.minimumStock}</td>
                        <td>
                          {art.currentStock <= art.minimumStock ? (
                            <span className="badge-danger"><AlertTriangle className="mr-1 h-3 w-3" />Bas</span>
                          ) : (
                            <span className="badge-success">OK</span>
                          )}
                        </td>
                        <td>
                          {art.isApproved === false ? (
                            <span className="badge-warning inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />En attente
                            </span>
                          ) : (
                            <span className="badge-success inline-flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />Validé
                            </span>
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
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setFieldErrors({}); }} title="Nouvel article de menu" size="lg">
        <form onSubmit={handleSubmitArticle} className="space-y-4">
          {isManager && (
            <div className="rounded-lg bg-accent-50 border border-accent-200 p-3 text-sm text-accent-800">
              <Clock className="inline h-4 w-4 mr-1.5" />
              Les articles créés par un Manager nécessitent l'approbation du DAF avant d'apparaître au menu.
            </div>
          )}

          {/* Image upload */}
          <div>
            <label className="label">Photo de l'article</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
            <div className="flex items-center gap-4">
              {(imagePreview || articleForm.imageUrl) ? (
                <div className="relative">
                  <img
                    src={imagePreview || resolveImageUrl(articleForm.imageUrl)}
                    alt="Aperçu"
                    className="h-20 w-20 rounded-lg object-cover border border-wood-200"
                  />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setArticleForm(prev => ({ ...prev, imageUrl: '' })); }}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-wood-300 bg-wood-50 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                  ) : (
                    <Upload className="h-6 w-6 text-wood-400" />
                  )}
                </div>
              )}
              <div className="text-sm text-wood-500">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary-600 hover:text-primary-700 font-medium">
                  {articleForm.imageUrl ? 'Changer l\'image' : 'Ajouter une photo'}
                </button>
                <p className="text-xs text-wood-400 mt-0.5">JPG, PNG ou WebP — Max 5 Mo</p>
              </div>
            </div>
            {fieldErrors.image && <p className="text-sm text-red-600 mt-1">{fieldErrors.image}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Catégorie <span className="text-red-500">*</span></label>
              <select
                value={articleForm.categoryId}
                onChange={(e) => { setArticleForm({ ...articleForm, categoryId: e.target.value }); setFieldErrors(prev => { const { categoryId, ...rest } = prev; return rest; }); }}
                className={`input ${fieldErrors.categoryId ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              >
                <option value="">— Choisir une catégorie —</option>
                {catList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.categoryId && <p className="text-sm text-red-600 mt-1">{fieldErrors.categoryId}</p>}
            </div>
            <div>
              <label className="label">Unité</label>
              <select value={articleForm.unit} onChange={(e) => setArticleForm({ ...articleForm, unit: e.target.value })} className="input">
                <option value="plat">Plat</option>
                <option value="verre">Verre</option>
                <option value="bouteille">Bouteille</option>
                <option value="canette">Canette</option>
                <option value="pièce">Pièce</option>
                <option value="sac">Sac</option>
                <option value="kg">Kg</option>
              </select>
            </div>
            <div>
              <label className="label">Nom <span className="text-red-500">*</span></label>
              <input
                value={articleForm.name}
                onChange={(e) => { setArticleForm({ ...articleForm, name: e.target.value }); setFieldErrors(prev => { const { name, ...rest } = prev; return rest; }); }}
                className={`input ${fieldErrors.name ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                placeholder="Ex: Poulet braisé"
              />
              {fieldErrors.name && <p className="text-sm text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="label">SKU <span className="text-wood-400 text-xs">(optionnel)</span></label>
              <input value={articleForm.sku} onChange={(e) => setArticleForm({ ...articleForm, sku: e.target.value })} className="input" placeholder="Ex: RES-001" />
            </div>
            <div>
              <label className="label">Prix de vente (FCFA) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={articleForm.unitPrice}
                onChange={(e) => { setArticleForm({ ...articleForm, unitPrice: e.target.value }); setFieldErrors(prev => { const { unitPrice, ...rest } = prev; return rest; }); }}
                className={`input ${fieldErrors.unitPrice ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                placeholder="Ex: 3500"
                min="0"
              />
              {fieldErrors.unitPrice && <p className="text-sm text-red-600 mt-1">{fieldErrors.unitPrice}</p>}
            </div>
            <div>
              <label className="label">Prix d'achat <span className="text-wood-400 text-xs">(optionnel)</span></label>
              <input type="number" value={articleForm.costPrice} onChange={(e) => setArticleForm({ ...articleForm, costPrice: e.target.value })} className="input" min="0" placeholder="0" />
            </div>
          </div>

          <div>
            <label className="label">Description <span className="text-wood-400 text-xs">(visible par le serveur sur l'app)</span></label>
            <textarea
              value={articleForm.description}
              onChange={(e) => setArticleForm({ ...articleForm, description: e.target.value })}
              className="input"
              rows={2}
              maxLength={500}
              placeholder="Ex: Demi-poulet braisé aux épices, servi avec frites et salade"
            />
          </div>

          {/* Stock fields — collapsible, optional */}
          <details className="rounded-lg border border-wood-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-wood-600 select-none">
              Stock & inventaire <span className="text-wood-400 text-xs">(optionnel pour les plats préparés)</span>
            </summary>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="label">Stock initial</label>
                <input type="number" value={articleForm.currentStock} onChange={(e) => setArticleForm({ ...articleForm, currentStock: e.target.value })} className="input" min="0" placeholder="0" />
              </div>
              <div>
                <label className="label">Stock minimum</label>
                <input type="number" value={articleForm.minimumStock} onChange={(e) => setArticleForm({ ...articleForm, minimumStock: e.target.value })} className="input" min="0" placeholder="0" />
              </div>
            </div>
          </details>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowCreate(false); setFieldErrors({}); }} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createArticleMutation.isPending || isUploading}>
              {(createArticleMutation.isPending || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer l'article
            </button>
          </div>
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
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowMovement(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary" disabled={createMovementMutation.isPending}>
              {createMovementMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
