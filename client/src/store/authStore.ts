import { create } from "zustand";
import Cookies from "js-cookie";
import CryptoJS from "crypto-js";
import type { User } from "../types";
import { authApi, favoriteApi } from "../api";

const COOKIE_KEY = "el_token";
const ENC_SECRET = import.meta.env.VITE_ENC_SECRET || "el_platform_secret_2024";
const COOKIE_EXPIRES = 30; // days

function encryptToken(token: string): string {
  return CryptoJS.AES.encrypt(token, ENC_SECRET).toString();
}

function decryptToken(cipher: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, ENC_SECRET);
    const plain = bytes.toString(CryptoJS.enc.Utf8);
    return plain || null;
  } catch {
    return null;
  }
}

function saveToken(token: string) {
  const encrypted = encryptToken(token);
  Cookies.set(COOKIE_KEY, encrypted, { expires: COOKIE_EXPIRES, sameSite: "Lax" });
  // Keep localStorage in sync as fallback for the API interceptor
  localStorage.setItem("token", token);
}

function clearToken() {
  Cookies.remove(COOKIE_KEY);
  localStorage.removeItem("token");
}

function readToken(): string | null {
  const encrypted = Cookies.get(COOKIE_KEY);
  if (encrypted) {
    const plain = decryptToken(encrypted);
    if (plain) {
      // Sync localStorage for the Axios interceptor
      localStorage.setItem("token", plain);
      return plain;
    }
  }
  // Fallback to localStorage (legacy sessions)
  return localStorage.getItem("token");
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;

  login: (accessCode: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  hydrate: () => void;

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
      saveToken(data.token);
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
      get().fetchMe();
    }
  },

  /* ── Logout ──────────────────────────────────────────────── */
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clearToken();
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
      clearToken();
      set({ token: null, user: null, isAdmin: false, loading: false });
    }
  },

  /* ── Hydrate from cookie/localStorage on app boot ─────────── */
  hydrate: () => {
    const token = readToken();
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
