import { useState } from "react";
import { motion } from "framer-motion";
import { Play, FileText, Edit3 } from "lucide-react";
import { useAdmin } from "../../hooks/useAdmin";
import { AdminEditModal } from "../admin/AdminEditModal";
import { lessonApi } from "../../api";
import type { Lesson } from "../../types";

interface Props {
  lesson: Lesson;
  isActive: boolean;
  index: number;
  onSelect: () => void;
  onMutate: () => void;
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

export const LessonItem = ({ lesson, isActive, index, onSelect, onMutate }: Props) => {
  const isAdmin = useAdmin();
  const [editOpen, setEditOpen] = useState(false);

  const isVideo = lesson.type === "video";
  const materials: string[] = lesson.fileUrls?.length
    ? lesson.fileUrls
    : lesson.fileUrl ? [lesson.fileUrl] : [];

  return (
    <>
      <motion.div variants={itemVariants}>
        {/* ── Main lesson row — click to select ──────────── */}
        <div
          className={`px-3 py-2 ml-3 mr-2 rounded-lg cursor-pointer transition-colors duration-150 ${
            isActive
              ? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          }`}
          onClick={onSelect}
        >
          {/* Top row: number + icon + title (scrollable) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {/* Order number */}
            <span className={`shrink-0 text-[10px] font-bold tabular-nums w-5 text-center ${
              isActive ? "text-indigo-500" : "text-zinc-400"
            }`}>
              {index + 1}
            </span>

            {/* Type icon */}
            <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
              isActive
                ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            }`}>
              {isVideo ? <Play className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            </div>

            {/* Title — scrolls horizontally if long (mobile) */}
            <div 
              className="min-w-0 flex-1 overflow-x-auto scrollbar-none lesson-title-scroll"
              title={lesson.title}
            >
              <span className={`text-sm whitespace-nowrap block ${
                isActive ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-zinc-700 dark:text-zinc-300"
              }`}>
                {lesson.title}
              </span>
            </div>
          </div>

          {/* Bottom row: ❤️ + ✏️ — only when active or always visible */}
          <div
            className="flex items-center gap-1 mt-1 ml-7"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Admin edit */}
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setEditOpen(true)}
                className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
                title="Edit lesson"
              >
                <Edit3 className={`w-3.5 h-3.5 ${isActive ? "text-indigo-500/80" : ""}`} />
              </motion.button>
            )}

            {/* Material count badge (no expand button — materials shown below player) */}
            {materials.length > 0 && (
              <span className="text-[10px] text-amber-500 font-medium ml-1">
                {materials.length} file{materials.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Materials are shown in the player area (CourseViewerPage), not here */}
      </motion.div>

      {/* Admin edit modal */}
      {isAdmin && (
        <AdminEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title="Edit Lesson"
          fields={[
            { label: "Title", key: "title", value: lesson.title },
            { label: "Video URL", key: "videoUrl", value: lesson.videoUrl || "", placeholder: "https:// or YouTube URL" },
            {
              label: "Materials",
              key: "fileUrls",
              type: "list",
              value: (lesson.fileUrls || []).join("\n") || lesson.fileUrl || "",
              placeholder: "https://… (PDF, YouTube, link…)",
              addLabel: "+ Add Material",
            },
            { label: "Order", key: "order", value: String(lesson.order ?? index) },
          ]}
          onSave={async (vals) => {
            const fileUrls = String(vals.fileUrls || "").split("\n").map((u: string) => u.trim()).filter(Boolean);
            await lessonApi.update(lesson._id, {
              ...vals,
              fileUrls,
              fileUrl: fileUrls[0] || "",
              order: Number(vals.order) || 0,
            } as Partial<Lesson>);
            onMutate();
          }}
          onDelete={async () => { await lessonApi.delete(lesson._id); onMutate(); }}
        />
      )}
    </>
  );
};
