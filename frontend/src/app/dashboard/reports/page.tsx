'use client';
import { PageHeader } from '@/components/ui';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Rapports" subtitle="Analyse et statistiques" />
      <div className="card p-12 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Module Rapports</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Les rapports détaillés (taux d'occupation, revenus, analyse des stocks) seront disponibles
          dans une prochaine version. Le tableau de bord fournit déjà les métriques essentielles.
        </p>
      </div>
    </div>
  );
}
