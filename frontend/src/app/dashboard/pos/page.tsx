'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { api } from '@/lib/api';
import { LoadingPage, EmptyState } from '@/components/ui';
import {
  ShoppingCart, Search, Minus, Plus, Trash2, X, QrCode,
  ExternalLink, CheckCircle2, Loader2, Receipt, FileDown, Wallet, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, statusLabels } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { PaymentMethod } from '@/types';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import {
  cacheArticles, readCachedArticles, enqueueOp, newId, nextLocalOrderRef,
} from '@/lib/offline-db';

interface Article {
  id: string;
  name: string;
  unitPrice: number;
  category?: { id: string; name: string };
  imageUrl?: string | null;
  description?: string | null;
  currentStock?: number;
  trackStock?: boolean;
}

interface CartItem {
  article: Article;
  quantity: number;
}

const CASHIN_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'MOOV_MONEY' as PaymentMethod, label: 'Flooz' },
  { value: 'MIXX_BY_YAS' as PaymentMethod, label: 'Yas' },
  { value: 'CARD', label: 'Carte bancaire' },
  { value: 'FEDAPAY' as PaymentMethod, label: 'FedaPay' },
  { value: 'BANK_TRANSFER', label: 'Virement' },
  { value: 'OTHER' as PaymentMethod, label: 'Autre' },
];

export default function PosPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const currentUser = useAuthStore((s) => s.user);
  const currentEstRole = useAuthStore((s) => s.currentEstablishmentRole);
  const currentTenantId = currentUser?.tenantId || '';
  const isPOS = currentEstRole === 'POS';
  const { online, offline } = useOfflineStatus();
  const [offlineArticles, setOfflineArticles] = useState<Article[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [discountRuleId, setDiscountRuleId] = useState<string>('');
  const [isVoucher, setIsVoucher] = useState(false);
  const [voucherOwnerId, setVoucherOwnerId] = useState('');
  const [voucherOwnerName, setVoucherOwnerName] = useState('');
  const [serverId, setServerId] = useState<string>('');
  const [operationDate, setOperationDate] = useState<string>('');
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    invoiceId?: string;
    qrCode?: string;
    totalAmount?: number;
    paid?: boolean;
    fedapayCheckoutUrl?: string;
  }>({ open: false });
  const [cashInModal, setCashInModal] = useState<{
    open: boolean;
    orderId?: string;
    orderNumber?: string;
    invoiceId?: string;
    totalAmount?: number;
    method: PaymentMethod;
    paidAt: string;
  }>({ open: false, method: 'CASH', paidAt: '' });

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const canBackdateBeyondCap = isSuperAdmin || ['OWNER', 'DAF', 'MANAGER'].includes(currentEstRole || '');
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const nowLocal = toLocalInput(new Date());
  const minLocal = toLocalInput(new Date(Date.now() - (canBackdateBeyondCap ? 365 : 15) * 24 * 3600 * 1000));

  // Fetch articles
  const { data: articlesData, isLoading } = useQuery({
    queryKey: ['pos-articles', currentEstId],
    queryFn: () => apiGet<any>(`/articles?limit=500&menuOnly=true${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['pos-categories', currentEstId],
    queryFn: () => apiGet<any>(`/categories${currentEstId ? `?establishmentId=${currentEstId}` : ''}`),
  });

  const { data: ownersData } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiGet<any>('/users/owners'),
    enabled: isVoucher,
  });

  // Servers of the current establishment — POS picks whom to attribute the order to
  const { data: serversData } = useQuery({
    queryKey: ['establishment-servers', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/establishments/${currentEstId}/servers`) : null,
    enabled: isPOS && !!currentEstId,
  });
  const servers: Array<{ id: string; firstName: string; lastName: string; role: string }> = serversData?.data || [];

  // Fetch applicable discount rules for orders
  const { data: discountRulesData } = useQuery({
    queryKey: ['discount-rules-order'],
    queryFn: () => apiGet<any>('/discount-rules?appliesTo=ORDER&isActive=true'),
  });
  const discountRules: any[] = discountRulesData?.data || [];

  const onlineArticles: Article[] = articlesData?.data || [];
  // Merge: prefer fresh server data, fall back to cached articles when offline
  const articles: Article[] = onlineArticles.length > 0 ? onlineArticles : offlineArticles;
  const categories = categoriesData?.data || [];

  // Cache articles to IndexedDB whenever they arrive (so the POS can survive a
  // network outage with the menu it last saw).
  useEffect(() => {
    if (onlineArticles.length > 0 && currentEstId && currentTenantId) {
      cacheArticles(currentTenantId, currentEstId, onlineArticles as unknown as Array<{ id: string }>)
        .catch(() => { /* cache write failure is non-fatal */ });
    }
  }, [onlineArticles, currentEstId, currentTenantId]);

  // Read from cache when offline on mount
  useEffect(() => {
    if (!currentEstId) return;
    readCachedArticles(currentEstId)
      .then((rows) => setOfflineArticles(rows as Article[]))
      .catch(() => setOfflineArticles([]));
  }, [currentEstId, offline]);

  // Filter articles
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !categoryFilter || a.category?.id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [articles, search, categoryFilter]);

  // Cart operations
  const addToCart = (article: Article) => {
    if (article.trackStock) {
      const available = article.currentStock ?? 0;
      const current = cart.find((c) => c.article.id === article.id)?.quantity ?? 0;
      if (current + 1 > available) {
        toast.error(`Stock insuffisant pour ${article.name} (${available} disponible${available > 1 ? 's' : ''})`);
        return;
      }
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.article.id === article.id);
      if (existing) {
        return prev.map((item) =>
          item.article.id === article.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { article, quantity: 1 }];
    });
  };

  const updateQuantity = (articleId: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.article.id === articleId);
      if (item && delta > 0 && item.article.trackStock) {
        const available = item.article.currentStock ?? 0;
        if (item.quantity + delta > available) {
          toast.error(`Stock insuffisant pour ${item.article.name} (${available} disponible${available > 1 ? 's' : ''})`);
          return prev;
        }
      }
      return prev
        .map((item) =>
          item.article.id === articleId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (articleId: string) => {
    setCart((prev) => prev.filter((item) => item.article.id !== articleId));
  };

  const clearCart = () => { setCart([]); setIsVoucher(false); setVoucherOwnerId(''); setVoucherOwnerName(''); setServerId(''); setOperationDate(''); };

  const cartTotal = cart.reduce((sum, item) => sum + item.article.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Create order
  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<any>('/orders', body),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      const order = response?.data;
      toast.success(`Commande #${order?.orderNumber || ''} créée`);
      clearCart();
      setTableNumber('');
      setNotes('');

      if (order?.id && order?.invoiceId) {
        setCashInModal({
          open: true,
          orderId: order.id,
          orderNumber: order.orderNumber,
          invoiceId: order.invoiceId,
          totalAmount: order.totalAmount,
          method: 'CASH',
          paidAt: operationDate,
        });
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création'),
  });

  const cashInMutation = useMutation({
    mutationFn: ({ id, method, paidAt }: { id: string; method: PaymentMethod; paidAt?: string }) =>
      apiPost<any>(`/orders/${id}/cashin`, { method, ...(paidAt ? { paidAt } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCashInModal({ open: false, method: 'CASH', paidAt: '' });
      toast.success('Encaissement enregistré — commande servie');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur encaissement'),
  });

  const openQrFromCashIn = async () => {
    if (!cashInModal.invoiceId) return;
    try {
      const qr = await apiGet<any>(`/invoices/${cashInModal.invoiceId}/qrcode?paymentMethod=${cashInModal.method}`);
      setQrModal({
        open: true,
        invoiceId: cashInModal.invoiceId,
        qrCode: qr?.data?.qrCode,
        totalAmount: cashInModal.totalAmount,
        paid: false,
        fedapayCheckoutUrl: qr?.data?.fedapayCheckoutUrl,
      });
      setCashInModal({ open: false, method: 'CASH', paidAt: '' });
    } catch {
      toast.error('QR code indisponible');
    }
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Le panier est vide');
      return;
    }
    const operationDateIso = operationDate
      ? new Date(operationDate).toISOString()
      : new Date().toISOString();
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      establishmentId: currentEstId,
      idempotencyKey,
      tableNumber: tableNumber || undefined,
      notes: notes || undefined,
      discountRuleId: !isVoucher && discountRuleId ? discountRuleId : undefined,
      isVoucher: isVoucher || undefined,
      voucherOwnerId: isVoucher && voucherOwnerId ? voucherOwnerId : undefined,
      voucherOwnerName: isVoucher && voucherOwnerName ? voucherOwnerName : undefined,
      serverId: isPOS && serverId ? serverId : undefined,
      operationDate: operationDateIso,
      items: cart.map((item) => ({
        articleId: item.article.id,
        quantity: item.quantity,
        unitPrice: item.article.unitPrice,
      })),
    };

    // Online: existing happy path
    if (online) {
      createMutation.mutate(payload);
      return;
    }

    // Offline: persist in IndexedDB; sync worker will drain on reconnection.
    // We don't open the cash-in modal because digital methods need the server;
    // operator can record CASH payment via the same offline queue later, or
    // simply hand-write the ticket and wait for sync.
    if (isVoucher && !voucherOwnerId) {
      toast.error('Propriétaire requis pour un bon hors-ligne');
      return;
    }

    const localRef = nextLocalOrderRef();
    const summary = `${cart.length} article(s) — ${formatCurrency(cartTotal)}${tableNumber ? ` — Table ${tableNumber}` : ''}`;

    await enqueueOp({
      id: newId(),
      type: 'order.create',
      method: 'POST',
      url: '/orders',
      payload,
      idempotencyKey,
      localRef,
      tenantId: currentTenantId,
      establishmentId: currentEstId || undefined,
      summary,
    });

    toast.success(`Commande ${localRef} enregistrée hors-ligne — sera envoyée au retour du réseau`);
    clearCart();
    setTableNumber('');
    setNotes('');
  };

  // Simulate payment (dev)
  const simulatePayment = useMutation({
    mutationFn: (invoiceId: string) => apiPost(`/invoices/${invoiceId}/simulate-payment`),
    onSuccess: () => {
      setQrModal((prev) => ({ ...prev, paid: true }));
      toast.success('Paiement confirme');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur paiement'),
  });

  // Poll invoice payment status when QR modal is open (FedaPay confirmation)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (qrModal.open && qrModal.invoiceId && !qrModal.paid) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await apiGet<any>(`/invoices/${qrModal.invoiceId}/payment-status`);
          if (res?.data?.paid) {
            setQrModal((prev) => ({ ...prev, paid: true }));
            toast.success('Paiement reçu !');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch {}
      }, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [qrModal.open, qrModal.invoiceId, qrModal.paid]);

  // Receipt download
  const downloadReceipt = async (orderId: string) => {
    try {
      const res = await api.get(`/orders/${orderId}/receipt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du telechargement');
    }
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 -m-6 lg:-m-8 p-4">
      {/* Left: Article grid */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search & filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un article..."
              className="input pl-10 w-full"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">Toutes les categories</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Articles grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredArticles.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Aucun article" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredArticles.map((article) => {
                const inCart = cart.find((c) => c.article.id === article.id);
                const outOfStock = article.trackStock && (article.currentStock ?? 0) <= 0;
                return (
                  <button
                    key={article.id}
                    onClick={() => addToCart(article)}
                    disabled={outOfStock}
                    className={`group relative flex flex-col rounded-xl border-2 p-3 text-left transition-all ${
                      outOfStock
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : inCart
                          ? 'border-primary-500 bg-primary-50 hover:shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    {inCart && !outOfStock && (
                      <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                        {inCart.quantity}
                      </span>
                    )}
                    {outOfStock && (
                      <span className="absolute top-1 right-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        Rupture
                      </span>
                    )}
                    {article.imageUrl ? (
                      <div className="mb-2 aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                        <img src={article.imageUrl} alt={article.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-lg bg-gray-50 text-3xl">
                        {article.category?.name === 'Boissons' ? '🥤' : '🍽️'}
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{article.name}</p>
                    <p className="mt-auto pt-1 text-sm font-bold text-primary-600">
                      {formatCurrency(article.unitPrice)}
                    </p>
                    {article.trackStock && (
                      <p className={`text-xs mt-0.5 ${outOfStock ? 'text-red-600 font-medium' : (article.currentStock ?? 0) <= 5 ? 'text-orange-600' : 'text-gray-400'}`}>
                        Stock : {article.currentStock ?? 0}
                      </p>
                    )}
                    {article.category && !article.trackStock && (
                      <p className="text-xs text-gray-400 mt-0.5">{article.category.name}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart panel */}
      <div className="flex w-[380px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Cart header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Panier</h2>
            {cartCount > 0 && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                {cartCount}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Vider
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Panier vide</p>
              <p className="text-xs mt-1">Cliquez sur un article pour l&apos;ajouter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.article.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.article.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.article.unitPrice)} / unite</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.article.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-100"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.article.id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border bg-white text-gray-600 hover:bg-gray-100"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.article.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="w-20 text-right text-sm font-semibold text-gray-900">
                    {formatCurrency(item.article.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart footer */}
        <div className="border-t p-4 space-y-3">
          {/* Table number */}
          <div>
            <label className="text-xs font-medium text-gray-500">Table</label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="N° table"
              className="input mt-1 text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Le paiement sera choisi après la création de la commande.</p>
          </div>

          {/* Serveur attribué (POS uniquement) */}
          {isPOS && servers.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500">Serveur attribué</label>
              <select
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                className="input mt-1 text-sm"
              >
                <option value="">— Aucun (moi-même) —</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} · {s.role}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">La commande sera attribuée à ce serveur. Votre saisie reste tracée.</p>
            </div>
          )}

          {/* Date de l'opération (rétrodatage pour saisie de veille) */}
          <div>
            <label className="text-xs font-medium text-gray-500">Date de l'opération</label>
            <input
              type="datetime-local"
              value={operationDate}
              min={minLocal}
              max={nowLocal}
              onChange={(e) => setOperationDate(e.target.value)}
              className="input mt-1 text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {canBackdateBeyondCap ? 'Rétrodatage illimité (superviseur).' : 'Rétrodatage limité à 15 jours.'} Laissez vide pour aujourd'hui.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructions..."
              className="input mt-1 text-sm"
            />
          </div>

          {/* Remise manuelle */}
          {!isVoucher && discountRules.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500">Remise (optionnel)</label>
              <select
                value={discountRuleId}
                onChange={(e) => setDiscountRuleId(e.target.value)}
                className="input mt-1 text-sm"
              >
                <option value="">Aucune remise</option>
                {discountRules.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.type === 'PERCENTAGE' ? `${Number(r.value)}%` : `${Math.round(Number(r.value)).toLocaleString('fr-FR')} FCFA`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bon Propriétaire */}
          <div className={`rounded-lg border p-2.5 ${isVoucher ? 'bg-amber-50 border-amber-300' : 'bg-wood-800/50 border-wood-700'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isVoucher} onChange={(e) => { setIsVoucher(e.target.checked); setVoucherOwnerId(''); setVoucherOwnerName(''); }} className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
              <span className={`text-sm font-medium ${isVoucher ? 'text-amber-800' : 'text-wood-300'}`}>Bon Propriétaire</span>
            </label>
            {isVoucher && (
              <select
                value={voucherOwnerId}
                onChange={(e) => {
                  const owner = (ownersData?.data || []).find((o: any) => o.id === e.target.value);
                  setVoucherOwnerId(e.target.value);
                  setVoucherOwnerName(owner?.name || '');
                }}
                className="input mt-2 text-sm border-amber-300"
              >
                <option value="">— Propriétaire —</option>
                {(ownersData?.data || []).map((o: any) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Total */}
          <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${isVoucher ? 'bg-amber-100' : 'bg-wood-800'}`}>
            <span className={`text-sm font-medium ${isVoucher ? 'text-amber-700' : 'text-wood-300'}`}>{isVoucher ? 'Total (Bon)' : 'Total'}</span>
            <span className={`text-xl font-bold ${isVoucher ? 'text-amber-800' : 'text-accent-500'}`}>{formatCurrency(cartTotal)}</span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmitOrder}
            disabled={cart.length === 0 || createMutation.isPending}
            className="btn-primary w-full py-3 text-base"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                Envoi...
              </>
            ) : (
              <>
                <Receipt className="mr-2 h-4 w-4 inline" />
                Valider la commande
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cash-in modal — pick payment method post-creation */}
      {cashInModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-red-600" /> Encaisser la commande
              </h3>
              <button onClick={() => setCashInModal({ open: false, method: 'CASH', paidAt: '' })} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm mb-4">
              <p className="font-semibold text-gray-900">Commande #{cashInModal.orderNumber || ''}</p>
              <p className="text-xl font-bold text-primary-700 mt-1">{formatCurrency(cashInModal.totalAmount || 0)}</p>
            </div>
            <p className="text-xs font-medium text-gray-500 mb-2">Moyen de paiement</p>
            {offline && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <WifiOff className="h-3.5 w-3.5" />
                Hors-ligne — seuls espèces, virement ou "autre" sont disponibles. Les paiements électroniques nécessitent Internet.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {CASHIN_METHODS.map((m) => {
                const requiresOnline = ['MOBILE_MONEY', 'MOOV_MONEY', 'MIXX_BY_YAS', 'FEDAPAY', 'CARD'].includes(m.value);
                const disabled = offline && requiresOnline;
                return (
                  <label
                    key={m.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                      disabled
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : cashInModal.method === m.value
                          ? 'border-primary-500 bg-primary-50 cursor-pointer'
                          : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="posCashInMethod"
                      value={m.value}
                      checked={cashInModal.method === m.value}
                      disabled={disabled}
                      onChange={() => setCashInModal((prev) => ({ ...prev, method: m.value }))}
                      className="h-4 w-4 text-primary-600"
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                );
              })}
            </div>
            {(cashInModal.method === 'FEDAPAY' || cashInModal.method === 'MOBILE_MONEY' || cashInModal.method === ('MOOV_MONEY' as PaymentMethod) || cashInModal.method === ('MIXX_BY_YAS' as PaymentMethod)) && (
              <button
                onClick={openQrFromCashIn}
                className="btn-secondary w-full mb-2 flex items-center justify-center gap-2"
              >
                <QrCode className="h-4 w-4" /> Afficher le QR code de paiement
              </button>
            )}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500">Date de l'opération</label>
              <input
                type="datetime-local"
                value={cashInModal.paidAt}
                min={minLocal}
                max={nowLocal}
                onChange={(e) => setCashInModal((prev) => ({ ...prev, paidAt: e.target.value }))}
                className="input mt-1 text-sm w-full"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {canBackdateBeyondCap ? 'Rétrodatage illimité (superviseur).' : 'Rétrodatage limité à 15 jours.'} Laissez vide pour utiliser maintenant.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCashInModal({ open: false, method: 'CASH', paidAt: '' })}
                className="btn-secondary flex-1"
              >
                Plus tard
              </button>
              <button
                onClick={() => {
                  if (cashInModal.orderId) {
                    const paidAtIso = cashInModal.paidAt ? new Date(cashInModal.paidAt).toISOString() : undefined;
                    cashInMutation.mutate({ id: cashInModal.orderId, method: cashInModal.method, paidAt: paidAtIso });
                  }
                }}
                disabled={cashInMutation.isPending || !cashInModal.orderId}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
              >
                {cashInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Payment Modal */}
      {qrModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Paiement</h3>
              <button onClick={() => setQrModal({ open: false })} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {qrModal.paid ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-green-700">Paiement confirme</p>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(qrModal.totalAmount || 0)}</p>
              </div>
            ) : (
              <>
                {qrModal.qrCode && (
                  <div className="flex justify-center mb-4">
                    <img src={qrModal.qrCode} alt="QR Code" className="w-48 h-48 rounded-lg" />
                  </div>
                )}
                <p className="text-center text-sm text-gray-600 mb-2">
                  Montant : <strong>{formatCurrency(qrModal.totalAmount || 0)}</strong>
                </p>

                {qrModal.fedapayCheckoutUrl && (
                  <a
                    href={qrModal.fedapayCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 mb-3"
                  >
                    <ExternalLink className="h-4 w-4" /> Payer via FedaPay
                  </a>
                )}

                <button
                  onClick={() => qrModal.invoiceId && simulatePayment.mutate(qrModal.invoiceId)}
                  disabled={simulatePayment.isPending}
                  className="btn-secondary w-full py-2"
                >
                  {simulatePayment.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                  ) : (
                    <QrCode className="mr-2 h-4 w-4 inline" />
                  )}
                  Simuler le paiement
                </button>
              </>
            )}

            <button
              onClick={() => setQrModal({ open: false })}
              className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
