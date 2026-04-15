'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, api } from '@/lib/api';
import { PageHeader, Pagination, SearchInput, EmptyState, LoadingPage } from '@/components/ui';
import { UserRound, Download, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

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

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search],
    queryFn: () => apiGet<any>(`/clients?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  const clients = data?.data || [];
  const meta = data?.meta;

  const downloadPdf = async (id: string, name: string) => {
    setDownloadingId(id);
    try {
      const res = await api.get(`/clients/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `carte-fidelite-${name.replace(/\s+/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors du téléchargement');
    }
    setDownloadingId(null);
  };

  if (isLoading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`${meta?.total || 0} client${(meta?.total || 0) > 1 ? 's' : ''} fidèle${(meta?.total || 0) > 1 ? 's' : ''}`}
      />
      <div className="w-64">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Nom, email, téléphone…" />
      </div>

      {clients.length === 0 ? (
        <EmptyState icon={UserRound} title="Aucun client" description="Les clients apparaissent après une réservation ou un paiement." />
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Contact</th>
                  <th>Séjours</th>
                  <th>Revenus</th>
                  <th>Fidélité</th>
                  <th className="w-0"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => {
                  const totalStays = c.reservationCount || 0;
                  const tier = totalStays >= 10 ? 'GOLD' : totalStays >= 5 ? 'SILVER' : totalStays >= 2 ? 'BRONZE' : 'NEW';
                  return (
                    <tr key={c.id}>
                      <td className="font-medium text-gray-900">{c.firstName} {c.lastName}</td>
                      <td className="text-sm text-gray-500">
                        {c.email && <div>{c.email}</div>}
                        {c.phone && <div>{c.phone}</div>}
                        {!c.email && !c.phone && '-'}
                      </td>
                      <td>{totalStays}</td>
                      <td className="font-medium">{Math.round(c.totalRevenue || 0).toLocaleString('fr-FR')} FCFA</td>
                      <td>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tierColors[tier]}`}>
                          {tierLabels[tier]}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Link href={`/dashboard/clients/${c.id}`} className="btn-ghost p-1.5" title="Détails">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => downloadPdf(c.id, `${c.firstName}_${c.lastName}`)}
                            disabled={downloadingId === c.id}
                            className="btn-ghost p-1.5 text-emerald-600"
                            title="Carte de fidélité PDF"
                          >
                            {downloadingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}
