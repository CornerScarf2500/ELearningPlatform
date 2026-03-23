import { useAuthStore } from "../store/authStore";

/** Returns `true` when the logged-in user has admin role. */
export const useAdmin = (): boolean => useAuthStore((s) => s.isAdmin);
