import { motion, AnimatePresence } from "framer-motion";
import { Download, HardDrive, Smartphone, X, Loader2 } from "lucide-react";

export type DownloadMode = "local" | "in-app";

interface DownloadModalProps {
  open: boolean;
  filename: string;
  onSelect: (mode: DownloadMode) => void;
  onClose: () => void;
  isDownloading?: boolean;
  progress?: number; // 0-100
}

export const DownloadModal = ({
  open,
  filename,
  onSelect,
  onClose,
  isDownloading = false,
  progress,
}: DownloadModalProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && !isDownloading && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.97 }}
            transition={{ type: "spring", damping: 30, stiffness: 360 }}
            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Download</h3>
              </div>
              {!isDownloading && (
                <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="px-5 pb-4 text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-full">
              {filename}
            </p>

            {isDownloading ? (
              <div className="px-5 pb-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  {progress != null ? `Saving… ${progress}%` : "Saving…"}
                </div>
                {progress != null && (
                  <div className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelect("local")}
                  className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all text-zinc-700 dark:text-zinc-300 group"
                >
                  <HardDrive className="w-6 h-6 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                  <div className="text-center">
                    <p className="text-sm font-semibold">Save to Device</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Visible in your files</p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelect("in-app")}
                  className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all text-zinc-700 dark:text-zinc-300 group"
                >
                  <Smartphone className="w-6 h-6 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                  <div className="text-center">
                    <p className="text-sm font-semibold">Save in App</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Only visible here</p>
                  </div>
                </motion.button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
