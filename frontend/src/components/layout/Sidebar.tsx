'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/hooks/useAuthStore';
import {
  LayoutDashboard, BedDouble, CalendarCheck, Receipt, CreditCard,
  Package, Truck, Users, Building2, Settings, LogOut, ChevronLeft,
  BarChart3, AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { name: 'Établissements', href: '/dashboard/establishments', icon: Building2, roles: ['SUPERADMIN', 'ADMIN'] },
  { name: 'Chambres', href: '/dashboard/rooms', icon: BedDouble, roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { name: 'Réservations', href: '/dashboard/reservations', icon: CalendarCheck, roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { name: 'Factures', href: '/dashboard/invoices', icon: Receipt, roles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] },
  { name: 'Paiements', href: '/dashboard/payments', icon: CreditCard, roles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] },
  { name: 'Stock & Inventaire', href: '/dashboard/stock', icon: Package, roles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] },
  { name: 'Fournisseurs', href: '/dashboard/suppliers', icon: Truck, roles: ['SUPERADMIN', 'ADMIN'] },
  { name: 'Utilisateurs', href: '/dashboard/users', icon: Users, roles: ['SUPERADMIN', 'ADMIN', 'MANAGER'] },
  { name: 'Rapports', href: '/dashboard/reports', icon: BarChart3, roles: ['SUPERADMIN', 'ADMIN'] },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings, roles: ['SUPERADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = navigation.filter(
    (item) => user?.role && item.roles.includes(user.role)
  );

  const handleLogout = async () => {
    try {
      const { api } = await import('@/lib/api');
      await api.post('/auth/logout');
    } catch {}
    logout();
    window.location.href = '/auth/login';
  };

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
            <p className="text-xs text-gray-500">{{ SUPERADMIN: 'Super Admin', ADMIN: 'Admin Établissement', MANAGER: 'Manager', EMPLOYEE: 'Employé' }[user.role]}</p>
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
