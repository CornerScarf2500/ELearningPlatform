import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Play, FileText, Loader2, SlidersHorizontal, X } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { searchApi, courseApi } from "../api";
import type { SearchResults, Course } from "../types";

type FilterType = "all" | "courses" | "lessons";

export const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedPlatformName, setSelectedPlatformName] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Load filter options on mount
  useEffect(() => {
    courseApi.list().then((r) => setAllCourses(r.data.data || [])).catch(() => {});
  }, []);

  const platformNames = [...new Set(allCourses.map((c) => c.platformName || "").filter(Boolean))];
  const grades = [...new Set(allCourses.map((c) => c.grade).filter(Boolean))] as string[];
  const subjects = [...new Set(allCourses.map((c) => c.subject).filter(Boolean))] as string[];

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setResults({ courses: allCourses as unknown as SearchResults["courses"], lessons: [] });
      setSearched(true);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await searchApi.query(q);
      setResults(data.data || { courses: [], lessons: [] });
    } catch {
      setResults({ courses: [], lessons: [] });
    } finally {
      setLoading(false);
    }
  }, [query, allCourses]);

  // Auto-run filter when filter values change (even without explicit search)
  useEffect(() => {
    if (selectedPlatformName || selectedGrade || selectedSubject) {
      setResults({ courses: allCourses as unknown as SearchResults["courses"], lessons: [] });
      setSearched(true);
    }
  }, [selectedPlatformName, selectedGrade, selectedSubject, allCourses]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  // Apply extended filters to raw results
  const filteredResults = (() => {
    if (!results) return null;
    let courses = results.courses;
    let lessons = results.lessons;

    if (selectedPlatformName) courses = courses.filter((c) => (c.platformName || "") === selectedPlatformName);
    if (selectedGrade) {
      courses = courses.filter((c) => c.grade === selectedGrade);
    }
    if (selectedSubject) {
      courses = courses.filter((c) => c.subject === selectedSubject);
    }

    return { courses, lessons };
  })();

  const total = (filteredResults?.courses.length || 0) + (filteredResults?.lessons.length || 0);

  const activeFiltersCount = [selectedPlatformName, selectedGrade, selectedSubject].filter(Boolean).length;

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Search</h1>
        <button
          onClick={() => setShowFilterPanel((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors relative ${
            showFilterPanel
              ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-500/30 dark:text-indigo-400"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 space-y-3">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Filter Results
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Platform */}
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">Platform</label>
                  <select
                    value={selectedPlatformName}
                    onChange={(e) => setSelectedPlatformName(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="">All Platforms</option>
                    {platformNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                {/* Grade */}
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">Grade</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="">All Grades</option>
                    {grades.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                {/* Subject */}
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="">All Subjects</option>
                    {subjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setSelectedPlatformName(""); setSelectedGrade(""); setSelectedSubject(""); }}
                  className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:underline"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search bar + button */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search courses and lessons…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </motion.button>
      </div>

      {/* Type filter pills (always visible after first search) */}
      {searched && filteredResults && total > 0 && (
        <div className="flex items-center gap-2 mb-6">
          {(["all", "courses", "lessons"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                activeFilter === filter
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {filter === "all"
                ? `All (${total})`
                : filter === "courses"
                ? `Courses (${filteredResults.courses.length})`
                : `Lessons (${filteredResults.lessons.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : searched && filteredResults ? (
        total === 0 ? (
          <p className="text-center py-16 text-zinc-400 text-sm">
            No results found for "{query}"
            {activeFiltersCount > 0 && " with current filters"}
          </p>
        ) : (
          <div className="space-y-6">
            {/* Course results */}
            {(activeFilter === "all" || activeFilter === "courses") && filteredResults.courses.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                  Courses ({filteredResults.courses.length})
                </h2>
                <div className="space-y-2">
                  {filteredResults.courses.map((course, i) => (
                    <motion.div
                      key={course._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
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
                          {[course.grade, course.subject, course.teacher].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Lesson results */}
            {(activeFilter === "all" || activeFilter === "lessons") && filteredResults.lessons.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                  Lessons ({filteredResults.lessons.length})
                </h2>
                <div className="space-y-2">
                  {filteredResults.lessons.map((lesson, i) => {
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
                        transition={{ delay: i * 0.04 }}
                        onClick={() => courseId && navigate(`/course/${courseId}`)}
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
          <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Search for courses or individual lessons</p>
            <p className="text-xs mt-1 opacity-70">Type your query and press Enter or click Search</p>
          </div>
        )
      )}
    </PageTransition>
  );
};
