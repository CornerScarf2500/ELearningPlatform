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
  logoUrl?: string;
}

/* ── Lesson ───────────────────────────────────────────────── */
export interface Lesson {
  _id: string;
  title: string;
  videoUrl: string;
  fileUrl: string;
  fileUrls?: string[];   // multiple material files (PDFs, docs, etc.)
  sectionId: string;
  order: number;
  type: "video" | "pdf";
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
  grade?: string;
  platformId: Platform | string;
  importedFilename?: string;
  createdAt?: string;
  sections?: Section[];
  unsectioned?: Lesson[];   // flat lessons with no section (from import)
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
