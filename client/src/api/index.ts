import axios from "axios";
import type {
  ApiResponse,
  Course,
  Section,
  Lesson,
  Platform,
  SearchResults,
  FavoriteData,
  User,
} from "../types";

/* ── Axios instance ──────────────────────────────────────── */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 clear the stored token so the UI redirects to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/* ── Auth ─────────────────────────────────────────────────── */
export const authApi = {
  login: (accessCode: string) =>
    api.post<ApiResponse>("/auth/login", { accessCode }),
  logout: () => api.post<ApiResponse>("/auth/logout"),
  me: () => api.get<ApiResponse<never> & { user: User }>("/auth/me"),
};

/* ── Courses ──────────────────────────────────────────────── */
export const courseApi = {
  list: () => api.get<ApiResponse<Course[]>>("/courses"),
  listPlatformCourses: (platformId: string) =>
    api.get<ApiResponse<Course[]>>(`/platforms/${platformId}/courses`),
  get: (id: string) =>
    api.get<ApiResponse<Course & { sections: Section[] }>>(`/courses/${id}`),

  // Admin routes
  create: (data: Partial<Course>) => api.post<ApiResponse<Course>>("/courses", data),
  import: (data: any) => api.post<ApiResponse<Course>>("/courses/import", data),
  update: (id: string, data: Partial<Course>) =>
    api.put<ApiResponse<Course>>(`/courses/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/courses/${id}`),
  bulkSetPlatform: (courseIds: string[], platformName: string, platformLogoUrl?: string) =>
    api.put<ApiResponse>("/courses/bulk-platform", { courseIds, platformName, platformLogoUrl }),
};

/* ── Sections ─────────────────────────────────────────────── */
export const sectionApi = {
  create: (data: { title: string; courseId: string; order?: number }) =>
    api.post<ApiResponse<Section>>("/sections", data),
  update: (id: string, data: Partial<Section>) =>
    api.put<ApiResponse<Section>>(`/sections/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/sections/${id}`),
  reorder: (orderedIds: string[]) =>
    api.put<ApiResponse>("/sections/reorder", { orderedIds }),
};

/* ── Lessons ──────────────────────────────────────────────── */
export const lessonApi = {
  create: (data: Partial<Lesson> & { courseId: string; sectionId?: string | null }) =>
    api.post<ApiResponse<Lesson>>("/lessons", data),
  update: (id: string, data: Partial<Lesson>) =>
    api.put<ApiResponse<Lesson>>(`/lessons/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/lessons/${id}`),
  reorder: (orderedIds: string[], sectionIds?: (string | null)[]) =>
    api.put<ApiResponse>("/lessons/reorder", { orderedIds, sectionIds }),
};

/* ── Platforms ────────────────────────────────────────────── */
export const platformApi = {
  list: () => api.get<ApiResponse<Platform[]>>("/platforms"),
  create: (data: { name: string; logoUrl?: string }) =>
    api.post<ApiResponse<Platform>>("/platforms", data),
  update: (id: string, data: { name: string; logoUrl?: string }) =>
    api.put<ApiResponse<Platform>>(`/platforms/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/platforms/${id}`),
};

/* ── Favorites ────────────────────────────────────────────── */
export const favoriteApi = {
  list: () => api.get<ApiResponse<FavoriteData>>("/favorites"),
  toggleCourse: (id: string) =>
    api.post<ApiResponse & { favoriteCourses: string[] }>(
      `/favorites/course/${id}`
    ),
  toggleLesson: (id: string) =>
    api.post<ApiResponse & { favoriteLessons: string[] }>(
      `/favorites/lesson/${id}`
    ),
};

/* ── Search ───────────────────────────────────────────────── */
export const searchApi = {
  query: (q: string) => api.get<ApiResponse<SearchResults>>(`/search?q=${encodeURIComponent(q)}`),
};

/* ── Users (admin) ────────────────────────────────────────── */
export const userApi = {
  list: () => api.get<ApiResponse<import("../types").AdminUser[]>>("/users"),
  create: (data: { name: string; accessCode: string; role: "admin" | "user" }) =>
    api.post<ApiResponse<{ id: string; name: string; role: string; isBanned: boolean; activeSessions: number; createdAt: string }>>("/users", data),
  revokeSessions: (id: string) =>
    api.delete<ApiResponse>(`/users/${id}/sessions`),
  revokeSession: (id: string, sessionId: string) =>
    api.delete<ApiResponse>(`/users/${id}/sessions/${sessionId}`),
  toggleBan: (id: string) => api.post<ApiResponse>(`/users/${id}/ban`),
  deleteUser: (id: string) => api.delete<ApiResponse>(`/users/${id}`),
  update: (id: string, data: { name?: string; role?: "admin" | "user"; isCoursesRestricted?: boolean; allowedCourses?: string[]; accessCode?: string }) =>
    api.put<ApiResponse>(`/users/${id}`, data),
};

/* ── Admin ────────────────────────────────────────────────── */
export const adminApi = {
  importZip: (file: File) => {
    return api.post<ApiResponse & { imported?: any; skipped?: any; errors?: string[] }>(
      "/admin/import-zip",
      file,
      { headers: { "Content-Type": "application/octet-stream" } }
    );
  },
};

export default api;
