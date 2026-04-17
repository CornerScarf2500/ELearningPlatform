const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/pages/HomePage.tsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add imports
content = content.replace(
  /import { Plus, Loader2, UploadCloud, CheckSquare, Trash2, X, FileJson, Edit3 } from "lucide-react";/,
  'import { Plus, Loader2, UploadCloud, CheckSquare, Trash2, X, FileJson, Edit3, Search, BookOpen, Play, FileText, SlidersHorizontal } from "lucide-react";'
);

content = content.replace(
  /import { courseApi } from "\.\.\/api";/,
  'import { courseApi, searchApi } from "../api";'
);

content = content.replace(
  /import type { Course, Platform } from "\.\.\/types";/,
  'import type { Course, Platform, SearchResults } from "../types";\nimport { useNavigate } from "react-router-dom";'
);

// 2. Add state inside the component
const stateInjection = `  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "courses" | "lessons">("all");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Search Filters
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearched(false);
      return;
    }
    setSearchLoading(true);
    setSearched(true);
    try {
      const { data } = await searchApi.query(q);
      setResults(data.data || { courses: [], lessons: [] });
    } catch {
      setResults({ courses: [], lessons: [] });
    } finally {
      setSearchLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const searchFilteredResults = (() => {
    if (!results) return null;
    let sCourses = results.courses;
    let sLessons = results.lessons;

    if (filterPlatform) sCourses = sCourses.filter((c) => (c.platformName || "") === filterPlatform);
    if (filterGrade) sCourses = sCourses.filter((c) => c.grade === filterGrade);
    if (filterSubject) sCourses = sCourses.filter((c) => c.subject === filterSubject);
    if (filterTeacher) sCourses = sCourses.filter((c) => c.teacher === filterTeacher);

    return { courses: sCourses, lessons: sLessons };
  })();

  const activeFiltersCount = [filterPlatform, filterGrade, filterSubject, filterTeacher].filter(Boolean).length;
  const searchTotal = (searchFilteredResults?.courses.length || 0) + (searchFilteredResults?.lessons.length || 0);
`;

content = content.replace(
  /  const isAdmin = useAdmin\(\);/,
  stateInjection + '\n  const isAdmin = useAdmin();'
);

// 3. Inject Search UI right above Platform filter pills
const searchUI = `
      {/* Search Component */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 hidden">Global Search</h1>
          <button
            onClick={() => setShowFilterPanel((v) => !v)}
            className={\`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors relative \${
              showFilterPanel
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-500/30 dark:text-indigo-400"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }\`}
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
                  Filter Search Results
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Platform</label>
                    <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800 dark:border-zinc-700">
                      <option value="">All</option>
                      {[...new Set(courses.map(c => c.platformName).filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Grade</label>
                    <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800 dark:border-zinc-700">
                      <option value="">All</option>
                      {[...new Set(courses.map(c => c.grade).filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Subject</label>
                    <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800 dark:border-zinc-700">
                      <option value="">All</option>
                      {[...new Set(courses.map(c => c.subject).filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Teacher</label>
                    <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800 dark:border-zinc-700">
                      <option value="">All</option>
                      {[...new Set(courses.map(c => c.teacher).filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setFilterPlatform(""); setFilterGrade(""); setFilterSubject(""); setFilterTeacher(""); }} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => { 
                setQuery(e.target.value); 
                if (e.target.value === "") {
                  setSearched(false);
                  setResults(null);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search courses and lessons by teacher or title…"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || searchLoading}
            className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>

      {!searched ? (
        <>
`;

content = content.replace(/      {\/\* Platform filter pills \*\/}/, searchUI + '      {/* Platform filter pills */}');

// 4. Close the <></> wrapper over the default UI and append Search Results mapping
const endUI = `
        </>
      ) : (
        <div className="space-y-6">
          {/* Search Result Pills */}
          {searchFilteredResults && searchTotal > 0 && (
            <div className="flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {(["all", "courses", "lessons"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={\`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors \${
                    activeFilter === filter
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  }\`}
                >
                  {filter === "all" ? \`All (\${searchTotal})\` : filter === "courses" ? \`Courses (\${searchFilteredResults.courses.length})\` : \`Lessons (\${searchFilteredResults.lessons.length})\`}
                </button>
              ))}
            </div>
          )}

          {searchLoading ? (
             <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
          ) : searchFilteredResults && searchTotal === 0 ? (
             <p className="text-center py-16 text-zinc-400 text-sm">No results found for "{query}"</p>
          ) : searchFilteredResults ? (
            <div className="space-y-6">
              {/* Courses Map */}
              {(activeFilter === "all" || activeFilter === "courses") && searchFilteredResults.courses.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase text-zinc-500 mb-3">Courses (\${searchFilteredResults.courses.length})</h2>
                  <div className="space-y-2">
                    {searchFilteredResults.courses.map((course, i) => (
                      <motion.div key={course._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => navigate(\`/course/\${course._id}\`)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 transition-all shadow-sm"
                      >
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{course.title}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{[course.grade, course.subject, course.teacher].filter(Boolean).join(" · ")}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lessons Map */}
              {(activeFilter === "all" || activeFilter === "lessons") && searchFilteredResults.lessons.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase text-zinc-500 mb-3">Lessons (\${searchFilteredResults.lessons.length})</h2>
                  <div className="space-y-2">
                    {searchFilteredResults.lessons.map((lesson, i) => {
                      const section = lesson.sectionId as any;
                      const courseId = section?.courseId?._id;
                      const courseTitle = section?.courseId?.title;
                      return (
                        <motion.div key={lesson._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          onClick={() => courseId && navigate(\`/course/\${courseId}\`)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 transition-all shadow-sm"
                        >
                          <div className={\`w-8 h-8 rounded-md flex items-center justify-center shrink-0 \${lesson.type === "video" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}\`}>
                            {lesson.type === "video" ? <Play className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{lesson.title}</p>
                            <p className="text-xs text-zinc-500 truncate">{lesson.type === "video" ? "Video" : "PDF"} {courseTitle && \` · \${courseTitle}\`}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
`;

content = content.replace(
  /      \{\/\* Admin add course modal \*\/\}/,
  endUI + '\n      {/* Admin add course modal */}'
);

fs.writeFileSync(file, content);
console.log("Refactored successfully!");
