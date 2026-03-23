import { useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  FileText,
  Download,
  Heart,
  Edit3,
} from "lucide-react";
import { useAdmin } from "../../hooks/useAdmin";
import { useAuthStore } from "../../store/authStore";
import { AdminEditModal } from "../admin/AdminEditModal";
import { lessonApi } from "../../api";
import type { Lesson } from "../../types";

interface Props {
  lesson: Lesson;
  isActive: boolean;
  onSelect: () => void;
  onMutate: () => void;
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

export const LessonItem = ({ lesson, isActive, onSelect, onMutate }: Props) => {
  const isAdmin = useAdmin();
  const { user, toggleFavoriteLesson } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);

  const isFav = user?.favoriteLessons.includes(lesson._id) ?? false;
  const isVideo = lesson.type === "video";
  const url = isVideo ? lesson.videoUrl : lesson.fileUrl;

  return (
    <>
      <motion.div
        variants={itemVariants}
        onClick={onSelect}
        className={`flex items-center justify-between px-4 py-2.5 ml-6 mr-2 rounded-lg cursor-pointer transition-colors duration-150 ${
          isActive
            ? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
        }`}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
              isActive
                ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {isVideo ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
          </div>
          <span
            className={`text-sm truncate ${
              isActive
                ? "font-medium text-indigo-700 dark:text-indigo-300"
                : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {lesson.title}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5 shrink-0 ml-2">
          {/* Favorite */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteLesson(lesson._id);
            }}
            className={`p-1 rounded transition-colors ${
              isFav ? "text-red-500" : "text-zinc-400 hover:text-red-400"
            }`}
            title="Toggle favorite"
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
          </motion.button>

          {/* Download */}
          {url && (
            <a
              href={url}
              download
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Admin edit */}
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
              title="Edit lesson"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Admin edit modal */}
      {isAdmin && (
        <AdminEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title="Edit Lesson"
          fields={[
            { label: "Title", key: "title", value: lesson.title },
            { label: "Video URL", key: "videoUrl", value: lesson.videoUrl || "" },
            { label: "File URL", key: "fileUrl", value: lesson.fileUrl || "" },
            { label: "Type", key: "type", value: lesson.type, placeholder: "video or pdf" },
          ]}
          onSave={async (vals) => {
            await lessonApi.update(lesson._id, vals as Partial<Lesson>);
            onMutate();
          }}
          onDelete={async () => {
            await lessonApi.delete(lesson._id);
            onMutate();
          }}
        />
      )}
    </>
  );
};
