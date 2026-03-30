import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Play, FileText, Loader2, Heart } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { favoriteApi } from "../api";
import { useAuthStore } from "../store/authStore";
import type { FavoriteData } from "../types";

type Tab = "courses" | "lessons";

export const FavoritesPage = () => {
  const navigate = useNavigate();
  const { toggleFavoriteCourse, toggleFavoriteLesson } = useAuthStore();
  const [tab, setTab] = useState<Tab>("courses");
  const [data, setData] = useState<FavoriteData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await favoriteApi.list();
      setData(res.data.data || { courses: [], lessons: [] });
    } catch { /* handle */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const handleUnfavCourse = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleFavoriteCourse(id);
    setData((d) => d ? { ...d, courses: d.courses.filter((c) => c._id !== id) } : d);
  };

  const handleUnfavLesson = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleFavoriteLesson(id);
    setData((d) => d ? { ...d, lessons: d.lessons.filter((l) => l._id !== id) } : d);
  };

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Favorites</h1>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 w-fit">
        {(["courses", "lessons"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
              tab === t
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t === "courses" ? `Courses (${data?.courses.length ?? 0})` : `Lessons (${data?.lessons.length ?? 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : tab === "courses" ? (
        data?.courses.length ? (
          <div className="space-y-2">
            {data.courses.map((course, i) => (
              <motion.div
                key={course._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/course/${course._id}`)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {(course as any).platformId?.logoUrl ? (
                    <img src={(course as any).platformId.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                  ) : (
                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{course.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {[course.grade, course.subject, course.teacher, (course as any).platformId?.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {/* Unfavorite */}
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => handleUnfavCourse(e, course._id)}
                  className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                  title="Remove from favorites"
                >
                  <Heart className="w-4 h-4 fill-current" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-center py-16 text-zinc-400 text-sm">No favorite courses yet</p>
        )
      ) : (
        data?.lessons.length ? (
          <div className="space-y-2">
            {data.lessons.map((lesson, i) => {
              const section = lesson.sectionId as unknown as {
                _id: string; title: string;
                courseId: { _id: string; title: string };
              };
              const courseTitle = section?.courseId?.title || "";
              const courseId = section?.courseId?._id || "";

              return (
                <motion.div
                  key={lesson._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all"
                >
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 cursor-pointer ${
                      lesson.type === "video"
                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                    onClick={() => courseId && navigate(`/course/${courseId}`)}
                  >
                    {lesson.type === "video" ? <Play className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>

                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => courseId && navigate(`/course/${courseId}`)}
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{lesson.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {[lesson.type === "video" ? "Video" : "PDF", courseTitle, (section?.courseId as any)?.platformId?.name].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  {/* Go to course */}
                  {courseId && (
                    <button
                      onClick={() => navigate(`/course/${courseId}`)}
                      className="px-2 py-1 rounded-md text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors shrink-0"
                    >
                      Open
                    </button>
                  )}

                  {/* Unfavorite */}
                  <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => handleUnfavLesson(e, lesson._id)}
                    className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    title="Remove from favorites"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-16 text-zinc-400 text-sm">No favorite lessons yet</p>
        )
      )}
    </PageTransition>
  );
};
