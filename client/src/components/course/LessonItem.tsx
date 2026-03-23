import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, FileText, Heart, Edit3, ExternalLink, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useAdmin } from "../../hooks/useAdmin";
import { useAuthStore } from "../../store/authStore";
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

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

function getFilename(url: string) {
  try { return decodeURIComponent(url.split("/").pop()?.split("?")[0] || url); }
  catch { return url; }
}

export const LessonItem = ({ lesson, isActive, index, onSelect, onMutate }: Props) => {
  const isAdmin = useAdmin();
  const { user, toggleFavoriteLesson } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);

  const isFav = user?.favoriteLessons.includes(lesson._id) ?? false;
  const isVideo = lesson.type === "video";

  // All material URLs (deduplicated)
  const materials: string[] = lesson.fileUrls?.length
    ? lesson.fileUrls
    : lesson.fileUrl ? [lesson.fileUrl] : [];

  const handleMaterialClick = (url: string) => {
    // Try native download; if cross-origin blocked it'll just open the link
    const a = document.createElement("a");
    a.href = url;
    a.download = getFilename(url);
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <motion.div variants={itemVariants}>
        {/* Main lesson row */}
        <div
          className={`flex items-center gap-2 px-3 py-2 ml-3 mr-2 rounded-lg cursor-pointer transition-colors duration-150 ${
            isActive
              ? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          }`}
          onClick={onSelect}
        >
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

          {/* Title — scrollable if long */}
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
            <span className={`text-sm whitespace-nowrap ${
              isActive ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-zinc-700 dark:text-zinc-300"
            }`}>
              {lesson.title}
            </span>
          </div>

          {/* Actions — always aligned right */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Favorite */}
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); toggleFavoriteLesson(lesson._id); }}
              className={`p-1 rounded transition-colors ${isFav ? "text-red-500" : "text-zinc-400 hover:text-red-400"}`}
              title="Toggle favorite"
            >
              <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
            </motion.button>

            {/* Materials toggle (if any) */}
            {materials.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); setShowMaterials((v) => !v); }}
                className="p-1 rounded text-zinc-400 hover:text-amber-500 transition-colors"
                title={`${materials.length} material${materials.length !== 1 ? "s" : ""}`}
              >
                {showMaterials ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </motion.button>
            )}

            {/* Admin edit */}
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
                className="p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
                title="Edit lesson"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Materials — expandable, local-download only */}
        <AnimatePresence>
          {showMaterials && materials.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden ml-11 mr-2 mb-1"
            >
              <div className="flex flex-col gap-1 py-1">
                {materials.map((url, i) => {
                  const name = getFilename(url);
                  const isLink = isYouTube(url) || url.startsWith("http");
                  return (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); handleMaterialClick(url); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-left hover:border-amber-400 dark:hover:border-amber-500/40 transition-colors group"
                    >
                      {isLink ? (
                        <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" />
                      ) : (
                        <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1">{name}</span>
                      <Download className="w-3 h-3 text-zinc-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Admin edit modal — multiple video URLs + materials */}
      {isAdmin && (
        <AdminEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title="Edit Lesson"
          fields={[
            { label: "Title", key: "title", value: lesson.title },
            { label: "Video URL", key: "videoUrl", value: lesson.videoUrl || "", placeholder: "https:// or YouTube URL" },
            { label: "Materials (one URL per line)", key: "fileUrls", value: (lesson.fileUrls || []).join("\n") || lesson.fileUrl || "", placeholder: "https://..." },
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
