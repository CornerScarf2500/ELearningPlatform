import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { CourseCard } from "../components/course/CourseCard";
import { AdminEditModal } from "../components/admin/AdminEditModal";
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

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await courseApi.list();
      setCourses(data.data || []);
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
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </motion.button>
        )}
      </div>

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
    </PageTransition>
  );
};
