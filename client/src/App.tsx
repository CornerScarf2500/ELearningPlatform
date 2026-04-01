import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "./store/authStore";
import { useThemeStore } from "./store/themeStore";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { CourseViewerPage } from "./pages/CourseViewerPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { WifiOff } from "lucide-react";

/* ── Offline banner ──────────────────────────────────────────── */
const OfflineBanner = () => {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-center text-xs font-semibold py-1.5 flex items-center justify-center gap-2 shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      You are offline — only Downloads are available
    </div>
  );
};

/* ── Route guard ──────────────────────────────────────────── */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const { isOnline } = useNetworkStatus();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If offline and not on downloads page, redirect to downloads
  if (!isOnline && location.pathname !== "/downloads") {
    return <Navigate to="/downloads" replace />;
  }

  if (!token) {
    // If offline, allow staying on downloads if somehow they were there
    if (!isOnline) return <Navigate to="/downloads" replace />;
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

/* ── Redirect already-logged-in users away from /login ─────── */
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/* ── Animated routes wrapper ──────────────────────────────── */
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="course/:id" element={<CourseViewerPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="downloads" element={<DownloadsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

/* ── App ──────────────────────────────────────────────────── */
function App() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrateTheme();
    hydrateAuth();
  }, [hydrateAuth, hydrateTheme]);

  return (
    <BrowserRouter>
      <OfflineBanner />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
