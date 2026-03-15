import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import type {
  PaginatedResponse, Room, Reservation, Invoice, Article,
  Supplier, StockMovement, User, Establishment, ArticleCategory,
} from '@/types';

// =============================================================================
// Generic hook factories
// =============================================================================

type QueryParams = Record<string, string | number | boolean | undefined>;

function useResourceList<T>(key: string, url: string, params?: QueryParams) {
  return useQuery({
    queryKey: [key, params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== '') searchParams.set(k, String(v));
        });
      }
      const queryString = searchParams.toString();
      return apiGet<PaginatedResponse<T>>(`${url}${queryString ? '?' + queryString : ''}`);
    },
  });
}

function useResourceById<T>(key: string, url: string, id?: string) {
  return useQuery({
    queryKey: [key, id],
    queryFn: () => apiGet<{ success: boolean; data: T }>(`${url}/${id}`),
    enabled: !!id,
  });
}

// =============================================================================
// Rooms
// =============================================================================

export function useRooms(params?: QueryParams) {
  return useResourceList<Room>('rooms', '/rooms', params);
}

export function useRoom(id?: string) {
  return useResourceById<Room>('room', '/rooms', id);
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/rooms', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiPatch(`/rooms/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/rooms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  });
}

// =============================================================================
// Reservations
// =============================================================================

export function useReservations(params?: QueryParams) {
  return useResourceList<Reservation>('reservations', '/reservations', params);
}

export function useReservation(id?: string) {
  return useResourceById<Reservation>('reservation', '/reservations', id);
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/reservations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

export function useReservationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'check-in' | 'check-out' | 'cancel' }) =>
      apiPost(`/reservations/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

// =============================================================================
// Invoices
// =============================================================================

export function useInvoices(params?: QueryParams) {
  return useResourceList<Invoice>('invoices', '/invoices', params);
}

export function useInvoice(id?: string) {
  return useResourceById<Invoice>('invoice', '/invoices', id);
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/invoices', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/invoices/${id}/issue`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

// =============================================================================
// Payments
// =============================================================================

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/payments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// =============================================================================
// Articles & Stock
// =============================================================================

export function useArticles(params?: QueryParams) {
  return useResourceList<Article>('articles', '/articles', params);
}

export function useLowStockArticles() {
  return useQuery({
    queryKey: ['low-stock'],
    queryFn: () => apiGet<any>('/articles/low-stock'),
  });
}

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/articles', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
}

export function useStockMovements(params?: QueryParams) {
  return useResourceList<StockMovement>('stock-movements', '/stock-movements', params);
}

export function useCreateStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/stock-movements', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useApproveStockMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/stock-movements/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

// =============================================================================
// Categories
// =============================================================================

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<{ success: boolean; data: ArticleCategory[] }>('/categories'),
  });
}

// =============================================================================
// Suppliers
// =============================================================================

export function useSuppliers(params?: QueryParams) {
  return useResourceList<Supplier>('suppliers', '/suppliers', params);
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/suppliers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

// =============================================================================
// Users
// =============================================================================

export function useUsers(params?: QueryParams) {
  return useResourceList<User>('users', '/users', params);
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// =============================================================================
// Establishments
// =============================================================================

export function useEstablishments(params?: QueryParams) {
  return useResourceList<Establishment>('establishments', '/establishments', params);
}

export function useCreateEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiPost('/establishments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['establishments'] }),
  });
}
