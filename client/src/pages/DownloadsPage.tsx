import { useMemo } from "react";
import { motion } from "framer-motion";
import { Play, FileText, Trash2, HardDrive, FolderOpen, Loader2 } from "lucide-react";
import { PageTransition } from "../components/ui/PageTransition";
import { useDownloads, type DownloadItem } from "../hooks/useDownloads";
import { useState } from "react";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export const DownloadsPage = () => {
  const { items, loading, deleteItem, openItem } = useDownloads();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "video" | "pdf">("all");

  const filtered = useMemo(() =>
    filter === "all" ? items : items.filter((i) => i.filetype === filter),
    [items, filter]
  );

  const totalSize = items.reduce((s, i) => s + i.size, 0);

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Downloads</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {items.length} file{items.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} stored in-app
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60">
          {(["all", "video", "pdf"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === f
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {f === "all" ? "All" : f === "video" ? "Videos" : "PDFs"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <HardDrive className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-sm font-medium">No downloads yet</p>
          <p className="text-xs mt-1 opacity-70">Save videos and materials in-app while watching a course</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item: DownloadItem, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
            >
              <div
                onClick={() => openItem(item)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                  item.filetype === "video"
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500"
                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-500"
                }`}
              >
                {item.filetype === "video" ? <Play className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  onClick={() => openItem(item)}
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {item.title}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {formatBytes(item.size)} · {formatDate(item.savedAt)}
                </p>
              </div>

              <button
                onClick={() => openItem(item)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Open"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>

              {confirmId === item.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { deleteItem(item.id); setConfirmId(null); }}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(item.id)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </PageTransition>
  );
};
