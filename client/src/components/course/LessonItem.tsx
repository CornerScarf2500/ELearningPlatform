import { useState } from "react";
import { motion } from "framer-motion";
import { Play, FileText } from "lucide-react";
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

  return (
    <>
      <motion.div variants={itemVariants}>
        {/* ── Main lesson row — click to select ──────────── */}
        <div
          className={`px-3 py-2.5 mx-2 md:ml-3 md:mr-2 rounded-lg cursor-pointer transition-colors duration-150 ${
            isActive
              ? "bg-indigo-50/80 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          }`}
          onClick={onSelect}
        >
          {/* Top row: number + icon + title (scrollable) */}
          <div className="flex items-center gap-2.5">
            {/* Order number */}
            <span className={`shrink-0 text-[13px] font-bold tabular-nums w-5 text-center ${
              isActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"
            }`}>
              {index + 1}
            </span>

            {/* Type icon */}
            <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
              isActive
                ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            }`}>
              {isVideo ? <Play className="w-[16px] h-[16px]" fill="currentColor" /> : <FileText className="w-[16px] h-[16px]" />}
            </div>

            {/* Title — scrolls horizontally if long (mobile) */}
            <div 
              className="min-w-0 flex-1 overflow-x-auto scrollbar-none"
              title={lesson.title}
            >
              <span className={`text-[13px] leading-[1.4] whitespace-nowrap block pr-2 ${
                isActive ? "font-semibold text-indigo-700 dark:text-indigo-300" : "font-medium text-zinc-700 dark:text-zinc-300"
              }`}>
                {lesson.title}
              </span>
            </div>
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
              type: "material-list",
              value: JSON.stringify(lesson.fileUrls?.length ? lesson.fileUrls : lesson.fileUrl ? [lesson.fileUrl] : []),
              placeholder: "https://… (PDF, YouTube, link…)",
              addLabel: "+ Add Material",
            },
            { label: "Order", key: "order", value: String(lesson.order ?? index) },
          ]}
          onSave={async (vals) => {
            let fileUrls: any[] = [];
            let fileUrl = "";
            try {
              const parsed = JSON.parse(vals.fileUrls || "[]");
              if (Array.isArray(parsed)) {
                fileUrls = parsed.filter((item: any) => {
                  if (typeof item === "string") return item.trim();
                  return item?.url?.trim();
                });
                fileUrl = fileUrls.length > 0
                  ? (typeof fileUrls[0] === "string" ? fileUrls[0] : fileUrls[0].url)
                  : "";
              }
            } catch {}
            await lessonApi.update(lesson._id, {
              ...vals,
              fileUrls,
              fileUrl,
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
