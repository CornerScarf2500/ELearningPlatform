import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Trash2, Play, FileText, HardDrive } from "lucide-react";
import type { DownloadItem } from "../../hooks/useDownloads";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface DownloadsDrawerProps {
  open: boolean;
  onClose: () => void;
  items: DownloadItem[];
  onDelete: (id: string) => void;
  onOpen: (item: DownloadItem) => void;
}

export const DownloadsDrawer = ({ open, onClose, items, onDelete, onOpen }: DownloadsDrawerProps) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const totalSize = items.reduce((s, i) => s + i.size, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-500" />
                  In-App Downloads
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {items.length} file{items.length !== 1 && "s"} · {formatBytes(totalSize)}
                </p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <HardDrive className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No in-app downloads yet</p>
                </div>
              )}
              {items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.filetype === "video"
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500"
                      : "bg-amber-50 dark:bg-amber-500/10 text-amber-500"
                  }`}>
                    {item.filetype === "video"
                      ? <Play className="w-3.5 h-3.5" />
                      : <FileText className="w-3.5 h-3.5" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                      onClick={() => onOpen(item)}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatBytes(item.size)} · {formatDate(item.savedAt)}
                    </p>
                  </div>
                  {confirmId === item.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { onDelete(item.id); setConfirmId(null); }}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(item.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
