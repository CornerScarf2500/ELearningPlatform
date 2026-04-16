import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, UploadCloud, CheckSquare, Trash2, X, FileJson, Edit3 } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { CourseCard } from "../components/course/CourseCard";
import { AdminEditModal } from "../components/admin/AdminEditModal";
import { Modal } from "../components/ui/Modal";
import { useAdmin } from "../hooks/useAdmin";
import { useAuthStore } from "../store/authStore";
import { courseApi } from "../api";
import { BackendStatus } from "../components/ui/BackendStatus";
import { platformApi } from "../api";
import type { Course, Platform } from "../types";

interface QueuedFile {
  name: string;
  status: "pending" | "importing" | "done" | "error";
  parsed: any;
  error?: string;
}

export const HomePage = () => {
  const isAdmin = useAdmin();
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [activePlatformName, setActivePlatformName] = useState<string | null>(null);
  // Platform registry — server-side
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [addPlatformOpen, setAddPlatformOpen] = useState(false);
  const [editPlatformTarget, setEditPlatformTarget] = useState<Platform | null>(null);

  // Bulk-assign platform
  const [assignPlatformOpen, setAssignPlatformOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Platform | null>(null);
  
  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCoursesAndPlatforms = useCallback(async () => {
    try {
      const [courseRes, platformRes] = await Promise.all([
        courseApi.list(),
        platformApi.list()
      ]);
      setCourses(courseRes.data.data || []);
      setPlatforms(platformRes.data.data || []);
      setSelectedIds(new Set());
    } catch { /* silently handle */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCoursesAndPlatforms();
  }, [fetchCoursesAndPlatforms]);

  // Filter logic
  const platformNames = platforms.map(p => p.name);
  const filteredCourses = activePlatformName
    ? courses.filter((c) => (c.platformName || "Unknown") === activePlatformName)
    : courses;

  const handleBulkAssignPlatform = async () => {
    if (!assignTarget || selectedIds.size === 0) return;
    try {
      await courseApi.bulkSetPlatform([...selectedIds], assignTarget.name, assignTarget.logoUrl);
      setAssignPlatformOpen(false);
      setAssignTarget(null);
      setIsSelectMode(false);
      fetchCoursesAndPlatforms();
    } catch { 
      alert("Error assigning platform."); 
    }
  };

  const openAdd = async () => {
    setAddOpen(true);
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCourses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCourses.map((c) => c._id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} courses?`)) return;
    setLoading(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => courseApi.delete(id)));
      setIsSelectMode(false);
      setSelectedIds(new Set());
      await fetchCoursesAndPlatforms();
    } catch {
      alert("Error deleting courses.");
      setLoading(false);
    }
  };

  const parseFiles = (fileList: FileList) => {
    const readers: Promise<QueuedFile>[] = Array.from(fileList).map((file) =>
      new Promise<QueuedFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string);
            resolve({ name: file.name, status: "pending", parsed });
          } catch {
            resolve({ name: file.name, status: "error", parsed: null, error: "Invalid JSON" });
          }
        };
        reader.readAsText(file);
      })
    );
    Promise.all(readers).then((results) => {
      setFileQueue((prev) => [...prev, ...results]);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) parseFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) parseFiles(e.target.files);
    e.target.value = "";
  };

  const removeQueuedFile = (idx: number) => {
    setFileQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImportAll = async () => {
    const pending = fileQueue.filter((f) => f.status === "pending" && f.parsed);
    if (pending.length === 0) return;
    setImporting(true);
    for (let i = 0; i < fileQueue.length; i++) {
      const f = fileQueue[i];
      if (f.status !== "pending" || !f.parsed) continue;
      setFileQueue((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "importing" } : item))
      );
      try {
        await courseApi.import(f.parsed);
        setFileQueue((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "done" } : item))
        );
      } catch (err: any) {
        setFileQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "error", error: err.response?.data?.message || "Import failed" }
              : item
          )
        );
      }
    }
    setImporting(false);
    await fetchCoursesAndPlatforms();
  };

  const statusColor = (s: QueuedFile["status"]) => {
    if (s === "done") return "text-emerald-600 dark:text-emerald-400";
    if (s === "error") return "text-red-500";
    if (s === "importing") return "text-indigo-500";
    return "text-zinc-500 dark:text-zinc-400";
  };
  const statusLabel = (s: QueuedFile["status"]) =>
    s === "done" ? "✓" : s === "error" ? "✗" : s === "importing" ? "…" : "Queued";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      {/* Greeting */}
      {user && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {getGreeting()}, <span className="text-indigo-600 dark:text-indigo-400">{user.name || "User"}</span>! 👋
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Ready to learn something new today?
          </p>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Courses</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {filteredCourses.length} course{filteredCourses.length !== 1 && "s"}
            {activePlatformName ? " in this platform" : " available"}
          </p>
          <div className="mt-2">
            <BackendStatus />
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds(new Set()); }}
              title={isSelectMode ? "Cancel selection" : "Multi-select courses"}
              className={`p-2 rounded-lg text-sm font-medium border transition-colors ${
                isSelectMode
                  ? "bg-zinc-100 border-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => { setFileQueue([]); setImportOpen(true); }}
              title="Import JSON"
              className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={openAdd}
              title="Add course"
              className="p-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>

      {/* Platform filter pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setActivePlatformName(null)}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            activePlatformName === null
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          All
        </button>

        {platforms.map((plat) => {
          const isActive = activePlatformName === plat.name;
          return (
            <div key={plat._id} className="relative group flex items-center gap-1">
              <button
                onClick={() => setActivePlatformName(isActive ? null : plat.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white dark:bg-indigo-500"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {plat.logoUrl && (
                  <img src={plat.logoUrl} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />
                )}
                {plat.name}
              </button>
              {isAdmin && (
                <button
                  onClick={() => setEditPlatformTarget(plat)}
                  className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-all ml-0.5"
                  title="Edit platform"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* + Add new platform pill */}
        {isAdmin && (
          <button
            onClick={() => setAddPlatformOpen(true)}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-400 transition-colors"
            title="Add platform"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isSelectMode && filteredCourses.length > 0 && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <button onClick={handleSelectAll}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                {selectedIds.size === filteredCourses.length ? "Deselect All" : "Select All"}
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{selectedIds.size} selected</span>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setAssignPlatformOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 text-sm font-medium transition-colors"
                  >
                    Set Platform
                  </button>
                )}
                <button onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 text-sm font-medium transition-colors">
                  <Trash2 className="w-4 h-4" />Delete
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Course list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 dark:text-zinc-500">
          <p className="text-lg font-medium">
            {courses.length === 0 ? "No courses yet" : "No courses in this platform"}
          </p>
          <p className="text-sm mt-1">
            {isAdmin && courses.length === 0
              ? 'Click "Add Course" or "Import" to get started.'
              : activePlatformName
              ? "Try selecting a different platform."
              : "Check back later for new content."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCourses.map((course, i) => {
            const sug = {
              teachers: [...new Set(courses.map((c) => c.teacher).filter(Boolean))] as string[],
              subjects: [...new Set(courses.map((c) => c.subject).filter(Boolean))] as string[],
              grades: [...new Set(courses.map((c) => c.grade).filter(Boolean))] as string[],
              platformNames,
            };
            return (
              <CourseCard
                key={course._id}
                course={course}
                index={i}
                onMutate={fetchCoursesAndPlatforms}
                isSelectMode={isSelectMode}
                selected={selectedIds.has(course._id)}
                onToggleSelect={() => handleToggleSelect(course._id)}
                suggestions={sug}
              />
            );
          })}
        </div>
      )}

      {/* Admin add course modal */}
      {isAdmin && (
        <AdminEditModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="New Course"
          fields={[
            { label: "Title", key: "title", value: "", placeholder: "Course title" },
            { label: "Subject", key: "subject", value: "", placeholder: "Mathematics…", type: "suggest", suggestions: [...new Set(courses.map((c) => c.subject).filter(Boolean))] as string[] },
            { label: "Teacher", key: "teacher", value: "", placeholder: "Teacher name", type: "suggest", suggestions: [...new Set(courses.map((c) => c.teacher).filter(Boolean))] as string[] },
            { label: "Grade", key: "grade", value: "", placeholder: "Grade 10", type: "suggest", suggestions: [...new Set(courses.map((c) => c.grade).filter(Boolean))] as string[] },
            { label: "Platform Name", key: "platformName", value: "", placeholder: "YouTube…", type: "suggest", suggestions: platformNames },
            { label: "Platform Logo URL (optional)", key: "platformLogoUrl", value: "", placeholder: "https://" },
          ]}
          onSave={async (vals) => {
            await courseApi.create(vals);
            fetchCoursesAndPlatforms();
          }}
        />
      )}

      {/* JSON Import Modal */}
      <Modal open={importOpen} onClose={() => !importing && setImportOpen(false)}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Import JSON Courses
          </h2>
          <button
            onClick={() => !importing && setImportOpen(false)}
            className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 cursor-pointer text-center transition-colors ${
              isDragOver
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10"
                : "border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-zinc-50 dark:bg-zinc-900/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <UploadCloud className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-indigo-600 dark:text-indigo-400">Click to browse</span> or drag & drop
            </p>
            <p className="text-xs text-zinc-400 mt-1">Accepts multiple .json files</p>
          </div>

          {/* File Queue */}
          {fileQueue.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {fileQueue.map((f, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                    f.status === "done"
                      ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10"
                      : f.status === "error"
                      ? "border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <FileJson className={`w-4 h-4 shrink-0 ${statusColor(f.status)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {f.name}
                    </p>
                    {f.error && (
                      <p className="text-[10px] text-red-500">{f.error}</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${statusColor(f.status)}`}>
                    {statusLabel(f.status)}
                  </span>
                  {f.status !== "importing" && (
                    <button
                      onClick={() => removeQueuedFile(i)}
                      className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-between gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={() => setFileQueue([])}
            disabled={importing || fileQueue.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setImportOpen(false)}
              disabled={importing}
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleImportAll}
              disabled={importing || fileQueue.filter((f) => f.status === "pending").length === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {importing
                ? "Importing…"
                : `Import ${fileQueue.filter((f) => f.status === "pending").length} File${fileQueue.filter((f) => f.status === "pending").length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Platform modal */}
      {isAdmin && (
        <AdminEditModal
          open={addPlatformOpen}
          onClose={() => setAddPlatformOpen(false)}
          title="Add Platform"
          fields={[
            { label: "Platform Name", key: "name", value: "", placeholder: "YouTube, Khan Academy…" },
            { label: "Logo URL (optional)", key: "logoUrl", value: "", placeholder: "https://…" },
          ]}
          onSave={async (vals) => {
            if (!vals.name.trim()) return;
            await platformApi.create({ name: vals.name.trim(), logoUrl: vals.logoUrl.trim() });
            fetchCoursesAndPlatforms();
          }}
        />
      )}

      {/* Edit Platform modal */}
      {isAdmin && editPlatformTarget && (
        <AdminEditModal
          open={!!editPlatformTarget}
          onClose={() => setEditPlatformTarget(null)}
          title={`Edit Platform: ${editPlatformTarget.name}`}
          fields={[
            { label: "Platform Name", key: "name", value: editPlatformTarget.name, placeholder: "YouTube…" },
            { label: "Logo URL (optional)", key: "logoUrl", value: editPlatformTarget.logoUrl || "", placeholder: "https://…" },
          ]}
          onSave={async (vals) => {
            await platformApi.update(editPlatformTarget._id, { name: vals.name.trim(), logoUrl: vals.logoUrl.trim() });
            if (activePlatformName === editPlatformTarget.name) setActivePlatformName(vals.name.trim());
            fetchCoursesAndPlatforms();
          }}
          onDelete={async () => {
            await platformApi.delete(editPlatformTarget._id);
            if (activePlatformName === editPlatformTarget.name) setActivePlatformName(null);
            fetchCoursesAndPlatforms();
          }}
        />
      )}

      {/* Assign Platform to selected courses */}
      {isAdmin && assignPlatformOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAssignPlatformOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Assign Platform</h2>
            <p className="text-sm text-zinc-500 mb-4">{selectedIds.size} course{selectedIds.size !== 1 && "s"} selected</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {platforms.map((plat) => {
                return (
                  <button
                    key={plat._id}
                    onClick={() => setAssignTarget(plat)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      assignTarget?._id === plat._id
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-indigo-400"
                    }`}
                  >
                    {plat.logoUrl && <img src={plat.logoUrl} alt="" className="w-5 h-5 rounded object-contain" />}
                    {plat.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleBulkAssignPlatform}
                disabled={!assignTarget}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                Assign
              </button>
              <button onClick={() => { setAssignPlatformOpen(false); setAssignTarget(null); }}
                className="px-4 py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
};
