import { NavLink } from "react-router-dom";
import { Home, Search, Heart, Settings, BookOpen, HardDrive, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const links = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/favorites", icon: Heart, label: "Favorites" },
  { to: "/downloads", icon: HardDrive, label: "Downloads" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ isOpen, onToggle }: SidebarProps) => {
  return (
    <aside
      className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 transition-all duration-300 ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 py-6 border-b border-zinc-200 dark:border-zinc-800 ${isOpen ? "px-6" : "px-0 justify-center"}`}>
        <div className="w-9 h-9 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        {isOpen && (
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap overflow-hidden">
            ELearn
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-1 ${isOpen ? "px-3" : "px-2"}`}>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={!isOpen ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isOpen ? "px-3" : "px-0 justify-center"
              } ${
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {isOpen && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Toggle button */}
      <div className={`py-4 border-t border-zinc-200 dark:border-zinc-800 ${isOpen ? "px-3" : "px-2"}`}>
        <button
          onClick={onToggle}
          title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 w-full ${
            isOpen ? "px-3" : "px-0 justify-center"
          }`}
        >
          {isOpen ? (
            <>
              <PanelLeftClose className="w-5 h-5 shrink-0" />
              <span className="whitespace-nowrap overflow-hidden">Collapse</span>
            </>
          ) : (
            <PanelLeftOpen className="w-5 h-5 shrink-0" />
          )}
        </button>
      </div>
    </aside>
  );
};
