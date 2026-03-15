import { create } from 'zustand';
import { AuthUser } from '@/types';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (token: string, user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (token, user) =>
    set({ accessToken: token, user, isAuthenticated: true, isLoading: false }),

  setAccessToken: (token) =>
    set({ accessToken: token }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  logout: () =>
    set({ accessToken: null, user: null, isAuthenticated: false, isLoading: false }),
}));
