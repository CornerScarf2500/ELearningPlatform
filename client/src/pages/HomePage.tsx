import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2, UploadCloud, CheckSquare, Trash2, X } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { CourseCard } from "../components/course/CourseCard";
import { AdminEditModal } from "../components/admin/AdminEditModal";
import { Modal } from "../components/ui/Modal";
import { useAdmin } from "../hooks/useAdmin";
import { courseApi, platformApi } from "../api";
import { BackendStatus } from "../components/ui/BackendStatus";
import type { Course, Platform } from "../types";

export const HomePage = () => {
  const isAdmin = useAdmin();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  
  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await courseApi.list();
      setCourses(data.data || []);
      // Reset selections if courses change significantly
      setSelectedIds(new Set());
    } catch {
      /* silently handle */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const openAdd = async () => {
    // Prefetch platforms for the dropdown
    try {
      const { data } = await platformApi.list();
      setPlatforms(data.data || []);
    } catch {
      /* continue */
    }
    setAddOpen(true);
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === courses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(courses.map((c) => c._id)));
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
      await fetchCourses();
    } catch (e) {
      alert("Error deleting courses.");
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!jsonInput.trim()) return;
    try {
      let parsed;
      try {
        parsed = JSON.parse(jsonInput);
      } catch {
        alert("Invalid JSON format.");
        return;
      }
      setImporting(true);
      await courseApi.import(parsed);
      setImportOpen(false);
      setJsonInput("");
      await fetchCourses();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to import course");
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Courses
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {courses.length} course{courses.length !== 1 && "s"} available
          </p>
          <div className="mt-2">
            <BackendStatus />
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                isSelectMode
                  ? "bg-zinc-100 border-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {isSelectMode ? "Cancel Select" : "Select"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 text-sm font-medium transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              Import
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Course
            </motion.button>
          </div>
        )}
      </div>

      {isSelectMode && courses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {selectedIds.size === courses.length ? "Deselect All" : "Select All"}
            </button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {selectedIds.size} selected
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          )}
        </motion.div>
      )}

      {/* Course list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 dark:text-zinc-500">
          <p className="text-lg font-medium">No courses yet</p>
          <p className="text-sm mt-1">
            {isAdmin
              ? 'Click "Add Course" to get started.'
              : "Check back later for new content."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((course, i) => (
            <CourseCard
              key={course._id}
              course={course}
              index={i}
              onMutate={fetchCourses}
              isSelectMode={isSelectMode}
              selected={selectedIds.has(course._id)}
              onToggleSelect={() => handleToggleSelect(course._id)}
            />
          ))}
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
            { label: "Subject", key: "subject", value: "", placeholder: "Mathematics, Physics…" },
            { label: "Teacher", key: "teacher", value: "", placeholder: "Teacher name" },
            {
              label: `Platform ID ${platforms.length ? `(${platforms.map((p) => `${p.name}: ${p._id}`).join(", ")})` : ""}`,
              key: "platformId",
              value: platforms[0]?._id || "",
              placeholder: "Platform ObjectId",
            },
          ]}
          onSave={async (vals) => {
            await courseApi.create(vals);
            fetchCourses();
          }}
        />
      )}

      {/* JSON Import Modal */}
      <Modal open={importOpen} onClose={() => !importing && setImportOpen(false)}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Import JSON Course
          </h2>
          <button
            onClick={() => !importing && setImportOpen(false)}
            className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3 block">
            Paste your complete course JSON below mapping <code>title</code>, <code>grade</code>, <code>teacher</code>, and the <code>sections</code> arrays.
          </p>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full h-64 p-3 font-mono text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            placeholder='{&#10;  "title": "Science 101",&#10;  "sections": [...]&#10;}'
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={() => setImportOpen(false)}
            disabled={importing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !jsonInput.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            {importing ? "Importing..." : "Run Import"}
          </button>
        </div>
      </Modal>
    </PageTransition>
  );
};
