import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, BookOpen, Play, FileText, Loader2 } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { searchApi } from "../api";
import type { SearchResults } from "../types";

export const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await searchApi.query(q);
      setResults(data.data || { courses: [], lessons: [] });
    } catch {
      /* handle */
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const total =
    (results?.courses.length || 0) + (results?.lessons.length || 0);

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Search
      </h1>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search courses and lessons…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : searched && results ? (
        total === 0 ? (
          <p className="text-center py-16 text-zinc-400 text-sm">
            No results found for "{query}"
          </p>
        ) : (
          <div className="space-y-6">
            {/* Course results */}
            {results.courses.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                  Courses ({results.courses.length})
                </h2>
                <div className="space-y-2">
                  {results.courses.map((course, i) => (
                    <motion.div
                      key={course._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/course/${course._id}`)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {course.title}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Course · {course.teacher}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Lesson results */}
            {results.lessons.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                  Lessons ({results.lessons.length})
                </h2>
                <div className="space-y-2">
                  {results.lessons.map((lesson, i) => {
                    const section = lesson.sectionId as unknown as {
                      title: string;
                      courseId: { _id: string; title: string };
                    };
                    const courseId = section?.courseId?._id || "";
                    const courseTitle = section?.courseId?.title || "";

                    return (
                      <motion.div
                        key={lesson._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() =>
                          courseId && navigate(`/course/${courseId}`)
                        }
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all"
                      >
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                            lesson.type === "video"
                              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                              : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {lesson.type === "video" ? (
                            <Play className="w-3.5 h-3.5" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {lesson.title}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {lesson.type === "video" ? "Video" : "PDF"}
                            {courseTitle && ` · ${courseTitle}`}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        !searched && (
          <p className="text-center py-16 text-zinc-400 text-sm">
            Search for courses or individual lessons
          </p>
        )
      )}
    </PageTransition>
  );
};
