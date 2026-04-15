'use client';
import { useQuery } from '@tanstack/react-query';
import { apiGet, api } from '@/lib/api';
import { PageHeader, LoadingPage } from '@/components/ui';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

const tierColors: Record<string, string> = {
  GOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  SILVER: 'bg-gray-100 text-gray-700 border-gray-300',
  BRONZE: 'bg-orange-100 text-orange-800 border-orange-300',
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
};

const tierLabels: Record<string, string> = {
  GOLD: 'Or',
  SILVER: 'Argent',
  BRONZE: 'Bronze',
  NEW: 'Nouveau',
};

export default function ClientDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => apiGet<any>(`/clients/${id}`),
    enabled: !!id,
  });

  const client = data?.data;

  const downloadPdf = async () => {
    if (!client) return;
    setDownloading(true);
    try {
      const res = await api.get(`/clients/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `carte-fidelite-${client.firstName}_${client.lastName}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement');
    }
    setDownloading(false);
  };

  if (isLoading || !client) return <LoadingPage />;

  const stats = client.stats || {};
  const tier = stats.fidelityTier || 'NEW';

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        subtitle={[client.email, client.phone].filter(Boolean).join(' • ')}
        action={
          <button onClick={downloadPdf} disabled={downloading} className="btn-primary">
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Carte de fidélité
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500">Fidélité</div>
          <div className="mt-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${tierColors[tier]}`}>
              {tierLabels[tier]}
            </span>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500">Séjours</div>
          <div className="mt-2 text-2xl font-bold">{stats.totalStays || 0}</div>
          <div className="text-xs text-gray-400">sur {stats.totalReservations || 0} réservations</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500">Revenus totaux</div>
          <div className="mt-2 text-2xl font-bold">{Math.round(stats.totalRevenue || 0).toLocaleString('fr-FR')} FCFA</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-gray-500">Dernière visite</div>
          <div className="mt-2 text-sm font-medium">
            {stats.lastVisit ? new Date(stats.lastVisit).toLocaleDateString('fr-FR') : 'Jamais'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="border-b px-4 py-3 font-medium">Réservations</div>
        {(!client.reservations || client.reservations.length === 0) ? (
          <div className="p-6 text-sm text-gray-500">Aucune réservation</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Chambre</th><th>Check-in</th><th>Check-out</th><th>Statut</th><th>Source</th></tr>
              </thead>
              <tbody>
                {client.reservations.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.room?.number || '-'} <span className="text-xs text-gray-400">{r.room?.type}</span></td>
                    <td>{new Date(r.checkIn).toLocaleDateString('fr-FR')}</td>
                    <td>{new Date(r.checkOut).toLocaleDateString('fr-FR')}</td>
                    <td><span className="text-xs px-2 py-0.5 rounded bg-gray-100">{r.status}</span></td>
                    <td className="text-xs text-gray-500">{r.source || 'DIRECT'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="border-b px-4 py-3 font-medium">Factures</div>
        {(!client.invoices || client.invoices.length === 0) ? (
          <div className="p-6 text-sm text-gray-500">Aucune facture</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>N°</th><th>Date</th><th>Montant</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {client.invoices.map((i: any) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.invoiceNumber}</td>
                    <td>{new Date(i.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td>{Math.round(Number(i.totalAmount)).toLocaleString('fr-FR')} FCFA</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded ${i.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
