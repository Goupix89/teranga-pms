'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api';
import { PageHeader, EmptyState, LoadingPage } from '@/components/ui';
import { UtensilsCrossed, Clock, ChefHat, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelative, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Order, OrderStatus } from '@/types';

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);

  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-orders', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/orders/kitchen/${currentEstId}`) : null,
    enabled: !!currentEstId,
    refetchInterval: 10000, // Poll every 10s for near-real-time
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => apiPatch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      toast.success('Commande mise à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  if (isLoading) return <LoadingPage />;

  const orders: Order[] = data?.data || [];
  const pending = orders.filter((o) => o.status === 'PENDING');
  const inProgress = orders.filter((o) => o.status === 'IN_PROGRESS');

  if (!currentEstId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cuisine" subtitle="Vue temps réel des commandes" />
        <EmptyState icon={UtensilsCrossed} title="Sélectionnez un établissement" description="Choisissez un établissement dans le menu latéral" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuisine"
        subtitle={`${orders.length} commande${orders.length > 1 ? 's' : ''} en cours`}
      />

      {orders.length === 0 ? (
        <EmptyState icon={ChefHat} title="Aucune commande en cuisine" description="Les nouvelles commandes apparaîtront ici automatiquement" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending orders */}
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-700 mb-4">
              <Clock className="h-5 w-5" />
              En attente ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  onAction={() => updateStatusMutation.mutate({ id: order.id, status: 'IN_PROGRESS' })}
                  actionLabel="Commencer"
                  actionColor="bg-blue-600 hover:bg-blue-700"
                  borderColor="border-l-amber-400"
                  loading={updateStatusMutation.isPending}
                />
              ))}
              {pending.length === 0 && <p className="text-sm text-gray-400 italic">Aucune commande en attente</p>}
            </div>
          </div>

          {/* In progress orders */}
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-blue-700 mb-4">
              <ChefHat className="h-5 w-5" />
              En préparation ({inProgress.length})
            </h2>
            <div className="space-y-3">
              {inProgress.map((order) => (
                <KitchenCard
                  key={order.id}
                  order={order}
                  onAction={() => updateStatusMutation.mutate({ id: order.id, status: 'READY' })}
                  actionLabel="Prête !"
                  actionColor="bg-green-600 hover:bg-green-700"
                  borderColor="border-l-blue-400"
                  loading={updateStatusMutation.isPending}
                />
              ))}
              {inProgress.length === 0 && <p className="text-sm text-gray-400 italic">Aucune commande en préparation</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KitchenCard({
  order, onAction, actionLabel, actionColor, borderColor, loading,
}: {
  order: Order;
  onAction: () => void;
  actionLabel: string;
  actionColor: string;
  borderColor: string;
  loading: boolean;
}) {
  return (
    <div className={`card border-l-4 ${borderColor} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-gray-900 text-lg">{order.orderNumber}</p>
          {order.tableNumber && <p className="text-sm text-gray-500">Table {order.tableNumber}</p>}
        </div>
        <span className="text-xs text-gray-400">{formatRelative(order.createdAt)}</span>
      </div>

      <div className="space-y-1.5 mb-4">
        {order.items?.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-800">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 text-xs font-bold mr-2">
                {item.quantity}
              </span>
              {item.article?.name || 'Article'}
            </span>
          </div>
        ))}
      </div>

      {order.notes && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
          {order.notes}
        </p>
      )}

      <button
        onClick={onAction}
        disabled={loading}
        className={`w-full text-white font-medium py-2.5 rounded-lg transition-colors ${actionColor} disabled:opacity-50`}
      >
        <CheckCircle className="inline-block h-4 w-4 mr-2" />
        {actionLabel}
      </button>
    </div>
  );
}
