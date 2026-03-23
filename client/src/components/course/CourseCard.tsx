import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Edit3, Heart } from "lucide-react";
import { useAdmin } from "../../hooks/useAdmin";
import { useAuthStore } from "../../store/authStore";
import { AdminEditModal } from "../admin/AdminEditModal";
import { courseApi } from "../../api";
import type { Course, Platform } from "../../types";

interface Props {
  course: Course;
  index: number;
  onMutate: () => void;
}

export const CourseCard = ({ course, index, onMutate }: Props) => {
  const navigate = useNavigate();
  const isAdmin = useAdmin();
  const { user, toggleFavoriteCourse } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);

  const isFav = user?.favoriteCourses.includes(course._id) ?? false;
  const platformName =
    typeof course.platformId === "object"
      ? (course.platformId as Platform).name
      : "";

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
        onClick={() => navigate(`/course/${course._id}`)}
        className="group flex items-center justify-between px-4 py-3.5 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-500/30 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all duration-150"
      >
        {/* Left: icon + text */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {course.title}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {course.teacher}
              {platformName && ` · ${platformName}`}
              {course.subject && ` · ${course.subject}`}
            </p>
          </div>
        </div>

        {/* Right: actions */}
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
      </motion.div>

      {/* Admin edit modal */}
      {isAdmin && (
        <AdminEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title="Edit Course"
          fields={[
            { label: "Title", key: "title", value: course.title },
            { label: "Subject", key: "subject", value: course.subject },
            { label: "Teacher", key: "teacher", value: course.teacher },
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
