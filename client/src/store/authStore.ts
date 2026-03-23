import { create } from "zustand";
import type { User } from "../types";
import { authApi, favoriteApi } from "../api";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;

  login: (accessCode: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  hydrate: () => void;

  /* favourites helpers (kept in auth store so user obj stays in sync) */
  toggleFavoriteCourse: (courseId: string) => Promise<void>;
  toggleFavoriteLesson: (lessonId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loading: true,
  isAdmin: false,

  /* ── Login ───────────────────────────────────────────────── */
  login: async (accessCode) => {
    const { data } = await authApi.login(accessCode);
    if (data.token && data.user) {
      localStorage.setItem("token", data.token);
      set({
        token: data.token,
        user: {
          id: data.user.id,
          role: data.user.role,
          favoriteCourses: [],
          favoriteLessons: [],
        },
        isAdmin: data.user.role === "admin",
        loading: false,
      });
      // Fetch full profile in background
      get().fetchMe();
    }
  },

  /* ── Logout ──────────────────────────────────────────────── */
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore — token might already be invalid */
    }
    localStorage.removeItem("token");
    set({ token: null, user: null, isAdmin: false, loading: false });
  },

  /* ── Fetch current user profile ──────────────────────────── */
  fetchMe: async () => {
    try {
      const { data } = await authApi.me();
      if (data.user) {
        set({
          user: data.user,
          isAdmin: data.user.role === "admin",
          loading: false,
        });
      }
    } catch {
      localStorage.removeItem("token");
      set({ token: null, user: null, isAdmin: false, loading: false });
    }
  },

  /* ── Hydrate from localStorage on app boot ──────────────── */
  hydrate: () => {
    const token = localStorage.getItem("token");
    if (token) {
      set({ token, loading: true });
      get().fetchMe();
    } else {
      set({ loading: false });
    }
  },

  /* ── Toggle favourite course ─────────────────────────────── */
  toggleFavoriteCourse: async (courseId) => {
    const { data } = await favoriteApi.toggleCourse(courseId);
    if (data.favoriteCourses) {
      set((s) => ({
        user: s.user ? { ...s.user, favoriteCourses: data.favoriteCourses } : null,
      }));
    }
  },

  /* ── Toggle favourite lesson ─────────────────────────────── */
  toggleFavoriteLesson: async (lessonId) => {
    const { data } = await favoriteApi.toggleLesson(lessonId);
    if (data.favoriteLessons) {
      set((s) => ({
        user: s.user ? { ...s.user, favoriteLessons: data.favoriteLessons } : null,
      }));
    }
  },
}));
