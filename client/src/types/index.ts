/* ── Role ─────────────────────────────────────────────────── */
export type Role = "user" | "admin";

/* ── User ─────────────────────────────────────────────────── */
export interface User {
  id: string;
  role: Role;
  favoriteCourses: string[];
  favoriteLessons: string[];
  createdAt?: string;
}

/* ── Platform ─────────────────────────────────────────────── */
export interface Platform {
  _id: string;
  name: string;
}

/* ── Lesson ───────────────────────────────────────────────── */
export interface Lesson {
  _id: string;
  title: string;
  videoUrl: string;
  fileUrl: string;
  sectionId: string;
  order: number;
  type: "video" | "pdf";
  /* populated context (from search/favorites) */
  _type?: "lesson";
}

/* ── Section ──────────────────────────────────────────────── */
export interface Section {
  _id: string;
  title: string;
  courseId: string;
  order: number;
  lessons: Lesson[];
}

/* ── Course ───────────────────────────────────────────────── */
export interface Course {
  _id: string;
  title: string;
  subject: string;
  teacher: string;
  platformId: Platform | string;
  createdAt?: string;
  sections?: Section[];
  _type?: "course";
}

/* ── Search result ────────────────────────────────────────── */
export interface SearchResults {
  courses: (Course & { _type: "course" })[];
  lessons: (Lesson & {
    _type: "lesson";
    sectionId: {
      title: string;
      courseId: { _id: string; title: string };
    };
  })[];
}

/* ── Favorites ─────────────────────────────────────────────── */
export interface FavoriteData {
  courses: Course[];
  lessons: (Lesson & {
    sectionId: {
      _id: string;
      title: string;
      courseId: { _id: string; title: string };
    };
  })[];
}

/* ── API response wrapper ─────────────────────────────────── */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  token?: string;
  user?: { id: string; role: Role };
  action?: "added" | "removed";
}

/* ── Admin Users ──────────────────────────────────────────── */
export interface SessionInfo {
  id: string;
  device: string;
  loginAt: string;
}

export interface AdminUser {
  id: string;
  name?: string;
  role: string;
  isBanned: boolean;
  activeSessions: number;
  sessions: SessionInfo[];
  createdAt: string;
}
