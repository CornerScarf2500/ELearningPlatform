import { motion } from "framer-motion";
import { Play, FileText } from "lucide-react";
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

export const LessonItem = ({ lesson, isActive, index, onSelect }: Props) => {
  const isVideo = lesson.type === "video";

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
              <span className={`text-sm whitespace-nowrap block pr-2 ${
                isActive ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-zinc-700 dark:text-zinc-300"
              }`}>
                {lesson.title}
              </span>
            </div>

            {/* Actions */}
            <div
              className="flex items-center gap-1 shrink-0 bg-white/50 dark:bg-zinc-900/50 rounded"
              onClick={(e) => e.stopPropagation()}
            >
            </div>
          </div>
        </div>

        {/* Materials are shown in the player area (CourseViewerPage), not here */}
      </motion.div>
    </>
  );
};
