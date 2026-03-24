import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, FolderDown, FileText, Download, ExternalLink, GripVertical, ToggleLeft, ToggleRight, Play, Heart } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { PageTransition } from "../components/ui/PageTransition";
import { LessonAccordion } from "../components/course/LessonAccordion";
import { LessonItem } from "../components/course/LessonItem";
import { VideoPlayer } from "../components/course/VideoPlayer";
import { AdminEditModal } from "../components/admin/AdminEditModal";
import { DownloadModal, type DownloadMode } from "../components/ui/DownloadModal";
import { DownloadsDrawer } from "../components/ui/DownloadsDrawer";
import { ExternalLinkModal } from "../components/ui/ExternalLinkModal";
import { useAdmin } from "../hooks/useAdmin";
import { useAuthStore } from "../store/authStore";
import { useDownloads } from "../hooks/useDownloads";
import { courseApi, sectionApi, lessonApi } from "../api";
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

  // ── Downloads ───────────────────────────────────────────────
  const { items: downloads, progress: dlProgress, saveInApp, deleteItem: deleteDl, openItem: openDl } = useDownloads();
  const [dlModalOpen, setDlModalOpen] = useState(false);
  const [dlDrawerOpen, setDlDrawerOpen] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ url: string; title: string } | null>(null);
  const [dlInProgress, setDlInProgress] = useState(false);
  const inProgressId = Array.from(dlProgress.keys())[0];
  const inProgressPct = inProgressId ? dlProgress.get(inProgressId) : undefined;

  // "External link" confirmation modal
  const [externalOpen, setExternalOpen] = useState(false);
  const [externalTarget, setExternalTarget] = useState<{ url: string; title: string } | null>(null);

  const confirmExternalOpen = (url: string, title: string) => {
    setExternalTarget({ url, title });
    setExternalOpen(true);
  };

  const triggerVideoDownload = (url: string, title: string) => {
    if (isExternalUrl(url)) {
      confirmExternalOpen(url, title);
      return;
    }
    setPendingDownload({ url, title });
    setDlModalOpen(true);
  };

  const triggerMaterialDownload = (url: string) => {
    // Materials: local download only (or open link if external)
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop()?.split("?")[0] || "file";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadModeSelect = async (mode: DownloadMode) => {
    if (!pendingDownload) return;
    if (mode === "local") {
      const a = document.createElement("a");
      a.href = pendingDownload.url;
      a.download = pendingDownload.title;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDlModalOpen(false);
      setPendingDownload(null);
    } else {
      setDlInProgress(true);
      try { await saveInApp(pendingDownload.title, pendingDownload.url); }
      catch { alert("In-app save failed. The file may not allow cross-origin access."); }
      finally { setDlInProgress(false); setDlModalOpen(false); setPendingDownload(null); }
    }
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
            {/* Downloads drawer trigger */}
            <button onClick={() => setDlDrawerOpen(true)} className="relative p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500" title="In-app downloads">
              <FolderDown className="w-4 h-4" />
              {downloads.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center">
                  {downloads.length}
                </span>
              )}
            </button>
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

              {/* Download Button */}
              {activeLesson.type === "video" && !isExternalUrl(activeLesson.videoUrl || "") && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => triggerVideoDownload(activeLesson.videoUrl!, activeLesson.title)}
                  className="flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center shadow-md transition-all">
                    <Download className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                    Download
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
                      onClick={() => triggerMaterialDownload(url)}
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
          className="w-full md:h-screen md:overflow-y-auto border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 scroll-snap-y"
          style={{ width: `${sidebarWidth}px`, flexShrink: 0 }}
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
                  {course.sections?.filter((s) => s.lessons?.length > 0).map((section, index) => (
                    <Draggable key={section._id} draggableId={section._id} index={index} isDragDisabled={!isAdmin || !showReorderHandle}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? "opacity-90 shadow-lg z-50 ring-2 ring-indigo-500 rounded-xl bg-white dark:bg-zinc-900" : ""}
                        >
                          <LessonAccordion
                            section={section}
                            activeLesson={activeLesson}
                            onSelectLesson={setActiveLesson}
                            onMutate={fetchCourse}
                            dragHandleProps={showReorderHandle ? provided.dragHandleProps : null}
                            showLessonGrips={showReorderHandle}
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

      {/* Admin add section modal */}
      {isAdmin && (
        <AdminEditModal open={addSectionOpen} onClose={() => setAddSectionOpen(false)} title="New Section"
          fields={[{ label: "Title", key: "title", value: "", placeholder: "Section title" }]}
          onSave={async (vals) => { await sectionApi.create({ title: vals.title, courseId: course._id }); fetchCourse(); }}
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
          title="Open External Platform?"
          message={`" ${externalTarget?.title} " is hosted on an external video player. Click confirm to watch it in a new window.`}
        />

      {/* Download mode prompt — local video only */}
      <DownloadModal
        open={dlModalOpen}
        filename={pendingDownload?.title || ""}
        onSelect={handleDownloadModeSelect}
        onClose={() => { if (!dlInProgress) { setDlModalOpen(false); setPendingDownload(null); } }}
        isDownloading={dlInProgress}
        progress={inProgressPct}
      />

      {/* In-app downloads manager */}
      <DownloadsDrawer open={dlDrawerOpen} onClose={() => setDlDrawerOpen(false)} items={downloads} onDelete={deleteDl} onOpen={openDl} />
    </PageTransition>
  );
};
