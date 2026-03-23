import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Loader2, Download, FolderDown, FileText } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { PageTransition } from "../components/ui/PageTransition";
import { LessonAccordion } from "../components/course/LessonAccordion";
import { VideoPlayer } from "../components/course/VideoPlayer";
import { AdminEditModal } from "../components/admin/AdminEditModal";
import { DownloadModal, type DownloadMode } from "../components/ui/DownloadModal";
import { DownloadsDrawer } from "../components/ui/DownloadsDrawer";
import { useAdmin } from "../hooks/useAdmin";
import { useDownloads } from "../hooks/useDownloads";
import { courseApi, sectionApi, lessonApi } from "../api";
import type { Course, Section, Lesson } from "../types";

export const CourseViewerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const [course, setCourse] = useState<(Course & { sections: Section[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  // ── Downloads ───────────────────────────────────────────────
  const { items: downloads, progress: dlProgress, saveInApp, deleteItem: deleteDl, openItem: openDl } = useDownloads();
  const [dlModalOpen, setDlModalOpen] = useState(false);
  const [dlDrawerOpen, setDlDrawerOpen] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ url: string; title: string } | null>(null);
  const [dlInProgress, setDlInProgress] = useState(false);
  const inProgressId = pendingDownload ? Array.from(dlProgress.entries())[0]?.[0] : undefined;
  const inProgressPct = inProgressId ? dlProgress.get(inProgressId) : undefined;

  const triggerDownload = (url: string, title: string) => {
    setPendingDownload({ url, title });
    setDlModalOpen(true);
  };

  const handleDownloadModeSelect = async (mode: DownloadMode) => {
    if (!pendingDownload) return;
    if (mode === "local") {
      // Native browser download
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
      // In-app: fetch + IndexedDB
      setDlInProgress(true);
      try {
        await saveInApp(pendingDownload.title, pendingDownload.url);
      } catch (e) {
        alert("Download failed. The file may not allow cross-origin access.");
      } finally {
        setDlInProgress(false);
        setDlModalOpen(false);
        setPendingDownload(null);
      }
    }
  };

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await courseApi.get(id);
      const c = data.data as Course & { sections: Section[] };
      setCourse(c);
      if (!activeLesson && c.sections?.length) {
        for (const s of c.sections) {
          if (s.lessons?.length) { setActiveLesson(s.lessons[0]); break; }
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
      const sIndex = newSections.findIndex((s) => s._id === source.droppableId);
      const dIndex = newSections.findIndex((s) => s._id === destination.droppableId);
      if (sIndex === -1 || dIndex === -1) return;
      const sourceLessons = Array.from(newSections[sIndex].lessons);
      const destLessons = sIndex === dIndex ? sourceLessons : Array.from(newSections[dIndex].lessons);
      const [moved] = sourceLessons.splice(source.index, 1);
      destLessons.splice(destination.index, 0, moved);
      newSections[sIndex] = { ...newSections[sIndex], lessons: sourceLessons };
      if (sIndex !== dIndex) newSections[dIndex] = { ...newSections[dIndex], lessons: destLessons };
      setCourse({ ...course, sections: newSections });
      if (sIndex !== dIndex) await lessonApi.update(draggableId, { sectionId: destination.droppableId });
      await lessonApi.reorder(destLessons.map((l) => l._id));
    }
  };

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

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
  // All material URLs for this lesson
  const materialUrls: string[] = activeLesson?.fileUrls?.length
    ? activeLesson.fileUrls
    : activeLesson?.fileUrl ? [activeLesson.fileUrl] : [];

  return (
    <PageTransition className="h-full">
      <div className="flex flex-col md:flex-row md:h-screen">
        {/* ── Left: Player (70% on desktop) ───────────── */}
        <div className="w-full md:w-[70%] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-50 md:static">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{course.title}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {activeLesson?.title || "Select a lesson"}
              </p>
            </div>
            {/* Downloads drawer trigger */}
            <button
              onClick={() => setDlDrawerOpen(true)}
              className="relative p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
              title="In-app downloads"
            >
              <FolderDown className="w-4 h-4" />
              {downloads.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center">
                  {downloads.length}
                </span>
              )}
            </button>
          </div>

          {/* Player area */}
          <div className="flex-1 bg-black flex items-center justify-center min-h-[240px] md:min-h-0">
            {activeLesson ? (
              isVideo && videoUrl ? (
                <VideoPlayer
                  key={videoUrl}
                  src={videoUrl}
                  title={activeLesson.title}
                  className="w-full h-full"
                  onDownload={() => triggerDownload(videoUrl, activeLesson.title)}
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
              <p className="text-zinc-500 text-sm">Select a lesson to begin</p>
            )}
          </div>

          {/* Materials bar (below player) */}
          {activeLesson && materialUrls.length > 0 && (
            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Materials ({materialUrls.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {materialUrls.map((url, i) => {
                  const filename = url.split("/").pop()?.split("?")[0] || `Material ${i + 1}`;
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => triggerDownload(url, filename)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate max-w-[120px]">{filename}</span>
                      <Download className="w-3 h-3 text-zinc-400 shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Lesson list (30% on desktop) ────── */}
        <div className="w-full md:w-[30%] md:h-screen md:overflow-y-auto border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Content</h3>
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setAddSectionOpen(true)}
                className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
                title="Add section"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            )}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="sections-list" type="section">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {course.sections?.map((section, index) => (
                    <Draggable key={section._id} draggableId={section._id} index={index} isDragDisabled={!isAdmin}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? "opacity-90 shadow-lg relative z-50 ring-2 ring-indigo-500 rounded-xl bg-white dark:bg-zinc-900" : ""}
                        >
                          <LessonAccordion
                            section={section}
                            activeLesson={activeLesson}
                            onSelectLesson={setActiveLesson}
                            onMutate={fetchCourse}
                            dragHandleProps={provided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {(!course.sections || course.sections.length === 0) && (
                    <p className="px-4 py-8 text-sm text-zinc-400 italic text-center">No sections yet</p>
                  )}
                </div>
              )}
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
          fields={[{ label: "Title", key: "title", value: "", placeholder: "Section title" }]}
          onSave={async (vals) => {
            await sectionApi.create({ title: vals.title, courseId: course._id });
            fetchCourse();
          }}
        />
      )}

      {/* Download mode prompt */}
      <DownloadModal
        open={dlModalOpen}
        filename={pendingDownload?.title || ""}
        onSelect={handleDownloadModeSelect}
        onClose={() => { if (!dlInProgress) { setDlModalOpen(false); setPendingDownload(null); } }}
        isDownloading={dlInProgress}
        progress={inProgressPct}
      />

      {/* In-app downloads manager */}
      <DownloadsDrawer
        open={dlDrawerOpen}
        onClose={() => setDlDrawerOpen(false)}
        items={downloads}
        onDelete={deleteDl}
        onOpen={openDl}
      />
    </PageTransition>
  );
};
