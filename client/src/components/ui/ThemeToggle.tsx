import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../../store/themeStore";

export const ThemeToggle = () => {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors w-full"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
    </motion.button>
  );
};
