'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { PageHeader, StatusBadge, Pagination, Modal, EmptyState, LoadingPage } from '@/components/ui';
import { ClipboardCheck, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime, statusLabels } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { ApprovalRequest } from '@/types';

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const currentEstId = useAuthStore((s) => s.currentEstablishmentId);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [typeFilter, setTypeFilter] = useState('');
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', page, statusFilter, typeFilter, currentEstId],
    queryFn: () => apiGet<any>(`/approvals?page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}${typeFilter ? `&type=${typeFilter}` : ''}${currentEstId ? `&establishmentId=${currentEstId}` : ''}`),
  });

  const { data: pendingCount } = useQuery({
    queryKey: ['approval-count', currentEstId],
    queryFn: () => currentEstId ? apiGet<any>(`/approvals/pending-count/${currentEstId}`) : null,
    enabled: !!currentEstId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/approvals/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval-count'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Demande approuvée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => apiPost(`/approvals/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['approval-count'] });
      setRejectTarget(null);
      setRejectReason('');
      toast.success('Demande rejetée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const approvals = data?.data || [];
  const meta = data?.meta;
  const count = pendingCount?.data?.count || 0;

  const typeLabels: Record<string, string> = {
    EMPLOYEE_CREATION: 'Création employé',
    RESERVATION_MODIFICATION: 'Modification réservation',
  };

  const formatPayload = (approval: ApprovalRequest): string => {
    const p = approval.payload;
    if (approval.type === 'EMPLOYEE_CREATION') {
      return `${p.firstName || ''} ${p.lastName || ''} (${p.email || ''}) — Rôle: ${statusLabels[p.role as string] || p.role}`;
    }
    if (approval.type === 'RESERVATION_MODIFICATION') {
      return `Réservation: ${p.guestName || p.reservationId || ''}`;
    }
    return JSON.stringify(p);
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approbations"
        subtitle={count > 0 ? `${count} demande${count > 1 ? 's' : ''} en attente` : 'Aucune demande en attente'}
      />

      {/* Filters */}
      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-48">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Approuvées</option>
          <option value="REJECTED">Rejetées</option>
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="input w-56">
          <option value="">Tous les types</option>
          <option value="EMPLOYEE_CREATION">Création employé</option>
          <option value="RESERVATION_MODIFICATION">Modification réservation</option>
        </select>
      </div>

      {approvals.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune demande" description={statusFilter === 'PENDING' ? 'Aucune demande en attente de validation' : 'Aucune demande trouvée'} />
      ) : (
        <div className="space-y-3">
          {approvals.map((approval: ApprovalRequest) => (
            <div key={approval.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {typeLabels[approval.type] || approval.type}
                    </span>
                    <StatusBadge status={approval.status} />
                  </div>

                  <p className="text-sm text-gray-800 font-medium mb-1">{formatPayload(approval)}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Demandé par : {approval.requestedBy?.firstName} {approval.requestedBy?.lastName}</span>
                    <span>{formatDateTime(approval.createdAt)}</span>
                    {approval.reviewedBy && (
                      <span>Traité par : {approval.reviewedBy.firstName} {approval.reviewedBy.lastName}</span>
                    )}
                  </div>

                  {approval.reason && (
                    <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      Motif de rejet : {approval.reason}
                    </p>
                  )}
                </div>

                {approval.status === 'PENDING' && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => approveMutation.mutate(approval.id)}
                      disabled={approveMutation.isPending}
                      className="btn-ghost text-green-600 hover:bg-green-50 p-2"
                      title="Approuver"
                    >
                      {approveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => setRejectTarget(approval)}
                      className="btn-ghost text-red-600 hover:bg-red-50 p-2"
                      title="Rejeter"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
        </div>
      )}

      {/* Reject modal */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Rejeter la demande" size="sm">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (rejectTarget) {
            rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason || undefined });
          }
        }} className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejeter la demande de {rejectTarget?.requestedBy?.firstName} {rejectTarget?.requestedBy?.lastName} ?
          </p>
          <div>
            <label className="label">Motif (optionnel)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Expliquez le motif du rejet..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setRejectTarget(null)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-danger" disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rejeter
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
