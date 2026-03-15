'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Sidebar } from '@/components/layout/Sidebar';
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
        const { data } = await api.post('/auth/refresh');
        const { data: meData } = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${data.data.accessToken}` },
        });
        setAuth(data.data.accessToken, meData.data);
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
      <main className="ml-64 flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
