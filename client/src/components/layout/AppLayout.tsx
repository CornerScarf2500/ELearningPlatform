import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

const SIDEBAR_KEY = "sidebar-open";

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      return saved !== "false";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen)); } catch {}
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      {/* Main content area — offset by sidebar width on desktop */}
      <main
        className={`min-h-screen pb-20 md:pb-0 transition-all duration-300 ${
          sidebarOpen ? "md:ml-64" : "md:ml-16"
        }`}
      >
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
};
