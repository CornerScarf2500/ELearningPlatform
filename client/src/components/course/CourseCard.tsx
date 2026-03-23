import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Edit3, Heart } from "lucide-react";
import { useAdmin } from "../../hooks/useAdmin";
import { useAuthStore } from "../../store/authStore";
import { AdminEditModal } from "../admin/AdminEditModal";
import { courseApi } from "../../api";
import type { Course } from "../../types";

interface Props {
  course: Course;
  index: number;
  onMutate: () => void;
  isSelectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  suggestions?: {
    teachers: string[];
    subjects: string[];
    grades: string[];
    platformNames: string[];
  };
}

export const CourseCard = ({ course, index, onMutate, isSelectMode, selected, onToggleSelect, suggestions }: Props) => {
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const { user, toggleFavoriteCourse } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);

  const isFav = user?.favoriteCourses.includes(course._id) ?? false;
  const platformName = course.platformName || "";
  const logoUrl = course.platformLogoUrl || "";

  const handleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavoriteCourse(course._id);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.25 }}
        onClick={() => {
          if (isSelectMode && onToggleSelect) {
            onToggleSelect();
          } else {
            navigate(`/course/${course._id}`);
          }
        }}
        className={`group flex items-center justify-between px-4 py-3.5 rounded-xl cursor-pointer border transition-all duration-150 ${
          selected
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500"
            : "border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-500/30 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
      >
        {/* Left: icon + text */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isSelectMode ? (
            <div
              className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                selected
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"
              }`}
            >
              {selected && (
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          ) : logoUrl ? (
            <img src={logoUrl} alt={platformName} className="shrink-0 w-10 h-10 rounded-lg object-contain bg-zinc-100 dark:bg-zinc-800 p-1" />
          ) : (
            <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          )}
          
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {course.title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {course.grade !== "Unknown" && `${course.grade} · `}
              {course.teacher}
              {platformName && ` · ${platformName}`}
              {course.subject && ` · ${course.subject}`}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        {!isSelectMode && (
          <div className="flex items-center gap-1 shrink-0 ml-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleFav}
            className={`p-1.5 rounded-md transition-colors ${
              isFav
                ? "text-red-500"
                : "text-zinc-400 hover:text-red-400"
            }`}
            title="Toggle favorite"
          >
            <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
          </motion.button>

          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-500 transition-colors"
              title="Edit course"
            >
              <Edit3 className="w-4 h-4" />
            </motion.button>
          )}
        </div>
        )}
      </motion.div>

      {/* Admin edit modal */}
      {isAdmin && (
        <AdminEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title="Edit Course"
          fields={[
            { label: "Title", key: "title", value: course.title },
            { label: "Subject", key: "subject", value: course.subject, type: "suggest", suggestions: suggestions?.subjects, placeholder: "Mathematics…" },
            { label: "Teacher", key: "teacher", value: course.teacher, type: "suggest", suggestions: suggestions?.teachers, placeholder: "Teacher name" },
            { label: "Grade", key: "grade", value: course.grade || "", type: "suggest", suggestions: suggestions?.grades, placeholder: "Grade 10" },
            { label: "Platform Name", key: "platformName", value: course.platformName || "", type: "suggest", suggestions: suggestions?.platformNames, placeholder: "YouTube…" },
            { label: "Platform Logo URL", key: "platformLogoUrl", value: course.platformLogoUrl || "", placeholder: "https://…" },
          ]}
          onSave={async (vals) => {
            await courseApi.update(course._id, vals);
            onMutate();
          }}
          onDelete={async () => {
            await courseApi.delete(course._id);
            onMutate();
          }}
        />
      )}
    </>
  );
};
