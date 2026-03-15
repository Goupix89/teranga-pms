'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import { EstablishmentRole } from '@/types';
import {
  LayoutDashboard, BedDouble, CalendarCheck, Receipt, CreditCard,
  Package, Truck, Users, Building2, Settings, LogOut, ChevronLeft,
  BarChart3, UtensilsCrossed, SprayCan, ClipboardCheck, AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tenant roles that can see this item (SUPERADMIN always sees everything) */
  superadminOnly?: boolean;
  /** Establishment roles that can see this item */
  estRoles?: EstablishmentRole[];
};

const navigation: NavItem[] = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, estRoles: ['DAF', 'MANAGER', 'SERVER', 'POS', 'COOK', 'CLEANER'] },
  { name: 'Établissements', href: '/dashboard/establishments', icon: Building2, superadminOnly: true },
  { name: 'Chambres', href: '/dashboard/rooms', icon: BedDouble, estRoles: ['DAF', 'MANAGER', 'SERVER', 'CLEANER'] },
  { name: 'Réservations', href: '/dashboard/reservations', icon: CalendarCheck, estRoles: ['DAF', 'MANAGER', 'SERVER'] },
  { name: 'Commandes', href: '/dashboard/orders', icon: UtensilsCrossed, estRoles: ['DAF', 'MANAGER', 'SERVER'] },
  { name: 'Cuisine', href: '/dashboard/kitchen', icon: UtensilsCrossed, estRoles: ['DAF', 'MANAGER', 'COOK'] },
  { name: 'Factures', href: '/dashboard/invoices', icon: Receipt, estRoles: ['DAF', 'MANAGER', 'SERVER'] },
  { name: 'Paiements', href: '/dashboard/payments', icon: CreditCard, estRoles: ['DAF', 'MANAGER', 'SERVER', 'POS'] },
  { name: 'Stock & Inventaire', href: '/dashboard/stock', icon: Package, estRoles: ['DAF', 'MANAGER'] },
  { name: 'Alertes Stock', href: '/dashboard/stock-alerts', icon: AlertTriangle, estRoles: ['DAF', 'MANAGER'] },
  { name: 'Fournisseurs', href: '/dashboard/suppliers', icon: Truck, estRoles: ['DAF'] },
  { name: 'Ménage', href: '/dashboard/cleaning', icon: SprayCan, estRoles: ['DAF', 'MANAGER', 'CLEANER'] },
  { name: 'Approbations', href: '/dashboard/approvals', icon: ClipboardCheck, estRoles: ['DAF'] },
  { name: 'Utilisateurs', href: '/dashboard/users', icon: Users, estRoles: ['DAF', 'MANAGER'] },
  { name: 'Rapports', href: '/dashboard/reports', icon: BarChart3, estRoles: ['DAF'] },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings, superadminOnly: true },
];

const estRoleLabels: Record<EstablishmentRole, string> = {
  DAF: 'DAF',
  MANAGER: 'Manager',
  SERVER: 'Serveur',
  POS: 'Point de vente',
  COOK: 'Cuisinier',
  CLEANER: 'Ménage',
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, currentEstablishmentId, currentEstablishmentRole, selectEstablishment } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [estDropdownOpen, setEstDropdownOpen] = useState(false);

  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const filteredNav = navigation.filter((item) => {
    if (!user) return false;
    // SUPERADMIN sees everything
    if (isSuperAdmin) return true;
    // superadminOnly items are hidden for non-SUPERADMIN
    if (item.superadminOnly) return false;
    // Check establishment role
    if (item.estRoles && currentEstablishmentRole) {
      return item.estRoles.includes(currentEstablishmentRole);
    }
    return false;
  });

  const handleLogout = async () => {
    try {
      const { api } = await import('@/lib/api');
      await api.post('/auth/logout');
    } catch {}
    logout();
    window.location.href = '/auth/login';
  };

  const currentEstName = user?.memberships?.find(
    (m) => m.establishmentId === currentEstablishmentId
  )?.establishmentName;

  const displayRole = isSuperAdmin
    ? 'Super Admin'
    : currentEstablishmentRole
      ? estRoleLabels[currentEstablishmentRole]
      : 'Employé';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
              H
            </div>
            <span className="font-semibold text-gray-900">Hotel PMS</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Establishment selector (non-SUPERADMIN with multiple memberships) */}
      {!collapsed && !isSuperAdmin && user?.memberships && user.memberships.length > 1 && (
        <div className="relative border-b border-gray-100 px-3 py-2">
          <button
            onClick={() => setEstDropdownOpen(!estDropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <span className="truncate font-medium">{currentEstName || 'Sélectionner'}</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', estDropdownOpen && 'rotate-180')} />
          </button>
          {estDropdownOpen && (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
              {user.memberships.map((m) => (
                <button
                  key={m.establishmentId}
                  onClick={() => {
                    selectEstablishment(m.establishmentId);
                    setEstDropdownOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50',
                    m.establishmentId === currentEstablishmentId && 'bg-primary-50 text-primary-700'
                  )}
                >
                  <span className="truncate">{m.establishmentName}</span>
                  <span className="text-xs text-gray-400">{estRoleLabels[m.role]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500')} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed && user && (
          <div className="mb-2 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500">{displayRole}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          title="Déconnexion"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
