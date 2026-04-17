import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
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
      const resp = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Backup failed");
      const data = await resp.json();
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Backup failed. Please try again.");
    } finally {
      setDownloading(false);
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

  const [dbUsed, setDbUsed] = useState<string>("Calculating…");
  const [dbUsedBytes, setDbUsedBytes] = useState<number>(0);

  const fetchDbStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const token = useAuthStore.getState().token;
      const resp = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.success) {
        const mb = (data.usedBytes / 1024 / 1024).toFixed(2);
        setDbUsed(`${mb} MB (${data.stats.collections || data.stats.objects || '?'} items)`);
        setDbUsedBytes(data.usedBytes);
      } else {
        setDbUsed("Unavailable");
      }
    } catch {
      setDbUsed("Unavailable");
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
    accessCode: string;
    isCoursesRestricted: boolean;
    allowedCourses: string[];
  }>({ name: "", role: "user", accessCode: "", isCoursesRestricted: false, allowedCourses: [] });
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
            {isAdmin && (
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <Archive className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Database Storage (MongoDB)
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {dbUsed}
                    </p>
                  </div>
                </div>
                {/* Progress bar (512MB max) */}
                {dbUsedBytes > 0 && (() => {
                  const maxBytes = 512 * 1024 * 1024;
                  const percentage = Math.min(100, (dbUsedBytes / maxBytes) * 100);
                  const isNearLimit = percentage > 80;
                  return (
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1 font-mono">
                        <span>Used: {(dbUsedBytes / 1024 / 1024).toFixed(2)} MB</span>
                        <span>Capacity: 512.00 MB</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${isNearLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
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

                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setEditingUser(u);
                            setEditForm({
                              name: u.name || "",
                              accessCode: u.accessCode || "",
                              role: u.role as "admin" | "user",
                              isCoursesRestricted: u.isCoursesRestricted ?? false,
                              allowedCourses: (u.allowedCourses || []).map(c => c._id || c),
                            });
                          }}
                          title="Edit User"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </motion.button>
                        {u.role !== "admin" && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleBan(u.id)}
                            title={u.isBanned ? "Unban User" : "Ban User"}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              u.isBanned
                                ? "border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                : "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                            }`}
                          >
                            {u.isBanned ? <Shield className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                          </motion.button>
                        )}
                        {u.activeSessions > 0 && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => revokeSessions(u.id)}
                            title="Revoke All Sessions"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </motion.button>
                        )}
                        {u.role !== "admin" && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDeleteUser(u.id, u.name || "User")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            title="Delete User"
                          >
                            <UserX className="w-3.5 h-3.5" />
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
                                <p className="text-zinc-500 dark:text-zinc-500">
                                  Login: {new Date(s.loginAt).toLocaleString()}
                                </p>
                                {s.lastAccessedAt && (
                                  <p className="text-emerald-600 dark:text-emerald-500/80">
                                    Last Access: {new Date(s.lastAccessedAt).toLocaleString()}
                                  </p>
                                )}
                                {s.device && (
                                  <p className="text-zinc-400 dark:text-zinc-500 text-[10px] mt-0.5 truncate" title={s.device}>
                                    User Agent: {s.device}
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
                  placeholder="Leave empty to use existing code"
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
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-4">
                      {(() => {
                        const grouped = courses.reduce((acc, c) => {
                          const p = c.platformName || "No Platform";
                          if (!acc[p]) acc[p] = [];
                          acc[p].push(c);
                          return acc;
                        }, {} as Record<string, Course[]>);
                        return Object.entries(grouped)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([platformName, platformCourses]) => (
                            <div key={platformName} className="space-y-1.5">
                              <div className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 py-1 z-10 border-b border-zinc-200 dark:border-zinc-700 mb-2">
                                <h4 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                  {platformName}
                                </h4>
                              </div>
                              {platformCourses.map(course => {
                                const checked = editForm.allowedCourses.includes(course._id);
                                return (
                                  <label key={course._id} className="flex items-center gap-2 cursor-pointer ml-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 p-1 -mx-1 rounded transition-colors">
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
                          ));
                      })()}
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
