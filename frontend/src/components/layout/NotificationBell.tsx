'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

const typeIcons: Record<string, string> = {
  ROOM_CHECKOUT: '🛏️',
  CLEANING_DONE: '✨',
  ORDER_NEW: '🍽️',
  ORDER_READY: '✅',
  APPROVAL_NEEDED: '📋',
  APPROVAL_RESULT: '📝',
  STOCK_ALERT: '⚠️',
  CHANNEL_SYNC: '🔄',
};

/**
 * Map notification type to the dashboard page that handles it.
 */
function getNotificationRoute(n: Notification): string {
  switch (n.type) {
    case 'ROOM_CHECKOUT':
      return `/dashboard/cleaning${n.data?.roomId ? `?roomId=${n.data.roomId}` : ''}`;
    case 'CLEANING_DONE':
      return '/dashboard/cleaning';
    case 'ORDER_NEW':
      return '/dashboard/kitchen';
    case 'ORDER_READY':
      return '/dashboard/orders';
    case 'APPROVAL_NEEDED':
    case 'APPROVAL_RESULT':
      return '/dashboard/approvals';
    case 'STOCK_ALERT':
      return '/dashboard/stock-alerts';
    case 'CHANNEL_SYNC':
      return '/dashboard/channels';
    default:
      return '/dashboard';
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<any>('/notifications?limit=20'),
    refetchInterval: 30000, // Poll every 30s as fallback
  });

  const notifications: Notification[] = data?.data || [];
  const unreadCount: number = data?.unreadCount || 0;

  // SSE connection for real-time updates
  useEffect(() => {
    if (!accessToken) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const eventSource = new EventSource(`${apiUrl}/api/notifications/stream`, {
      // Note: EventSource doesn't support custom headers natively.
      // We'll rely on polling as primary + SSE as bonus when auth cookies work
    });

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== 'connected') {
          // Refetch notifications when we get a new one
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      } catch {}
    };

    eventSource.onerror = () => {
      // SSE failed — polling is still active as fallback
      eventSource.close();
    };

    return () => eventSource.close();
  }, [accessToken, queryClient]);

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => apiPost('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Handle notification click: mark as read + navigate to relevant page
  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    const route = getNotificationRoute(n);
    setOpen(false);
    router.push(route);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative',
          open
            ? 'bg-accent-500/15 text-accent-500'
            : 'text-wood-400 hover:bg-wood-700 hover:text-wood-100'
        )}
        title="Notifications"
      >
        <Bell className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span>Notifications</span>}
        {unreadCount > 0 && (
          <span className="absolute top-1 left-6 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && !collapsed && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-wood-600 bg-wood-700 shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-wood-600 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-wood-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-400"
              >
                <CheckCheck className="h-3 w-3" /> Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-wood-400">
                Aucune notification
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-wood-600/50',
                    !n.isRead && 'bg-accent-500/5'
                  )}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {typeIcons[n.type] || '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm truncate', n.isRead ? 'text-wood-300' : 'text-wood-100 font-medium')}>
                        {n.title}
                      </p>
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-accent-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-wood-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-wood-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
