import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import { authApi, courseApi, favoriteApi } from "../api";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PageTransition } from "../components/ui/PageTransition";
import { CourseCard } from "../components/course/CourseCard";
import { Loader2, Trash2, Clock, BookOpen, CheckCircle, Heart, Play, FileText, User } from "lucide-react";
import type { Course, FavoriteData } from "../types";

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, hydrate, loading: authLoading, toggleFavoriteCourse, toggleFavoriteLesson } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "favorites">("dashboard");
  const [favTab, setFavTab] = useState<"courses" | "lessons">("courses");

  // Dashboard State
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  // Favorites State
  const [favData, setFavData] = useState<FavoriteData | null>(null);
  const [favLoading, setFavLoading] = useState(true);

  // Fetch Dashboard Courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await courseApi.list();
        setCourses(data.data || []);
      } catch (err) {
        console.error("Failed to fetch courses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  // Fetch Favorites
  const fetchFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const res = await favoriteApi.list();
      setFavData(res.data.data || { courses: [], lessons: [] });
    } catch { /* handle */ }
    finally { setFavLoading(false); }
  }, []);

  useEffect(() => { 
    if (activeTab === "favorites") {
      fetchFavorites(); 
    }
  }, [activeTab, fetchFavorites]);

  const handleClearStats = async () => {
    if (!confirm("Are you sure you want to clear your learning history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await authApi.clearStats();
      await hydrate();
    } catch (err) {
      alert("Failed to clear stats");
    } finally {
      setClearing(false);
    }
  };

  const handleToggleComplete = async (courseId: string, currentStatus: string) => {
    const next = currentStatus === "completed" ? "in-progress" : "completed";
    try {
      await authApi.updateProgress(courseId, next);
      await hydrate();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleUnfavCourse = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleFavoriteCourse(id);
    setFavData((d) => d ? { ...d, courses: d.courses.filter((c) => c._id !== id) } : d);
  };

  const handleUnfavLesson = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleFavoriteLesson(id);
    setFavData((d) => d ? { ...d, lessons: d.lessons.filter((l) => l._id !== id) } : d);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const hours = ((user?.totalLearningSeconds || 0) / 3600).toFixed(1);
  const progressList = user?.courseProgress || [];
  const inProgressIds = progressList.filter((p: any) => p.status === "in-progress").map((p: any) => p.courseId);
  const completedIds = progressList.filter((p: any) => p.status === "completed").map((p: any) => p.courseId);

  const inProgressCourses = courses.filter(c => inProgressIds.includes(c._id));
  const completedCourses = courses.filter(c => completedIds.includes(c._id));

  return (
    <PageTransition className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            </div>
            {user?.name || "User"}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track your progress and access saved favorites.
          </p>
        </div>
        {user?.role === "admin" && activeTab === "dashboard" && (
          <button
            onClick={handleClearStats}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Clear My Stats
          </button>
        )}
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex gap-2 mb-8 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 w-fit">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            activeTab === "dashboard"
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Dashboard
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
            activeTab === "favorites"
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Heart className="w-4 h-4" /> Favorites
        </button>
      </div>

      {activeTab === "dashboard" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{hours}h</p>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Learn Time</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{inProgressCourses.length}</p>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">In Progress</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{completedCourses.length}</p>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Completed</p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-zinc-400" />
                In Progress Courses
              </h2>
              {inProgressCourses.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-center">
                  You haven't started any courses yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {inProgressCourses.map((c, i) => (
                    <div key={c._id} className="relative group">
                      <CourseCard course={c} index={i} suggestions={{teachers:[], subjects:[], grades:[], platformNames:[]}} onMutate={()=>{}} readonly />
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleComplete(c._id, "in-progress")}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors shadow-sm"
                        >
                          Mark Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Completed Courses
              </h2>
              {completedCourses.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 text-center">
                  No completed courses yet. Keep learning!
                </p>
              ) : (
                <div className="space-y-3 opacity-80">
                  {completedCourses.map((c, i) => (
                    <div key={c._id} className="relative group">
                      <CourseCard course={c} index={i} suggestions={{teachers:[], subjects:[], grades:[], platformNames:[]}} onMutate={()=>{}} readonly />
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleComplete(c._id, "completed")}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                        >
                          Undo Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </motion.div>
      )}

      {activeTab === "favorites" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-px">
            {(["courses", "lessons"] as ("courses" | "lessons")[]).map((t) => (
              <button
                key={t}
                onClick={() => setFavTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  favTab === t
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {t === "courses" ? `Favorite Courses (${favData?.courses?.length ?? 0})` : `Saved Lessons (${favData?.lessons?.length ?? 0})`}
              </button>
            ))}
          </div>

          {favLoading ? (
            <div className="flex justify-center py-12 text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : favTab === "courses" ? (
            favData?.courses?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {favData.courses.map((course, i) => (
                  <motion.div
                    key={course._id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/course/${course._id}`)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{course.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {[course.grade, course.subject].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => handleUnfavCourse(e, course._id)}
                      className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors shrink-0"
                    >
                      <Heart className="w-4 h-4 fill-current text-red-500" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-center py-16 text-zinc-400 text-sm">No favorite courses yet.</p>
            )
          ) : (
            favData?.lessons?.length ? (
              <div className="space-y-3">
                {favData.lessons.map((lesson, i) => {
                  const section = lesson.sectionId as unknown as { courseId: { _id: string; title: string } };
                  const courseId = section?.courseId?._id;
                  const courseTitle = section?.courseId?.title;

                  return (
                    <motion.div
                      key={lesson._id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-500/30"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                          lesson.type === "video"
                            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                        onClick={() => courseId && navigate(`/course/${courseId}`)}
                      >
                        {lesson.type === "video" ? <Play className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => courseId && navigate(`/course/${courseId}`)}>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{lesson.title}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {lesson.type === "video" ? "Video Lesson" : "Document"}
                          {courseTitle && ` · ${courseTitle}`}
                        </p>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleUnfavLesson(e, lesson._id)}
                        className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors shrink-0"
                      >
                        <Heart className="w-4 h-4 fill-current text-red-500" />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-16 text-zinc-400 text-sm">No favorite lessons yet.</p>
            )
          )}
        </motion.div>
      )}
    </PageTransition>
  );
};
