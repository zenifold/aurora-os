import { create } from "zustand";

type Theme = "light" | "dark" | "system";
type Density = "comfortable" | "compact" | "ultra";
type FontSize = "small" | "default" | "large" | "xlarge";
export type Accent = "workspace" | "aurora" | "indigo" | "emerald" | "sunset" | "ocean" | "rose" | "mono";

interface UIState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  density: Density;
  fontSize: FontSize;
  reducedMotion: boolean;
  highContrast: boolean;
  accent: Accent;
  sidebarCollapsed: boolean;
  selectedTaskId: string | null;
  commandOpen: boolean;
  mobileDrawerOpen: boolean;
  quickCaptureOpen: boolean;
  quickCreateOpen: boolean;
  auraOpen: boolean;
  helpOpen: boolean;
  shortcutsOpen: boolean;
  helpSeen: Record<string, true>;
  sidebarEditMode: boolean;
  navOrder: string[];
  navHidden: string[];
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  setFontSize: (s: FontSize) => void;
  setReducedMotion: (b: boolean) => void;
  setHighContrast: (b: boolean) => void;
  setAccent: (a: Accent) => void;
  setSidebarCollapsed: (b: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setCommandOpen: (b: boolean) => void;
  setMobileDrawerOpen: (b: boolean) => void;
  setQuickCaptureOpen: (b: boolean) => void;
  setQuickCreateOpen: (b: boolean) => void;
  setAuraOpen: (b: boolean) => void;
  setHelpOpen: (b: boolean) => void;
  setShortcutsOpen: (b: boolean) => void;
  markHelpSeen: (id: string) => void;
  setSidebarEditMode: (b: boolean) => void;
  setNavOrder: (ids: string[]) => void;
  toggleNavHidden: (id: string) => void;
  resetNavLayout: () => void;
}

const THEME_KEY = "aura-theme";
const DENSITY_KEY = "aura-density";
const FONT_KEY = "aura-font-size";
const MOTION_KEY = "aura-reduced-motion";
const CONTRAST_KEY = "aura-high-contrast";
const ACCENT_KEY = "aura-accent";
const HELP_SEEN_KEY = "aura-help-seen";
const NAV_ORDER_KEY = "aura-nav-order";
const NAV_HIDDEN_KEY = "aura-nav-hidden";

const getInitialStringArray = (k: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const writeJSON = (k: string, v: unknown) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

const ACCENTS: Accent[] = ["workspace", "aurora", "indigo", "emerald", "sunset", "ocean", "rose", "mono"];

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const resolve = (t: Theme): "light" | "dark" => (t === "system" ? (systemPrefersDark() ? "dark" : "light") : t);

const ls = (k: string): string | null => (typeof window === "undefined" ? null : localStorage.getItem(k));

const getInitialTheme = (): Theme => {
  const v = ls(THEME_KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "dark";
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
const getInitialAccent = (): Accent => {
  const v = ls(ACCENT_KEY) as Accent | null;
  return v && ACCENTS.includes(v) ? v : "workspace";
};

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
const applyAccent = (a: Accent) => {
  if (typeof window === "undefined") return;
  if (a === "workspace") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = a;
};

const initialTheme = getInitialTheme();
const initialDensity = getInitialDensity();
const initialFontSize = getInitialFontSize();
const initialMotion = getInitialBool(MOTION_KEY);
const initialContrast = getInitialBool(CONTRAST_KEY);
const initialAccent = getInitialAccent();

if (typeof window !== "undefined") {
  applyTheme(resolve(initialTheme));
  applyDensity(initialDensity);
  applyFontSize(initialFontSize);
  applyMotion(initialMotion);
  applyContrast(initialContrast);
  applyAccent(initialAccent);
}

const getInitialHelpSeen = (): Record<string, true> => {
  if (typeof window === "undefined") return {};
  try {
    const v = localStorage.getItem(HELP_SEEN_KEY);
    if (!v) return {};
    const parsed = JSON.parse(v);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, true>) : {};
  } catch {
    return {};
  }
};


export const useUIStore = create<UIState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: resolve(initialTheme),
  density: initialDensity,
  fontSize: initialFontSize,
  reducedMotion: initialMotion,
  highContrast: initialContrast,
  accent: initialAccent,
  sidebarCollapsed: false,
  selectedTaskId: null,
  commandOpen: false,
  mobileDrawerOpen: false,
  quickCaptureOpen: false,
  quickCreateOpen: false,
  auraOpen: false,
  helpOpen: false,
  shortcutsOpen: false,
  helpSeen: getInitialHelpSeen(),
  sidebarEditMode: false,
  navOrder: getInitialStringArray(NAV_ORDER_KEY),
  navHidden: getInitialStringArray(NAV_HIDDEN_KEY),
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
  setAccent: (accent) => {
    if (typeof window !== "undefined") localStorage.setItem(ACCENT_KEY, accent);
    applyAccent(accent);
    set({ accent });
  },
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setMobileDrawerOpen: (mobileDrawerOpen) => set({ mobileDrawerOpen }),
  setQuickCaptureOpen: (quickCaptureOpen) => set({ quickCaptureOpen }),
  setQuickCreateOpen: (quickCreateOpen) => set({ quickCreateOpen }),
  setAuraOpen: (auraOpen) => set({ auraOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  markHelpSeen: (id) => {
    const next = { ...get().helpSeen, [id]: true as const };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(HELP_SEEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
    }
    set({ helpSeen: next });
  },
  setSidebarEditMode: (sidebarEditMode) => set({ sidebarEditMode }),
  setNavOrder: (navOrder) => { writeJSON(NAV_ORDER_KEY, navOrder); set({ navOrder }); },
  toggleNavHidden: (id) => {
    const cur = new Set(get().navHidden);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    const next = Array.from(cur);
    writeJSON(NAV_HIDDEN_KEY, next);
    set({ navHidden: next });
  },
  resetNavLayout: () => {
    writeJSON(NAV_ORDER_KEY, []);
    writeJSON(NAV_HIDDEN_KEY, []);
    set({ navOrder: [], navHidden: [] });
  },
}));

if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { theme, setTheme } = useUIStore.getState();
    if (theme === "system") setTheme("system");
  });
}
