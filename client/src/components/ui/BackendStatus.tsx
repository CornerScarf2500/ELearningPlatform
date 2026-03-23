import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import axios from "axios";

type Status = "checking" | "online" | "waking" | "offline";

interface HealthData {
  db?: string;
  adminSeeded?: boolean;
  users?: number;
}

const API_URL = import.meta.env.VITE_API_URL || "/api";

export const BackendStatus = () => {
  const [status, setStatus] = useState<Status>("checking");
  const [retries, setRetries] = useState(0);
  const [health, setHealth] = useState<HealthData>({});

  const ping = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await axios.get(`${API_URL}/health`, { timeout: 10000 });
      setHealth({
        db: data.db,
        adminSeeded: data.adminSeeded,
        users: data.users,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const ok = await ping();
      if (cancelled) return;

      if (ok) {
        setStatus("online");
        // Keep pinging every 4 minutes to prevent Render from sleeping (sleeps at 15 min)
        timer = setTimeout(check, 4 * 60_000);
      } else {
        setRetries((r) => r + 1);
        setStatus("waking");
        // Retry every 5s while waking
        timer = setTimeout(check, 5_000);
      }
    };

    check();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ping]);

  const label =
    status === "checking"
      ? "Connecting to server…"
      : status === "waking"
        ? `Waking up server… (attempt ${retries})`
        : status === "online"
          ? "Server online"
          : "Server offline";

  const color =
    status === "online"
      ? "text-emerald-500"
      : status === "waking" || status === "checking"
        ? "text-amber-500"
        : "text-red-500";

  const bgColor =
    status === "online"
      ? "bg-emerald-500/10 border-emerald-500/20"
      : status === "waking" || status === "checking"
        ? "bg-amber-500/10 border-amber-500/20"
        : "bg-red-500/10 border-red-500/20";

  const dbLabel =
    health.db === "connected"
      ? "DB ✓"
      : health.db === "connecting"
        ? "DB connecting…"
        : health.db
          ? "DB ✗"
          : "";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${status}-${health.db}`}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`inline-flex flex-col items-start gap-1 px-3 py-2 rounded-xl border text-xs font-medium ${bgColor}`}
      >
        <div className={`flex items-center gap-2 ${color}`}>
          {status === "checking" || status === "waking" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : status === "online" ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          <span>{label}</span>
        </div>

        {/* Extra diagnostic info when online */}
        {status === "online" && health.db && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400 pl-5.5">
            <span
              className={
                health.db === "connected"
                  ? "text-emerald-500"
                  : "text-red-400"
              }
            >
              {dbLabel}
            </span>
          </div>
        )}

        {status === "waking" && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 pl-5.5">
            Render free tier wakes up in ~30s
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
