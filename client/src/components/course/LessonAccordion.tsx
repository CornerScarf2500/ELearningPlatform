import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Edit3, Plus } from "lucide-react";
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
}

export const LessonAccordion = ({
  section,
  activeLesson,
  onSelectLesson,
  onMutate,
}: Props) => {
  const [open, setOpen] = useState(true);
  const isAdmin = useAdmin();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <motion.div
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </motion.div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
            {section.title}
          </span>
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
      </button>

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
              className="pb-1"
            >
              {section.lessons.map((lesson) => (
                <LessonItem
                  key={lesson._id}
                  lesson={lesson}
                  isActive={activeLesson?._id === lesson._id}
                  onSelect={() => onSelectLesson(lesson)}
                  onMutate={onMutate}
                />
              ))}

              {section.lessons.length === 0 && (
                <p className="px-10 py-3 text-xs text-zinc-400 italic">
                  No lessons in this section
                </p>
              )}
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
                sectionId: section._id,
                type: (vals.type as "video" | "pdf") || "video",
              } as Partial<Lesson> & { sectionId: string });
              onMutate();
            }}
          />
        </>
      )}
    </div>
  );
};
