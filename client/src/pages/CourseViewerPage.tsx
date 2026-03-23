import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { LessonAccordion } from "../components/course/LessonAccordion";
import { AdminEditModal } from "../components/admin/AdminEditModal";
import { useAdmin } from "../hooks/useAdmin";
import { courseApi, sectionApi } from "../api";
import type { Course, Section, Lesson } from "../types";

export const CourseViewerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const [course, setCourse] = useState<(Course & { sections: Section[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await courseApi.get(id);
      const c = data.data as Course & { sections: Section[] };
      setCourse(c);
      // Auto-select first video lesson
      if (!activeLesson && c.sections?.length) {
        for (const s of c.sections) {
          if (s.lessons?.length) {
            setActiveLesson(s.lessons[0]);
            break;
          }
        }
      }
    } catch {
      /* handle */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!course) {
    return (
      <PageTransition className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-zinc-500">Course not found.</p>
      </PageTransition>
    );
  }

  const isVideo = activeLesson?.type === "video";
  const videoUrl = activeLesson?.videoUrl || "";
  const pdfUrl = activeLesson?.fileUrl || "";

  return (
    <PageTransition className="h-full">
      {/* Mobile: stacked / Desktop: split-pane */}
      <div className="flex flex-col md:flex-row md:h-screen">
        {/* ── Left: Player (70% on desktop) ───────────────── */}
        <div className="w-full md:w-[70%] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50 md:static">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {course.title}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {activeLesson?.title || "Select a lesson"}
              </p>
            </div>
          </div>

          {/* Player area */}
          <div className="flex-1 bg-black flex items-center justify-center min-h-[240px] md:min-h-0">
            {activeLesson ? (
              isVideo && videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full max-h-[70vh] md:max-h-full object-contain"
                />
              ) : !isVideo && pdfUrl ? (
                <iframe
                  key={pdfUrl}
                  src={pdfUrl}
                  title={activeLesson.title}
                  className="w-full h-full min-h-[60vh] md:min-h-full bg-white"
                />
              ) : (
                <p className="text-zinc-500 text-sm">No media available</p>
              )
            ) : (
              <p className="text-zinc-500 text-sm">
                Select a lesson to begin
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Lesson list (30% on desktop) ──────────── */}
        <div className="w-full md:w-[30%] md:h-screen md:overflow-y-auto border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          {/* Section header with add button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Content
            </h3>
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setAddSectionOpen(true)}
                className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
                title="Add section"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            )}
          </div>

          {/* Accordion sections */}
          <div>
            {course.sections?.map((section) => (
              <LessonAccordion
                key={section._id}
                section={section}
                activeLesson={activeLesson}
                onSelectLesson={setActiveLesson}
                onMutate={fetchCourse}
              />
            ))}
            {(!course.sections || course.sections.length === 0) && (
              <p className="px-4 py-8 text-sm text-zinc-400 italic text-center">
                No sections yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Admin add section modal */}
      {isAdmin && (
        <AdminEditModal
          open={addSectionOpen}
          onClose={() => setAddSectionOpen(false)}
          title="New Section"
          fields={[
            { label: "Title", key: "title", value: "", placeholder: "Section title" },
          ]}
          onSave={async (vals) => {
            await sectionApi.create({ title: vals.title, courseId: course._id });
            fetchCourse();
          }}
        />
      )}
    </PageTransition>
  );
};
