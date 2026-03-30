import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Edit3, Plus, GripVertical } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { useAdmin } from "../../hooks/useAdmin";
import { AdminEditModal } from "../admin/AdminEditModal";
import { LessonItem } from "./LessonItem";
import { sectionApi, lessonApi } from "../../api";
import type { Section, Lesson } from "../../types";

interface Props {
  section: Section;
  activeLesson: Lesson | null;
  onSelectLesson: (lesson: Lesson) => void;
  onMutate: () => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  showLessonGrips?: boolean;
  startIndex?: number;
}

export const LessonAccordion = ({
  section,
  activeLesson,
  onSelectLesson,
  onMutate,
  dragHandleProps,
  showLessonGrips = true,
  startIndex = 0,
}: Props) => {
  const [open, setOpen] = useState(true);
  const isAdmin = useAdmin();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      {/* Section header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-zinc-900 shadow-sm w-full flex items-center justify-between px-2 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group">
        <div className="flex items-center gap-1 min-w-0">
          {isAdmin && dragHandleProps && (
            <div {...dragHandleProps} className="p-1.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4 text-zinc-400" />
            </div>
          )}
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </motion.div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate text-left">
              {section.title}
            </span>
          </button>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen(true);
              }}
              className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
              title="Add lesson"
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
              title="Edit section"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        )}
      </div>

      {/* Animated lesson list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.05 } },
                hidden: {},
              }}
            >
              <Droppable droppableId={section._id} type="lesson">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="pb-1"
                  >
                    {section.lessons.map((lesson, i) => (
                      <Draggable key={lesson._id} draggableId={lesson._id} index={i} isDragDisabled={!isAdmin || !showLessonGrips}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? "opacity-90 shadow-lg relative z-50 bg-white dark:bg-zinc-900 rounded-lg ring-1 ring-indigo-500" : ""}
                          >
                            <div className="flex items-center">
                              {isAdmin && showLessonGrips && (
                                <div {...provided.dragHandleProps} className="p-1 ml-1 cursor-grab text-zinc-300 hover:text-zinc-500 dark:text-zinc-700 dark:hover:text-zinc-500">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <div className="flex-1">
                                <LessonItem
                                  key={lesson._id}
                                  lesson={lesson}
                                  isActive={activeLesson?._id === lesson._id}
                                  index={startIndex + i}
                                  onSelect={() => onSelectLesson(lesson)}
                                  onMutate={onMutate}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {section.lessons.length === 0 && (
                      <p className="px-10 py-3 text-xs text-zinc-400 italic">
                        No lessons in this section
                      </p>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin modals */}
      {isAdmin && (
        <>
          <AdminEditModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            title="Edit Section"
            fields={[
              { label: "Title", key: "title", value: section.title },
            ]}
            onSave={async (vals) => {
              await sectionApi.update(section._id, vals as Partial<Section>);
              onMutate();
            }}
            onDelete={async () => {
              await sectionApi.delete(section._id);
              onMutate();
            }}
          />

          <AdminEditModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            title="Add Lesson"
            fields={[
              { label: "Title", key: "title", value: "", placeholder: "Lesson title" },
              { label: "Video URL", key: "videoUrl", value: "", placeholder: "https://..." },
              { label: "File URL (optional)", key: "fileUrl", value: "", placeholder: "https://..." },
              { label: "Type", key: "type", value: "video", placeholder: "video or pdf" },
            ]}
            onSave={async (vals) => {
              await lessonApi.create({
                ...vals,
                courseId: section.courseId,
                sectionId: section._id,
                type: (vals.type as "video" | "pdf") || "video",
              } as Partial<Lesson> & { courseId: string; sectionId: string });
              onMutate();
            }}
          />
        </>
      )}
    </div>
  );
};
