import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, FolderDown, FileText, Download, ExternalLink, GripVertical, ToggleLeft, ToggleRight, Play, Heart, Edit3 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { PageTransition } from "../components/ui/PageTransition";
import { LessonAccordion } from "../components/course/LessonAccordion";
import { LessonItem } from "../components/course/LessonItem";
import { VideoPlayer } from "../components/course/VideoPlayer";
import { AdminEditModal } from "../components/admin/AdminEditModal";
import { ExternalLinkModal } from "../components/ui/ExternalLinkModal";
import { useAdmin } from "../hooks/useAdmin";
import { useAuthStore } from "../store/authStore";
import { courseApi, sectionApi, lessonApi } from "../api";
import { useDownloads } from "../hooks/useDownloads";
import { Modal } from "../components/ui/Modal";
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
  const location = useLocation();
  const isAdmin = useAdmin();
  const { user, toggleFavoriteLesson } = useAuthStore();
  const [course, setCourse] = useState<(Course & { sections: Section[]; unsectioned: Lesson[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [editActiveLessonOpen, setEditActiveLessonOpen] = useState(false);
  const [showReorderHandle, setShowReorderHandle] = useState(() => {
    try { return localStorage.getItem("reorder-handle") !== "false"; }
    catch { return true; }
  });

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [showSidebar, setShowSidebar] = useState(true);
  const isResizing = useRef(false);

  const sectionStartIndices = React.useMemo(() => {
    if (!course) return [];
    const indices: number[] = [];
    let current = course.unsectioned?.length || 0;
    (course.sections || []).forEach(sec => {
      indices.push(current);
      current += sec.lessons?.length || 0;
    });
    return indices;
  }, [course]);

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
  
  // Downloads
  const { saveInApp } = useDownloads();
  const [downloadVideoOpen, setDownloadVideoOpen] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<{ url: string; title: string; size?: number | null } | null>(null);
  const [downloadChecking, setDownloadChecking] = useState(false);

  const [downloadMaterialOpen, setDownloadMaterialOpen] = useState(false);
  const [downloadMaterialTarget, setDownloadMaterialTarget] = useState<{ url: string; title: string } | null>(null);

  const confirmExternalOpen = (url: string, title: string) => {
    setExternalTarget({ url, title });
    setExternalOpen(true);
  };

  const triggerVideoDownload = async (url: string, title: string) => {
    if (isExternalUrl(url)) {
      setDownloadTarget({ url, title, size: null });
      setDownloadVideoOpen(true);
      return;
    }
    
    setDownloadChecking(true);
    setDownloadTarget({ url, title, size: null });
    setDownloadVideoOpen(true);
    try {
      const resp = await fetch(url, { method: "HEAD" });
      const len = resp.headers.get("content-length");
      setDownloadTarget({ url, title, size: len ? Number(len) : null });
    } catch {
      setDownloadTarget({ url, title, size: null });
    } finally {
      setDownloadChecking(false);
    }
  };

  const confirmMaterialDownload = (url: string, filename: string) => {
    if (isExternalUrl(url)) {
      confirmExternalOpen(url, filename);
      return;
    }
    setDownloadMaterialTarget({ url, title: filename });
    setDownloadMaterialOpen(true);
  };

  const executeMaterialDownload = () => {
    if (!downloadMaterialTarget) return;
    const a = document.createElement("a");
    a.href = downloadMaterialTarget.url;
    a.download = downloadMaterialTarget.title;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadMaterialOpen(false);
  };

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await courseApi.get(id);
      const c = data.data as Course & { sections: Section[]; unsectioned: Lesson[] };
      setCourse(c);

      // Restore active lesson from URL, localStorage, or first item
      if (!activeLesson) {
        let defaultLesson: Lesson | null = null;
        
        // 1. Try URL param ?lesson=
        const queryParams = new URLSearchParams(location.search);
        const lessonQuery = queryParams.get("lesson");
        
        // 2. Try localStorage latest watched for this course
        const storedId = localStorage.getItem(`lastWatched_${id}`);
        const targetId = lessonQuery || storedId;

        if (targetId) {
          defaultLesson = c.unsectioned?.find(l => l._id === targetId) || null;
          if (!defaultLesson && c.sections) {
            for (const s of c.sections) {
              const found = s.lessons?.find(l => l._id === targetId);
              if (found) { defaultLesson = found; break; }
            }
          }
        }

        // 3. Fallback to very first lesson
        if (!defaultLesson) {
          if (c.unsectioned?.length) defaultLesson = c.unsectioned[0];
          else if (c.sections?.length) {
            for (const s of c.sections) {
              if (s.lessons?.length) { defaultLesson = s.lessons[0]; break; }
            }
          }
        }

        if (defaultLesson) setActiveLesson(defaultLesson);
      }
    } catch { /* handle */ }
    finally { setLoading(false); }
  }, [id, location.search, activeLesson]);

  // Save progress
  useEffect(() => {
    if (id && activeLesson) {
      localStorage.setItem(`lastWatched_${id}`, activeLesson._id);
    }
  }, [id, activeLesson]);

  const handleDragEnd = async (result: DropResult) => {
    if (!isAdmin || !course) return;
    const { source, destination, type, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    if (type === "section") {
      const newSections = Array.from(course.sections);
      const [moved] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, moved);
      setCourse({ ...course, sections: newSections });
      await sectionApi.reorder(newSections.map((s) => s._id));
    } else if (type === "lesson") {
      const newSections = Array.from(course.sections);
      const si = newSections.findIndex((s) => s._id === source.droppableId);
      const di = newSections.findIndex((s) => s._id === destination.droppableId);
      if (si === -1 || di === -1) return;
      const sLessons = Array.from(newSections[si].lessons);
      const dLessons = si === di ? sLessons : Array.from(newSections[di].lessons);
      const [moved] = sLessons.splice(source.index, 1);
      dLessons.splice(destination.index, 0, moved);
      newSections[si] = { ...newSections[si], lessons: sLessons };
      if (si !== di) newSections[di] = { ...newSections[di], lessons: dLessons };
      setCourse({ ...course, sections: newSections });
      if (si !== di) await lessonApi.update(draggableId, { sectionId: destination.droppableId });
      await lessonApi.reorder(dLessons.map((l) => l._id));
    }
  };

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
    <PageTransition className="h-[100dvh] w-full overflow-hidden flex flex-col bg-white dark:bg-zinc-950">
      <div className="flex flex-col md:flex-row flex-1 h-full min-h-0 w-full">

        {/* ── Left: Player ─────────────────────────────── */}
        <div className={`flex flex-col bg-white dark:bg-zinc-950 transition-all duration-300 ${showSidebar ? "md:flex-1" : "flex-1"} ${!showSidebar && "md:w-full"}`} style={showSidebar ? { flex: "1 1 0", minWidth: 0 } : { minWidth: 0 }}>
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50 md:static">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <div className="min-w-0 flex-1 flex items-center justify-between">
              <div className="truncate">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{course.title}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{activeLesson?.title || "Select a lesson"}</p>
              </div>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="hidden md:flex p-1.5 ml-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition flex-shrink-0"
                title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
              >
                {showSidebar ? <ToggleRight className="w-5 h-5 text-indigo-500" /> : <ToggleLeft className="w-5 h-5 text-zinc-400" />}
              </button>
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
            <div className="flex items-center justify-center gap-8 px-4 py-5 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 relative z-40 lg:pb-5 pb-8">
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
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all border ${
                      isFav 
                        ? "bg-red-50/80 dark:bg-red-900/20 text-red-500 border-red-200 dark:border-red-900/50" 
                        : "bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    }`}>
                      <Heart className={`w-5 h-5 ${isFav ? "fill-current" : ""}`} />
                    </div>
                    <span className={`text-[11px] font-semibold ${isFav ? "text-red-500" : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"}`}>
                      Favorite
                    </span>
                  </motion.button>
                );
              })()}

              {/* Download Button */}
              {activeLesson.videoUrl && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => triggerVideoDownload(activeLesson.videoUrl!, activeLesson.title)}
                  className="flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all border bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700">
                    <Download className="w-5 h-5 group-hover:text-zinc-700 dark:group-hover:text-zinc-200" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                    Download
                  </span>
                </motion.button>
              )}

              {/* Edit Button (Admin only) */}
              {isAdmin && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setEditActiveLessonOpen(true)}
                  className="flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all border bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 hover:text-indigo-500">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    Edit
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
                      onClick={() => confirmMaterialDownload(url, filename)}
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
        {showSidebar && (
          <div
            onMouseDown={startResize}
            className="hidden md:flex w-1 cursor-col-resize hover:bg-indigo-400 bg-zinc-200 dark:bg-zinc-800 transition-colors active:bg-indigo-500 items-center justify-center flex-shrink-0"
          >
            <GripVertical className="w-3 h-3 text-zinc-400 opacity-0 hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* ── Right: Lesson list ────────────────────── */}
        <div
          className={`w-full md:w-[var(--sidebar-width)] flex-1 md:flex-none flex flex-col border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-300 ${!showSidebar ? "hidden" : "flex"} overflow-hidden`}
          style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
        >
          {/* Scrollable list container */}
          <div className="flex-1 overflow-y-auto scroll-snap-y pb-20 md:pb-0">
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

              {/* Unsectioned lessons (flat import, no sections) */}
              {course.unsectioned && course.unsectioned.length > 0 && (
                <div className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <div className="px-4 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">All Lessons</span>
                  </div>
                  <div className="pb-1">
                    {course.unsectioned.map((lesson, i) => (
                      <LessonItem
                        key={lesson._id}
                        lesson={lesson}
                        isActive={activeLesson?._id === lesson._id}
                        index={i}
                        onSelect={() => setActiveLesson(lesson)}
                        onMutate={fetchCourse}
                      />
                    ))}
                  </div>
                </div>
              )}

          {/* Sectioned content */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="sections-list" type="section">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {course.sections?.filter((s) => isAdmin || s.lessons?.length > 0).map((section, index) => (
                    <Draggable key={section._id} draggableId={section._id} index={index} isDragDisabled={!isAdmin || !showReorderHandle}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? "opacity-90 shadow-lg z-50 ring-2 ring-indigo-500 rounded-xl bg-white dark:bg-zinc-900" : ""}
                        >
                          <LessonAccordion
                            section={section}
                            courseId={course._id}
                            activeLesson={activeLesson}
                            onSelectLesson={setActiveLesson}
                            onMutate={fetchCourse}
                            dragHandleProps={showReorderHandle ? provided.dragHandleProps : null}
                            showLessonGrips={showReorderHandle}
                            startIndex={sectionStartIndices[index]}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {(!course.sections || course.sections.length === 0) && (!course.unsectioned || course.unsectioned.length === 0) && (
                    <p className="px-4 py-8 text-sm text-zinc-400 italic text-center">No content yet</p>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          </div>
        </div>
      </div>

      {/* Admin add section modal */}
      {isAdmin && (
        <AdminEditModal open={addSectionOpen} onClose={() => setAddSectionOpen(false)} title="New Section"
          fields={[{ label: "Title", key: "title", value: "", placeholder: "Section title" }]}
          onSave={async (vals) => { 
            await sectionApi.create({ title: vals.title, courseId: course._id }); 
            fetchCourse(); 
            setAddSectionOpen(false); 
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

      <Modal open={downloadVideoOpen} onClose={() => setDownloadVideoOpen(false)}>
        <div className="p-5 text-center">
          <Download className="w-10 h-10 mx-auto text-indigo-500 mb-3" />
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Download Video</h2>
          {downloadTarget && isExternalUrl(downloadTarget.url) ? (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Cannot download this video directly because it is hosted externally.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    window.open(downloadTarget.url, "_blank", "noopener,noreferrer");
                    setDownloadVideoOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
                >
                  Open in New Tab
                </button>
                <button onClick={() => setDownloadVideoOpen(false)} className="w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium transition">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                Do you want to download this video in-app for offline playback, or save it to your device?
              </p>
              {downloadChecking ? (
                <div className="flex items-center justify-center gap-2 mb-6 mt-4 opacity-70">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Checking file size...</span>
                </div>
              ) : (
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-6 mt-2">
                  File size: {downloadTarget?.size ? `${(downloadTarget.size / (1024 * 1024)).toFixed(1)} MB` : "Unknown size"}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (downloadTarget) saveInApp(downloadTarget.title, downloadTarget.url);
                    setDownloadVideoOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
                >
                  Download In-App
                </button>
                <button
                  onClick={() => {
                    if (downloadTarget) confirmMaterialDownload(downloadTarget.url, downloadTarget.title);
                    setDownloadVideoOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 transition"
                >
                  Local Download
                </button>
                <button onClick={() => setDownloadVideoOpen(false)} className="w-full py-2 text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={downloadMaterialOpen} onClose={() => setDownloadMaterialOpen(false)}>
        <div className="p-5 text-center">
          <FileText className="w-10 h-10 mx-auto text-amber-500 mb-3" />
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Download File</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Do you want to download <span className="font-semibold text-zinc-700 dark:text-zinc-200">"{downloadMaterialTarget?.title}"</span> to your device?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={executeMaterialDownload}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition shadow-sm"
            >
              Download
            </button>
            <button onClick={() => setDownloadMaterialOpen(false)} className="w-full py-2 text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition">
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Active Lesson */}
      {isAdmin && activeLesson && (() => {
        // Compute visual order (index + 1) for the active lesson to match what is shown in the list
        let visualOrder = (activeLesson.order ?? 0) + 1;
        if (course) {
          const allLessons = [
            ...(course.unsectioned || []),
            ...(course.sections || []).flatMap((s) => s.lessons || []),
          ];
          const foundIdx = allLessons.findIndex(l => l._id === activeLesson._id);
          if (foundIdx !== -1) visualOrder = foundIdx + 1;
        }

        return (
          <AdminEditModal
            open={editActiveLessonOpen}
            onClose={() => setEditActiveLessonOpen(false)}
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
              { label: "Order (Visual)", key: "order", value: String(visualOrder) },
            ]}
            onSave={async (vals) => {
              const fileUrls = String(vals.fileUrls || "").split("\n").map((u: string) => u.trim()).filter(Boolean);
              // Calculate actual zero-indexed order if they meant to change it 
              const newVisualOrder = Number(vals.order);
              let dbOrder = Number.isNaN(newVisualOrder) ? activeLesson.order : newVisualOrder - 1;
              if (dbOrder! < 0) dbOrder = 0;

              await lessonApi.update(activeLesson._id, {
                ...vals,
                fileUrls,
                fileUrl: fileUrls[0] || "",
                order: dbOrder,
              } as Partial<Lesson>);
              fetchCourse();
              setEditActiveLessonOpen(false);
            }}
          onDelete={async () => {
            await lessonApi.delete(activeLesson._id);
            setActiveLesson(null);
            fetchCourse();
            setEditActiveLessonOpen(false);
          }}
        />
        );
      })()}
    </PageTransition>
  );
};
