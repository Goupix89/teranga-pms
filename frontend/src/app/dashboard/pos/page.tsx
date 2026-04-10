'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { api } from '@/lib/api';
import { LoadingPage, EmptyState } from '@/components/ui';
import {
  ShoppingCart, Search, Minus, Plus, Trash2, X, QrCode,
  ExternalLink, CheckCircle2, Loader2, Receipt, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, statusLabels } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { PaymentMethod } from '@/types';

interface Article {
  id: string;
  name: string;
  unitPrice: number;
  category?: { id: string; name: string };
  imageUrl?: string | null;
  description?: string | null;
  currentStock?: number;
}

interface CartItem {
  article: Article;
  quantity: number;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Especes' },
  { value: 'MOOV_MONEY', label: 'Moov Money / Flooz' },
  { value: 'MIXX_BY_YAS', label: 'MTN / Mixx by Yas' },
  { value: 'FEDAPAY', label: 'FedaPay' },
  { value: 'CARD', label: 'Carte bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

export default function PosPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);
  const currentUser = useAuthStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');
  const [isVoucher, setIsVoucher] = useState(false);
  const [voucherOwnerId, setVoucherOwnerId] = useState('');
  const [voucherOwnerName, setVoucherOwnerName] = useState('');
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    invoiceId?: string;
    qrCode?: string;
    totalAmount?: number;
    paid?: boolean;
    fedapayCheckoutUrl?: string;
  }>({ open: false });

  // Fetch articles
  const { data: articlesData, isLoading } = useQuery({
    queryKey: ['pos-articles', currentEstId],
    queryFn: () => apiGet<any>(`/articles?limit=500&menuOnly=true${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['pos-categories', currentEstId],
    queryFn: () => apiGet<any>(`/article-categories?${currentEstId ? `establishmentId=${currentEstId}` : ''}`),
  });

  const { data: ownersData } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiGet<any>('/users/owners'),
    enabled: isVoucher,
  });

  const articles: Article[] = articlesData?.data || [];
  const categories = categoriesData?.data || [];

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
    setCart((prev) =>
      prev
        .map((item) =>
          item.article.id === articleId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (articleId: string) => {
    setCart((prev) => prev.filter((item) => item.article.id !== articleId));
  };

  const clearCart = () => { setCart([]); setIsVoucher(false); setVoucherOwnerId(''); setVoucherOwnerName(''); };

  const cartTotal = cart.reduce((sum, item) => sum + item.article.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Create order
  const createMutation = useMutation({
    mutationFn: (body: any) => apiPost<any>('/orders', body),
    onSuccess: async (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      const order = response?.data;
      toast.success(`Commande #${order?.orderNumber || ''} creee`);
      clearCart();
      setTableNumber('');
      setNotes('');

      // If payment method requires QR code, show it
      if (order?.invoiceId && paymentMethod !== 'CASH') {
        try {
          const qr = await apiGet<any>(`/invoices/${order.invoiceId}/qrcode?method=${paymentMethod}`);
          setQrModal({
            open: true,
            invoiceId: order.invoiceId,
            qrCode: qr?.data?.qrCode,
            totalAmount: order.totalAmount,
            paid: false,
            fedapayCheckoutUrl: qr?.data?.fedapayCheckoutUrl,
          });
        } catch {
          // QR code generation failed, but order was created
        }
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la creation'),
  });

  const handleSubmitOrder = () => {
    if (cart.length === 0) {
      toast.error('Le panier est vide');
      return;
    }
    createMutation.mutate({
      establishmentId: currentEstId,
      idempotencyKey: crypto.randomUUID(),
      tableNumber: tableNumber || undefined,
      paymentMethod,
      notes: notes || undefined,
      isVoucher: isVoucher || undefined,
      voucherOwnerId: isVoucher && voucherOwnerId ? voucherOwnerId : undefined,
      voucherOwnerName: isVoucher && voucherOwnerName ? voucherOwnerName : undefined,
      items: cart.map((item) => ({
        articleId: item.article.id,
        quantity: item.quantity,
        unitPrice: item.article.unitPrice,
      })),
    });
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
                return (
                  <button
                    key={article.id}
                    onClick={() => addToCart(article)}
                    className={`group relative flex flex-col rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                      inCart
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                        {inCart.quantity}
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
                    {article.category && (
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
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500">Table</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="N° table"
                className="input mt-1 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500">Paiement</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="input mt-1 text-sm"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>
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
