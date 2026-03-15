'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { PageHeader, StatusBadge, LoadingPage } from '@/components/ui';
import { CreditCard } from 'lucide-react';

export default function PaymentsPage() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices-for-payments'],
    queryFn: () => apiGet<any>('/invoices?limit=50&status=PAID'),
  });

  if (isLoading) return <LoadingPage />;
  const items = invoices?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Paiements" subtitle="Historique des factures payées" />
      <div className="card"><div className="table-container"><table>
        <thead><tr><th>Facture</th><th>Client</th><th>Montant</th><th>Statut</th><th>Payé le</th></tr></thead>
        <tbody>{items.map((inv: any) => (
          <tr key={inv.id}>
            <td className="font-semibold">{inv.invoiceNumber}</td>
            <td>{inv.reservation?.guestName || 'Direct'}</td>
            <td className="font-medium">{formatCurrency(inv.totalAmount)}</td>
            <td><StatusBadge status={inv.status} /></td>
            <td className="text-xs text-gray-400">{inv.paidAt ? formatDateTime(inv.paidAt) : '-'}</td>
          </tr>
        ))}</tbody>
      </table></div></div>
    </div>
  );
}
