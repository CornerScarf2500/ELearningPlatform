import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { authApi, courseApi } from "../api";
import { PageTransition } from "../components/ui/PageTransition";
import { CourseCard } from "../components/course/CourseCard";
import { Loader2, Trash2, Clock, BookOpen, CheckCircle } from "lucide-react";
import type { Course } from "../types";

export const ProfilePage = () => {
  const { user, hydrate, loading: authLoading } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

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
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">User Profile</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track your learning progress and manage your courses.
          </p>
        </div>
        {user?.role === "admin" && (
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
    </PageTransition>
  );
};
