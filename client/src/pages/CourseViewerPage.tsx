import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, FolderDown, FileText, Download, ExternalLink, GripVertical, ToggleLeft, ToggleRight, Play, Heart, Edit3 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { PageTransition } from "../components/ui/PageTransition";
import { LessonItem } from "../components/course/LessonItem";
import { VideoPlayer } from "../components/course/VideoPlayer";
import { AdminEditModal } from "../components/admin/AdminEditModal";
import { ExternalLinkModal } from "../components/ui/ExternalLinkModal";
import { useAdmin } from "../hooks/useAdmin";
import { useAuthStore } from "../store/authStore";
import { courseApi, sectionApi, lessonApi, authApi } from "../api";
import type { Course, Section, Lesson } from "../types";

// ── YouTube helpers ─────────────────────────────────────────────
function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}
function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url;
}
function isExternalUrl(url: string) {
  return isYouTubeUrl(url) || /vimeo\.com/i.test(url);
}

export const CourseViewerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const { user, toggleFavoriteLesson } = useAuthStore();
  const [course, setCourse] = useState<(Course & { sections: Section[]; unsectioned: Lesson[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [editLessonOpen, setEditLessonOpen] = useState(false);
  const [showReorderHandle, setShowReorderHandle] = useState(() => {
    try { return localStorage.getItem("reorder-handle") !== "false"; }
    catch { return true; }
  });

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX; // dragging left = bigger sidebar
      const next = Math.max(220, Math.min(520, startW + delta));
      setSidebarWidth(next);
    };
    const onUp = () => { isResizing.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  // "External link" confirmation modal
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalTarget, setExternalTarget] = useState<{ url: string; title: string } | null>(null);

  const confirmExternalOpen = (url: string, title: string) => {
    setExternalTarget({ url, title });
    setExternalOpen(true);
  };

  const triggerMaterialDownload = (url: string, filename: string) => {
    if (isExternalUrl(url)) {
      confirmExternalOpen(url, filename);
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await courseApi.get(id);
      const c = data.data as Course & { sections: Section[]; unsectioned: Lesson[] };
      setCourse(c);
      if (!activeLesson) {
        if (c.unsectioned?.length) setActiveLesson(c.unsectioned[0]);
        else if (c.sections?.length) {
          for (const s of c.sections) { if (s.lessons?.length) { setActiveLesson(s.lessons[0]); break; } }
        }
      }
    } catch { /* handle */ }
    finally { setLoading(false); }
  }, [id]);

  const handleDragEnd = async (result: DropResult) => {
    if (!isAdmin || !course) return;
    const { source, destination } = result;
    if (!destination) return;
    if (source.index === destination.index) return;
    
    // Build current flat list
    type FlatItem = { type: 'section' | 'lesson'; id: string; section?: Section; lesson?: Lesson };
    const items: FlatItem[] = [];
    (course.unsectioned || []).forEach(l => items.push({ type: 'lesson', id: `lesson-${l._id}`, lesson: l }));
    (course.sections || []).forEach(s => {
      items.push({ type: 'section', id: `section-${s._id}`, section: s });
      (s.lessons || []).forEach(l => items.push({ type: 'lesson', id: `lesson-${l._id}`, lesson: l }));
    });
    
    // Swap
    const [moved] = items.splice(source.index, 1);
    items.splice(destination.index, 0, moved);

    let secOrder = 0;
    let lesOrder = 0;
    
    const newSections: Section[] = [];
    const newUnsectioned: Lesson[] = [];
    let currentSection: Section | null = null;

    for (const item of items) {
      if (item.type === 'section') {
        currentSection = { ...item.section!, order: secOrder++, lessons: [] };
        newSections.push(currentSection);
        lesOrder = 0;
      } else if (item.type === 'lesson') {
        const lesson = { ...item.lesson!, order: lesOrder++ };
        if (currentSection) {
          currentSection.lessons!.push(lesson);
        } else {
          newUnsectioned.push(lesson);
        }
      }
    }
    
    setLoading(true);
    try {
      await courseApi.reorderAll(course._id, newSections, newUnsectioned);
      await fetchCourse();
    } catch {
      alert("Failed to reorder");
      setLoading(false);
    }
  };

  // ── Ping timer for progress ─────────────────────────────────────
  useEffect(() => {
    if (!activeLesson || activeLesson.type !== "video") return;
    const interval = setInterval(() => {
      authApi.updateProgress(course?._id, "in-progress", 60).catch(()=>null);
    }, 60000);
    return () => clearInterval(interval);
  }, [activeLesson, course?._id]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
    </div>
  );

  if (!course) return (
    <PageTransition className="max-w-3xl mx-auto px-4 py-8">
      <p className="text-zinc-500">Course not found.</p>
    </PageTransition>
  );

  const isVideo = activeLesson?.type === "video";
  const videoUrl = activeLesson?.videoUrl || "";
  const pdfUrl = activeLesson?.fileUrl || "";
  const materialUrls: string[] = activeLesson?.fileUrls?.length
    ? activeLesson.fileUrls
    : activeLesson?.fileUrl ? [activeLesson.fileUrl] : [];

  const renderPlayer = () => {
    if (!activeLesson) return <p className="text-zinc-500 text-sm">Select a lesson to begin</p>;
    if (isVideo && videoUrl) {
      if (isYouTubeUrl(videoUrl)) {
        return (
          <iframe
            key={videoUrl}
            src={getYouTubeEmbedUrl(videoUrl)}
            title={activeLesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full min-h-[50vw] md:min-h-0"
          />
        );
      }
      return (
        <VideoPlayer
          key={videoUrl}
          src={videoUrl}
          title={activeLesson.title}
          className="w-full h-full"
        />
      );
    }
    if (!isVideo && pdfUrl) {
      return (
        <iframe key={pdfUrl} src={pdfUrl} title={activeLesson.title}
          className="w-full h-full min-h-[60vh] md:min-h-full bg-white" />
      );
    }
    return <p className="text-zinc-500 text-sm">No media available</p>;
  };

  return (
    <PageTransition className="h-full">
      <div className="flex flex-col md:flex-row md:h-screen">

        {/* ── Left: Player ─────────────────────────────── */}
        <div className="flex flex-col" style={{ flex: "1 1 0", minWidth: 0 }}>
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50 md:static">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{course.title}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{activeLesson?.title || "Select a lesson"}</p>
            </div>
          </div>

          {/* Player area */}
          <div className="flex-1 flex flex-col items-center justify-center bg-black min-h-[240px] md:min-h-0 relative">
            <div className="w-full h-full flex items-center justify-center">
              {renderPlayer()}
            </div>
          </div>

          {/* Action Row below Player */}
          {activeLesson && (
            <div className="flex items-center justify-center gap-6 px-4 py-6 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
              {/* Favorite Button */}
              {(() => {
                const isFav = user?.favoriteLessons.includes(activeLesson._id) ?? false;
                return (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleFavoriteLesson(activeLesson._id)}
                    className="flex flex-col items-center gap-1.5 transition-all group"
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all ${
                      isFav 
                        ? "bg-red-50 dark:bg-red-900/20 text-red-500" 
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}>
                      <Heart className={`w-5 h-5 ${isFav ? "fill-current" : ""}`} />
                    </div>
                    <span className={`text-[11px] font-medium ${isFav ? "text-red-500" : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"}`}>
                      Favorite
                    </span>
                  </motion.button>
                );
              })()}

              {/* Edit Lesson Button */}
              {isAdmin && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setEditLessonOpen(true)}
                  className="flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                    Edit Lesson
                  </span>
                </motion.button>
              )}

            </div>
          )}

          {/* Materials bar — local download only */}
          {activeLesson && materialUrls.length > 0 && (
            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Materials ({materialUrls.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {materialUrls.map((url, i) => {
                  const filename = url.split("/").pop()?.split("?")[0] || `File ${i + 1}`;
                  const isExt = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => triggerMaterialDownload(url, filename)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-indigo-400 transition-colors"
                    >
                      {isExt ? <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" /> : <FileText className="w-3 h-3 text-amber-500 shrink-0" />}
                      <span className="truncate max-w-[120px]">{filename}</span>
                      <Download className="w-3 h-3 text-zinc-400 shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Resize handle (desktop only) */}
        <div
          onMouseDown={startResize}
          className="hidden md:flex w-1 cursor-col-resize hover:bg-indigo-400 bg-zinc-200 dark:bg-zinc-800 transition-colors active:bg-indigo-500 items-center justify-center"
        >
          <GripVertical className="w-3 h-3 text-zinc-400 opacity-0 hover:opacity-100 transition-opacity" />
        </div>

        {/* ── Right: Lesson list ────────────────────── */}
        <div
          className="w-full md:w-auto md:h-screen md:overflow-y-auto border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 scroll-snap-y"
          style={window.innerWidth >= 768 ? { width: `${sidebarWidth}px`, flexShrink: 0 } : { flexShrink: 0 }}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Content</h3>
            <div className="flex items-center gap-1">
              {/* Toggle reorder handles */}
              {isAdmin && (
                <button
                  onClick={() => {
                    const next = !showReorderHandle;
                    setShowReorderHandle(next);
                    try { localStorage.setItem("reorder-handle", String(next)); } catch {}
                  }}
                  className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
                  title={showReorderHandle ? "Hide reorder handles" : "Show reorder handles"}
                >
                  {showReorderHandle ? <ToggleRight className="w-4 h-4 text-indigo-500" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
              )}
            {/* + button → choice popup */}
              {isAdmin && (
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setAddChoiceOpen((v) => !v)}
                    className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
                    title="Add video or section"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>

                  {/* Choice popover */}
                  {addChoiceOpen && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-40" onClick={() => setAddChoiceOpen(false)} />
                      <div className="absolute right-0 top-7 z-50 w-44 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl overflow-hidden">
                        <button
                          onClick={() => { setAddChoiceOpen(false); setAddVideoOpen(true); }}
                          className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                        >
                          <Play className="w-4 h-4 text-indigo-500 shrink-0" />
                          Add Video
                        </button>
                        <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
                        <button
                          onClick={() => { setAddChoiceOpen(false); setAddSectionOpen(true); }}
                          className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                        >
                          <FolderDown className="w-4 h-4 text-zinc-400 shrink-0" />
                          Add Section
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sectioned content flat list */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="course-playlist" type="item">
              {(provided) => {
                // Flatten items inline
                type FlatItem = { type: 'section' | 'lesson'; id: string; section?: Section; lesson?: Lesson };
                const items: FlatItem[] = [];
                (course.unsectioned || []).forEach(l => items.push({ type: 'lesson', id: `lesson-${l._id}`, lesson: l }));
                (course.sections || []).forEach(s => {
                  items.push({ type: 'section', id: `section-${s._id}`, section: s });
                  (s.lessons || []).forEach(l => items.push({ type: 'lesson', id: `lesson-${l._id}`, lesson: l }));
                });

                return (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="pb-24">
                    {items.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!isAdmin || !showReorderHandle}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? "opacity-90 shadow-lg z-50 ring-2 ring-indigo-500 rounded-xl bg-white dark:bg-zinc-900" : ""}
                          >
                            {item.type === 'section' ? (
                              <div className="sticky top-0 z-40 bg-zinc-50 dark:bg-zinc-800/80 backdrop-blur-sm border-y border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between group">
                                <div className="flex items-center gap-2">
                                  {isAdmin && showReorderHandle && (
                                    <div {...provided.dragHandleProps} className="cursor-grab text-zinc-400 hover:text-indigo-500">
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                  )}
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                                    {item.section?.title}
                                  </h4>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center group/lesson bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800/50">
                                {isAdmin && showReorderHandle && (
                                  <div {...provided.dragHandleProps} className="p-2 cursor-grab text-zinc-300 hover:text-indigo-500 opacity-0 group-hover/lesson:opacity-100 transition-opacity">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <LessonItem
                                    lesson={item.lesson!}
                                    isActive={activeLesson?._id === item.lesson?._id}
                                    index={index}
                                    onSelect={() => {
                                      setActiveLesson(item.lesson!);
                                      authApi.updateProgress(course?._id, "in-progress").catch(()=>null);
                                    }}
                                    onMutate={fetchCourse}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {items.length === 0 && (
                      <p className="px-4 py-8 text-sm text-zinc-400 italic text-center">No content yet</p>
                    )}
                  </div>
                );
              }}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      {/* Admin add section modal */}
      {isAdmin && (
        <AdminEditModal
          open={addSectionOpen}
          onClose={() => setAddSectionOpen(false)}
          title="New Section"
          fields={[
            { label: "Section Title", key: "title", value: "", placeholder: "Chapter 1…" },
          ]}
          onSave={async (vals) => {
            await sectionApi.create({ title: vals.title, courseId: course._id });
            fetchCourse();
          }}
        />
      )}

      {/* Admin edit lesson modal */}
      {isAdmin && activeLesson && (
        <AdminEditModal
          open={editLessonOpen}
          onClose={() => setEditLessonOpen(false)}
          title="Edit Lesson"
          fields={[
            { label: "Title", key: "title", value: activeLesson.title },
            { label: "Video URL", key: "videoUrl", value: activeLesson.videoUrl || "", placeholder: "https:// or YouTube URL" },
            {
              label: "Materials",
              key: "fileUrls",
              type: "list",
              value: (activeLesson.fileUrls || []).join("\n") || activeLesson.fileUrl || "",
              placeholder: "https://… (PDF, YouTube, link…)",
              addLabel: "+ Add Material",
            },
          ]}
          onSave={async (vals) => {
            const fileUrls = String(vals.fileUrls || "").split("\n").map((u: string) => u.trim()).filter(Boolean);
            await lessonApi.update(activeLesson._id, {
              ...vals,
              fileUrls,
              fileUrl: fileUrls[0] || "",
            } as Partial<Lesson>);
            fetchCourse();
            
            // Re-fetch or update active lesson state manually here for UI responsiveness
            setActiveLesson((prev) => prev ? { ...prev, ...vals, fileUrls, fileUrl: fileUrls[0] || "" } : null);
          }}
          onDelete={async () => { 
            await lessonApi.delete(activeLesson._id); 
            setActiveLesson(null);
            fetchCourse(); 
          }}
        />
      )}

      {/* Add Video modal */}
      {isAdmin && course && (
        <AdminEditModal
          open={addVideoOpen}
          onClose={() => setAddVideoOpen(false)}
          title="Add Video"
          fields={[
            { label: "Title", key: "title", value: "", placeholder: "Video title" },
            { label: "Video URL", key: "videoUrl", value: "", placeholder: "https:// or YouTube URL" },
            {
              label: "Materials",
              key: "fileUrls",
              type: "list",
              value: "",
              placeholder: "https://… (PDF, link…)",
              addLabel: "+ Add Material",
            },
          ]}
          onSave={async (vals) => {
            const allLessons = [
              ...(course.unsectioned || []),
              ...(course.sections || []).flatMap((s) => s.lessons || []),
            ];
            const nextOrder = allLessons.length;
            const fileUrls = String(vals.fileUrls || "").split("\n").map((u) => u.trim()).filter(Boolean);
            await lessonApi.create({
              title: vals.title || "Untitled",
              videoUrl: vals.videoUrl || "",
              fileUrls,
              fileUrl: fileUrls[0] || "",
              courseId: course._id,
              sectionId: undefined,
              order: nextOrder,
              type: "video",
            });
            fetchCourse();
          }}
        />
      )}

      <ExternalLinkModal
        open={externalOpen}
        onClose={() => {
          setExternalOpen(false);
          setExternalTarget(null);
        }}
        onConfirm={() => {
          if (externalTarget) {
            window.open(externalTarget.url, "_blank", "noopener,noreferrer");
          }
          setExternalOpen(false);
          setExternalTarget(null);
        }}
        url={externalTarget?.url}
        title="Open External Link?"
        message={`" ${externalTarget?.title} " is an external link. Click confirm to open it in a new window.`}
      />
    </PageTransition>
  );
};
