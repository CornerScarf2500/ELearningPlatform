import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

import { useUIStore } from "../../store/uiStore";
import { Menu } from "lucide-react";

export const AppLayoutWrapper = () => {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop sidebar */}
      {sidebarOpen && <Sidebar />}

      {/* Main content area — offset by sidebar width on desktop */}
      <main className={`min-h-screen pb-20 md:pb-0 transition-all ${sidebarOpen ? "md:ml-64" : ""}`}>
        {!sidebarOpen && (
          <button 
            onClick={toggleSidebar}
            className="hidden md:flex fixed top-4 left-4 z-50 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <Menu className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
          </button>
        )}
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
};

export { AppLayoutWrapper as AppLayout };
