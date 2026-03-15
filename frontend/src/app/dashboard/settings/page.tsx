'use client';
import { PageHeader } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Configuration de votre établissement" />
      <div className="card p-6 max-w-2xl">
        <h3 className="font-semibold text-gray-900 mb-4">Informations du compte</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Tenant ID</span>
            <code className="text-xs bg-gray-50 px-2 py-1 rounded">{user?.tenantId}</code>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Slug</span>
            <span className="font-medium">{user?.tenantSlug}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Utilisateur</span>
            <span className="font-medium">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Rôle</span>
            <span className="font-medium">{user?.role === 'SUPERADMIN' ? 'Super Admin' : 'Employé'}</span>
          </div>
        </div>
      </div>
      <div className="card p-6 max-w-2xl border-amber-200 bg-amber-50/30">
        <h3 className="font-semibold text-amber-900 mb-2">API Keys pour Channel Managers</h3>
        <p className="text-sm text-amber-700">
          La gestion des clés API pour les intégrations Booking.com, Expedia et autres channel managers
          sera disponible dans cette section. Contactez le support pour une configuration manuelle.
        </p>
      </div>
    </div>
  );
}
