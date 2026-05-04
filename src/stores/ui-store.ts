import { create } from "zustand";

type Theme = "light" | "dark" | "system";
type Density = "comfortable" | "compact";

interface UIState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  density: Density;
  sidebarCollapsed: boolean;
  selectedTaskId: string | null;
  commandOpen: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  setSidebarCollapsed: (b: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setCommandOpen: (b: boolean) => void;
}

const THEME_KEY = "aura-theme";
const DENSITY_KEY = "aura-density";

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const resolve = (t: Theme): "light" | "dark" => (t === "system" ? (systemPrefersDark() ? "dark" : "light") : t);

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
};

const getInitialDensity = (): Density => {
  if (typeof window === "undefined") return "comfortable";
  const stored = localStorage.getItem(DENSITY_KEY);
  return stored === "compact" ? "compact" : "comfortable";
};

const applyTheme = (resolved: "light" | "dark") => {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
};

const applyDensity = (d: Density) => {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.density = d;
};

const initialTheme = getInitialTheme();
const initialDensity = getInitialDensity();

export const useUIStore = create<UIState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: resolve(initialTheme),
  density: initialDensity,
  sidebarCollapsed: false,
  selectedTaskId: null,
  commandOpen: false,
  toggleTheme: () => {
    const next: Theme = get().resolvedTheme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
  setTheme: (theme) => {
    const resolved = resolve(theme);
    if (typeof window !== "undefined") localStorage.setItem(THEME_KEY, theme);
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
  },
  setDensity: (density) => {
    if (typeof window !== "undefined") localStorage.setItem(DENSITY_KEY, density);
    applyDensity(density);
    set({ density });
  },
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));

// React to system theme changes when in 'system' mode
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme, setTheme } = useUIStore.getState();
    if (theme === "system") setTheme("system");
  });
}
