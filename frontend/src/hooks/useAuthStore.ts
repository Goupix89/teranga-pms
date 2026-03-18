import { create } from 'zustand';
import { AuthUser, EstablishmentRole } from '@/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentEstablishmentId: string | null;
  currentEstablishmentRole: EstablishmentRole | null;

  setAuth: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  setLoading: (loading: boolean) => void;
  selectEstablishment: (establishmentId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  currentEstablishmentId: null,
  currentEstablishmentRole: null,

  setAuth: (accessToken, refreshToken, user) => {
    const firstMembership = user.memberships?.[0];
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      isLoading: false,
      currentEstablishmentId: firstMembership?.establishmentId ?? null,
      currentEstablishmentRole: firstMembership?.role ?? null,
    });
  },

  setAccessToken: (token) =>
    set({ accessToken: token }),

  setUser: (user) =>
    set({ user }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  selectEstablishment: (establishmentId) => {
    const { user } = get();
    const membership = user?.memberships?.find((m) => m.establishmentId === establishmentId);
    set({
      currentEstablishmentId: establishmentId,
      currentEstablishmentRole: membership?.role ?? null,
    });
  },

  logout: () =>
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      currentEstablishmentId: null,
      currentEstablishmentRole: null,
    }),
}));
