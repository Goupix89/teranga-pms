'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { OfflineBadge } from '@/components/layout/OfflineBadge';
import { ServiceWorkerRegistrar } from '@/components/layout/ServiceWorkerRegistrar';
import { TogoIndependenceBanner } from '@/components/layout/TogoIndependenceBanner';
import { LabourDayBanner } from '@/components/layout/LabourDayBanner';
import { LoadingPage } from '@/components/ui';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, setLoading, setAuth, logout } = useAuthStore();

  // Try to restore session from refresh token on mount
  useEffect(() => {
    const tryRestore = async () => {
      if (isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const { api } = await import('@/lib/api');
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await api.post('/auth/refresh', { refreshToken });
        const { data: meData } = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${data.data.accessToken}` },
        });
        setAuth(data.data.accessToken, data.data.refreshToken, meData.data);
      } catch {
        logout();
        router.replace('/auth/login');
      }
    };

    tryRestore();
  }, []);

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return null; // Redirecting...
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <OfflineBadge />
      <ServiceWorkerRegistrar />
      <div className="ml-64 flex flex-1 flex-col">
        <TogoIndependenceBanner />
        <LabourDayBanner />
        <main className="flex-1 bg-wood-50 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
