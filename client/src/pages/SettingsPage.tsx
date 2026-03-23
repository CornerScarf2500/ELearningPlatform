import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Trash2, HardDrive, Users } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useAdmin } from "../hooks/useAdmin";
import { useAuthStore } from "../store/authStore";
import { userApi } from "../api";

interface AdminUser {
  id: string;
  role: string;
  activeSessions: number;
  createdAt: string;
}

export const SettingsPage = () => {
  const isAdmin = useAdmin();
  const logout = useAuthStore((s) => s.logout);

  /* ── Offline storage ──────────────────────────────── */
  const [cacheSize, setCacheSize] = useState<string>("Calculating…");

  const estimateStorage = useCallback(async () => {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const est = await navigator.storage.estimate();
      const usedMB = ((est.usage || 0) / 1024 / 1024).toFixed(1);
      setCacheSize(`${usedMB} MB used`);
    } else {
      setCacheSize("Not available");
    }
  }, []);

  const clearCache = async () => {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      estimateStorage();
    }
  };

  useEffect(() => {
    estimateStorage();
  }, [estimateStorage]);

  /* ── Admin: user management ───────────────────────── */
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const { data } = await userApi.list();
      setUsers(data.data || []);
    } catch {
      /* handle */
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const revokeSessions = async (userId: string) => {
    if (!confirm("Revoke all sessions for this user?")) return;
    await userApi.revokeSessions(userId);
    fetchUsers();
  };

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        Settings
      </h1>

      <div className="space-y-8">
        {/* ── Appearance ──────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
            Appearance
          </h2>
          <div className="p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 w-fit">
            <ThemeToggle />
          </div>
        </section>

        {/* ── Offline / Cache ─────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
            Offline Storage
          </h2>
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Cache Storage
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {cacheSize}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={clearCache}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Clear All Cached Data
            </motion.button>
          </div>
        </section>

        {/* ── Admin: User Management ──────────────────── */}
        {isAdmin && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              User Management
            </h2>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-zinc-400">No users found.</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {u.id.slice(-8)}
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                          {u.role}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {u.activeSessions} active session
                        {u.activeSessions !== 1 && "s"}
                      </p>
                    </div>

                    {u.activeSessions > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => revokeSessions(u.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke
                      </motion.button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Logout ──────────────────────────────────── */}
        <section>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={logout}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            Log Out
          </motion.button>
        </section>
      </div>
    </PageTransition>
  );
};
