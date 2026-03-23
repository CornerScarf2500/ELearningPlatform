import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Trash2,
  HardDrive,
  Users,
  Shield,
  ShieldAlert,
  Smartphone,
  LogOut,
} from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useAdmin } from "../hooks/useAdmin";
import { useAuthStore } from "../store/authStore";
import { userApi } from "../api";
import type { AdminUser } from "../types";

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

  const revokeSingleSession = async (userId: string, sessionId: string) => {
    if (!confirm("Revoke this specific device?")) return;
    await userApi.revokeSession(userId, sessionId);
    fetchUsers();
  };

  const toggleBan = async (userId: string) => {
    if (!confirm("Are you sure you want to toggle ban status for this user?")) return;
    await userApi.toggleBan(userId);
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
                    className={`flex flex-col gap-3 px-4 py-3 rounded-xl border bg-white dark:bg-zinc-900 transition-colors ${
                      u.isBanned
                        ? "border-red-200 dark:border-red-900/30 opacity-75 grayscale"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {u.name || "User"} ({u.id.slice(-6)})
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            {u.role}
                          </span>
                          {u.isBanned && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">
                              BANNED
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {u.activeSessions} active session
                          {u.activeSessions !== 1 && "s"} 
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {u.role !== "admin" && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleBan(u.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              u.isBanned
                                ? "border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                : "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                            }`}
                          >
                            {u.isBanned ? (
                              <>
                                <Shield className="w-3.5 h-3.5" /> Unban
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5" /> Ban
                              </>
                            )}
                          </motion.button>
                        )}
                        {u.activeSessions > 0 && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => revokeSessions(u.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Revoke All
                          </motion.button>
                        )}
                      </div>
                    </div>

                    {/* Active Sessions List */}
                    {u.sessions && u.sessions.length > 0 && (
                      <div className="mt-2 pl-2 border-l-2 border-zinc-100 dark:border-zinc-800 space-y-2">
                        {u.sessions.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Smartphone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <div className="truncate text-[11px]">
                                <p className="text-zinc-700 dark:text-zinc-300 truncate max-w-[200px] md:max-w-xs" title={s.device}>
                                  {s.device}
                                </p>
                                <p className="text-zinc-500 dark:text-zinc-500">
                                  {new Date(s.loginAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => revokeSingleSession(u.id, s.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Revoke this device"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        ))}
                      </div>
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
