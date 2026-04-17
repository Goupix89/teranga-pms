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
  ChevronDown, UserCircle, Globe2, KeyRound, Crown, ShoppingCart, Armchair,
  UserRound, Percent,
} from 'lucide-react';
import { useState } from 'react';
import { NotificationBell } from './NotificationBell';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  superadminOnly?: boolean;
  estRoles?: EstablishmentRole[];
};

const navigation: NavItem[] = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, estRoles: ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS', 'COOK', 'CLEANER'] },
  { name: 'Établissements', href: '/dashboard/establishments', icon: Building2, estRoles: ['OWNER'] },
  { name: 'Chambres', href: '/dashboard/rooms', icon: BedDouble, estRoles: ['OWNER', 'DAF', 'MANAGER', 'CLEANER'] },
  { name: 'Réservations', href: '/dashboard/reservations', icon: CalendarCheck, estRoles: ['OWNER', 'DAF', 'MANAGER'] },
  { name: 'Clients', href: '/dashboard/clients', icon: UserRound, estRoles: ['OWNER', 'DAF', 'MANAGER'] },
  { name: 'Remises', href: '/dashboard/discounts', icon: Percent, estRoles: ['OWNER', 'DAF', 'MANAGER'] },
  { name: 'Canaux', href: '/dashboard/channels', icon: Globe2, estRoles: ['OWNER', 'DAF', 'MANAGER'] },
  { name: 'Point de Vente', href: '/dashboard/pos', icon: ShoppingCart, estRoles: ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS'] },
  { name: 'Commandes', href: '/dashboard/orders', icon: UtensilsCrossed, estRoles: ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS'] },
  { name: 'Tables', href: '/dashboard/tables', icon: Armchair, estRoles: ['OWNER', 'DAF', 'MANAGER'] },
  { name: 'Cuisine', href: '/dashboard/kitchen', icon: UtensilsCrossed, estRoles: ['OWNER', 'DAF', 'MANAGER', 'COOK'] },
  { name: 'Factures', href: '/dashboard/invoices', icon: Receipt, estRoles: ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS'] },
  { name: 'Paiements', href: '/dashboard/payments', icon: CreditCard, estRoles: ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS'] },
  { name: 'Menu & Articles', href: '/dashboard/stock', icon: Package, estRoles: ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'POS'] },
  { name: 'Alertes Stock', href: '/dashboard/stock-alerts', icon: AlertTriangle, estRoles: ['OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL'] },
  { name: 'Fournisseurs', href: '/dashboard/suppliers', icon: Truck, estRoles: ['OWNER', 'DAF'] },
  { name: 'Ménage', href: '/dashboard/cleaning', icon: SprayCan, estRoles: ['OWNER', 'DAF', 'MANAGER', 'CLEANER'] },
  { name: 'Approbations', href: '/dashboard/approvals', icon: ClipboardCheck, estRoles: ['OWNER', 'DAF'] },
  { name: 'Utilisateurs', href: '/dashboard/users', icon: Users, estRoles: ['OWNER', 'DAF', 'MANAGER'] },
  { name: 'Rapports', href: '/dashboard/reports', icon: BarChart3, estRoles: ['OWNER', 'DAF', 'MANAGER'] },
  { name: 'Clés API', href: '/dashboard/api-keys', icon: KeyRound, estRoles: ['OWNER', 'DAF'] },
  { name: 'Abonnement', href: '/dashboard/subscription', icon: Crown, estRoles: ['OWNER', 'DAF'] },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings, estRoles: ['OWNER'] },
];

const estRoleLabels: Record<EstablishmentRole, string> = {
  OWNER: 'Propriétaire',
  DAF: 'DAF',
  MANAGER: 'Manager',
  MAITRE_HOTEL: 'Maître d\'hôtel',
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
    if (isSuperAdmin) return true;
    if (item.superadminOnly) return false;
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
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-wood-800 transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo — Gold accent on dark wood */}
      <div className="flex h-16 items-center justify-between border-b border-wood-700 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/20 text-accent-500 font-bold text-sm">
              T
            </div>
            <span className="font-display font-bold text-accent-500 tracking-wide">TERANGA</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-wood-500 hover:bg-wood-700 hover:text-accent-500 transition-colors"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Establishment selector */}
      {!collapsed && !isSuperAdmin && user?.memberships && user.memberships.length > 1 && (
        <div className="relative border-b border-wood-700 px-3 py-2">
          <button
            onClick={() => setEstDropdownOpen(!estDropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg bg-wood-700/50 px-3 py-2 text-sm text-wood-200 hover:bg-wood-700"
          >
            <span className="truncate font-medium">{currentEstName || 'Sélectionner'}</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform text-accent-500', estDropdownOpen && 'rotate-180')} />
          </button>
          {estDropdownOpen && (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-lg border border-wood-600 bg-wood-700 shadow-lg overflow-hidden">
              {user.memberships.map((m) => (
                <button
                  key={m.establishmentId}
                  onClick={() => {
                    selectEstablishment(m.establishmentId);
                    setEstDropdownOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-wood-600 transition-colors',
                    m.establishmentId === currentEstablishmentId
                      ? 'bg-accent-500/10 text-accent-500'
                      : 'text-wood-200'
                  )}
                >
                  <span className="truncate">{m.establishmentName}</span>
                  <span className="text-xs text-wood-400">{estRoleLabels[m.role]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-accent-500/15 text-accent-500'
                  : 'text-wood-400 hover:bg-wood-700 hover:text-wood-100'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={cn(
                'h-5 w-5 flex-shrink-0 transition-colors',
                isActive ? 'text-accent-500' : 'text-wood-500 group-hover:text-wood-300'
              )} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Decorative Kuba divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-accent-500/30 to-transparent" />

      {/* User section */}
      <div className="p-3">
        {!collapsed && user && (
          <div className="mb-2 rounded-lg bg-wood-700/50 px-3 py-2">
            <p className="text-sm font-medium text-wood-100 truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-accent-500/80">{displayRole}</p>
          </div>
        )}
        <NotificationBell collapsed={collapsed} />
        <Link
          href="/dashboard/profile"
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/dashboard/profile'
              ? 'bg-accent-500/15 text-accent-500'
              : 'text-wood-400 hover:bg-wood-700 hover:text-wood-100'
          )}
          title="Mon profil"
        >
          <UserCircle className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Mon profil</span>}
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-wood-400 hover:bg-primary-500/15 hover:text-primary-300 transition-colors"
          title="Déconnexion"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
