import { create } from "zustand";

type Theme = "light" | "dark" | "system";
type Density = "comfortable" | "compact" | "ultra";
type FontSize = "small" | "default" | "large" | "xlarge";

interface UIState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  density: Density;
  fontSize: FontSize;
  reducedMotion: boolean;
  highContrast: boolean;
  sidebarCollapsed: boolean;
  selectedTaskId: string | null;
  commandOpen: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  setFontSize: (s: FontSize) => void;
  setReducedMotion: (b: boolean) => void;
  setHighContrast: (b: boolean) => void;
  setSidebarCollapsed: (b: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setCommandOpen: (b: boolean) => void;
}

const THEME_KEY = "aura-theme";
const DENSITY_KEY = "aura-density";
const FONT_KEY = "aura-font-size";
const MOTION_KEY = "aura-reduced-motion";
const CONTRAST_KEY = "aura-high-contrast";

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const resolve = (t: Theme): "light" | "dark" => (t === "system" ? (systemPrefersDark() ? "dark" : "light") : t);

const ls = (k: string): string | null => (typeof window === "undefined" ? null : localStorage.getItem(k));

const getInitialTheme = (): Theme => {
  const v = ls(THEME_KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "system";
};
const getInitialDensity = (): Density => {
  const v = ls(DENSITY_KEY);
  return v === "compact" || v === "ultra" || v === "comfortable" ? v : "comfortable";
};
const getInitialFontSize = (): FontSize => {
  const v = ls(FONT_KEY);
  return v === "small" || v === "large" || v === "xlarge" || v === "default" ? v : "default";
};
const getInitialBool = (k: string) => ls(k) === "1";

const applyTheme = (resolved: "light" | "dark") => {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
};
const applyDensity = (d: Density) => {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.density = d;
};
const applyFontSize = (s: FontSize) => {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.fontSize = s;
};
const applyMotion = (b: boolean) => {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.reducedMotion = b ? "true" : "false";
};
const applyContrast = (b: boolean) => {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.highContrast = b ? "true" : "false";
};

const initialTheme = getInitialTheme();
const initialDensity = getInitialDensity();
const initialFontSize = getInitialFontSize();
const initialMotion = getInitialBool(MOTION_KEY);
const initialContrast = getInitialBool(CONTRAST_KEY);

if (typeof window !== "undefined") {
  applyDensity(initialDensity);
  applyFontSize(initialFontSize);
  applyMotion(initialMotion);
  applyContrast(initialContrast);
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: resolve(initialTheme),
  density: initialDensity,
  fontSize: initialFontSize,
  reducedMotion: initialMotion,
  highContrast: initialContrast,
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
  setFontSize: (fontSize) => {
    if (typeof window !== "undefined") localStorage.setItem(FONT_KEY, fontSize);
    applyFontSize(fontSize);
    set({ fontSize });
  },
  setReducedMotion: (b) => {
    if (typeof window !== "undefined") localStorage.setItem(MOTION_KEY, b ? "1" : "0");
    applyMotion(b);
    set({ reducedMotion: b });
  },
  setHighContrast: (b) => {
    if (typeof window !== "undefined") localStorage.setItem(CONTRAST_KEY, b ? "1" : "0");
    applyContrast(b);
    set({ highContrast: b });
  },
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));

if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme, setTheme } = useUIStore.getState();
    if (theme === "system") setTheme("system");
  });
}
