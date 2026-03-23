import { NavLink } from "react-router-dom";
import { Home, Search, Heart, Settings, BookOpen } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";

const links = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/favorites", icon: Heart, label: "Favorites" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export const Sidebar = () => {
  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-40 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          ELearn
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer with theme toggle */}
      <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">
        <ThemeToggle />
      </div>
    </aside>
  );
};
