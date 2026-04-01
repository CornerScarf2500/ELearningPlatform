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
  Plus,
  UserX,
  Archive,
  Edit3,
  Database,
} from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useAdmin } from "../hooks/useAdmin";
import { useAuthStore } from "../store/authStore";
import { userApi, courseApi } from "../api";
import type { AdminUser, Course } from "../types";


// ── Backup button (admin only) ────────────────────────────────
const BackupButton = () => {
  const token = useAuthStore((s) => s.token);
  const [downloading, setDownloading] = useState(false);

  const handleBackup = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      // Trigger native browser download using query token
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const url = `${baseUrl}/api/admin/backup?token=${encodeURIComponent(token)}`;
      window.location.href = url;
    } finally {
      // Small delay to simulate load for UI feedback
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleBackup}
      disabled={downloading}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors disabled:opacity-60"
    >
      {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
      {downloading ? "Creating backup…" : "Download Backup JSON"}
    </motion.button>
  );
};

// ── Storage Progress Bar ──────────────────────────────────────
const TOTAL_MB = 512;

const StorageProgressBar = ({ usedMB }: { usedMB: number }) => {
  const pct = Math.min(100, (usedMB / TOTAL_MB) * 100);
  const freeMB = Math.max(0, TOTAL_MB - usedMB);

  // Color gradient: green → yellow → red
  const getBarColor = (p: number) => {
    if (p < 50) return "from-emerald-500 to-emerald-400";
    if (p < 75) return "from-amber-500 to-yellow-400";
    return "from-red-500 to-red-400";
  };

  const getTextColor = (p: number) => {
    if (p < 50) return "text-emerald-600 dark:text-emerald-400";
    if (p < 75) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {usedMB.toFixed(2)} MB / {TOTAL_MB} MB
        </span>
        <span className={`text-xs font-bold tabular-nums ${getTextColor(pct)}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`absolute h-full rounded-full bg-gradient-to-r ${getBarColor(pct)} shadow-sm`}
        />
      </div>
      <p className="text-[11px] text-zinc-400">
        {freeMB.toFixed(2)} MB free
      </p>
    </div>
  );
};

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

  const [dbUsedMB, setDbUsedMB] = useState<number | null>(null);
  const [dbCollections, setDbCollections] = useState<number>(0);
  const [dbError, setDbError] = useState(false);

  const fetchDbStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const token = useAuthStore.getState().token;
      const baseUrl = import.meta.env.VITE_API_URL || "/api";
      const resp = await fetch(`${baseUrl}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        setDbError(true);
        return;
      }
      const data = await resp.json();
      if (data.success) {
        const bytes = data.usedBytes ?? 0;
        const mb = bytes / 1024 / 1024;
        setDbUsedMB(mb);
        setDbCollections(data.stats?.collections || 0);
        setDbError(false);
      } else {
        setDbError(true);
      }
    } catch {
      setDbError(true);
    }
  }, [isAdmin]);

  const clearCache = async () => {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      estimateStorage();
    }
  };

  useEffect(() => {
    estimateStorage();
    fetchDbStats();
  }, [estimateStorage, fetchDbStats]);

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

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserCode, setNewUserCode] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user");
  const [addingUser, setAddingUser] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    role: "admin" | "user";
    isCoursesRestricted: boolean;
    allowedCourses: string[];
    accessCode: string;
  }>({ name: "", role: "user", isCoursesRestricted: false, allowedCourses: [], accessCode: "" });
  const [updatingUser, setUpdatingUser] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await courseApi.list();
      setCourses(data.data || []);
    } catch {}
  }, [isAdmin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserCode.trim()) return;
    setAddingUser(true);
    try {
      await userApi.create({
        name: newUserName,
        accessCode: newUserCode,
        role: newUserRole,
      });
      setNewUserName("");
      setNewUserCode("");
      setShowAddUser(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create user");
    } finally {
      setAddingUser(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdatingUser(true);
    try {
      await userApi.update(editingUser.id, editForm);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update user");
    } finally {
      setUpdatingUser(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCourses();
  }, [fetchUsers, fetchCourses]);

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

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    try {
      await userApi.deleteUser(userId);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete user");
    }
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
                  Cache Storage (Local)
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
              className="mt-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Clear All Cached Data
            </motion.button>
          </div>
        </section>

        {/* ── Admin: Database Storage ─────────────────── */}
        {isAdmin && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database Storage (MongoDB)
            </h2>
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
              {dbError ? (
                <p className="text-sm text-zinc-400">Storage data unavailable</p>
              ) : dbUsedMB === null ? (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading storage data…</span>
                </div>
              ) : (
                <>
                  <StorageProgressBar usedMB={dbUsedMB} />
                  {dbCollections > 0 && (
                    <p className="text-[11px] text-zinc-400">
                      {dbCollections} collection{dbCollections !== 1 ? "s" : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* ── Admin: User Management ──────────────────── */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                User Management
              </h2>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddUser ? "Cancel" : "Add User"}
              </button>
            </div>

            {showAddUser && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreateUser}
                className="mb-4 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Name (Optional)"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <input
                    type="text"
                    placeholder="Access Code (Required)"
                    value={newUserCode}
                    onChange={(e) => setNewUserCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as "admin" | "user")}
                    className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="user">Student / User</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={addingUser || !newUserCode.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                  </motion.button>
                </div>
              </motion.form>
            )}

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

                      <div className="flex items-center gap-1.5">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setEditingUser(u);
                            setEditForm({
                              name: u.name || "",
                              role: u.role as "admin" | "user",
                              isCoursesRestricted: u.isCoursesRestricted ?? false,
                              allowedCourses: (u.allowedCourses || []).map(c => c._id || c),
                              accessCode: "",
                            });
                          }}
                          className="p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                          title="Edit User"
                        >
                          <Edit3 className="w-4 h-4" />
                        </motion.button>
                        {u.role !== "admin" && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleBan(u.id)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              u.isBanned
                                ? "border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                : "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                            }`}
                            title={u.isBanned ? "Unban User" : "Ban User"}
                          >
                            {u.isBanned ? <Shield className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          </motion.button>
                        )}
                        {u.activeSessions > 0 && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => revokeSessions(u.id)}
                            className="p-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                            title="Revoke Sessions"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        )}
                        {u.role !== "admin" && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDeleteUser(u.id, u.name || "User")}
                            className="p-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            title="Delete User"
                          >
                            <UserX className="w-4 h-4" />
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
                            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                              <Smartphone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <div className="truncate text-[11px] flex-1 min-w-0">
                                <p className="text-zinc-500 dark:text-zinc-500 truncate">
                                  {s.device || "Unknown Device"} &bull; Login: {new Date(s.loginAt).toLocaleString()}
                                </p>
                                {s.lastAccessedAt && (
                                  <p className="text-emerald-600 dark:text-emerald-500/80">
                                    Last Access: {new Date(s.lastAccessedAt).toLocaleString()}
                                  </p>
                                )}
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

        {/* ── Admin: Backup ──────────────────────────── */}
        {isAdmin && (
          <section>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center shrink-0">
                <Archive className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Backup</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Download all courses as a structured JSON file, grouped by platform.
                </p>
              </div>
            </div>
            <BackupButton />
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

      {/* Edit User Modal */}
      {isAdmin && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Edit User ({editingUser.id.slice(-6)})
              </h3>
            </div>
            <div className="p-5 overflow-y-auto min-h-0 flex-1 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Access Code
                </label>
                <input
                  type="text"
                  value={editForm.accessCode}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, accessCode: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Leave blank to keep unchanged"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as "admin" | "user" }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="user">Student / User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {editForm.role !== "admin" && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={editForm.isCoursesRestricted}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, isCoursesRestricted: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      Restrict Course Access
                    </span>
                  </label>

                  {editForm.isCoursesRestricted && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg p-3 max-h-64 overflow-y-auto space-y-4">
                      {Object.entries(
                        courses.reduce((acc, c) => {
                          const pName = (c as any).platformId?.name || (c as any).platformName || "Other / Unassigned";
                          if (!acc[pName]) acc[pName] = [];
                          acc[pName].push(c);
                          return acc;
                        }, {} as Record<string, Course[]>)
                      ).map(([platformName, platformCourses]) => (
                        <div key={platformName} className="space-y-2">
                          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{platformName}</p>
                          <div className="space-y-1">
                            {platformCourses.map((course) => {
                              const checked = editForm.allowedCourses.includes(course._id);
                              return (
                                <label key={course._id} className="flex items-center gap-2 cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setEditForm((prev) => {
                                        const list = e.target.checked
                                          ? [...prev.allowedCourses, course._id]
                                          : prev.allowedCourses.filter((id) => id !== course._id);
                                        return { ...prev, allowedCourses: list };
                                      });
                                    }}
                                    className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                                    {course.title}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {courses.length === 0 && (
                        <p className="text-xs text-zinc-400">No courses available.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updatingUser}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {updatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </PageTransition>
  );
};
