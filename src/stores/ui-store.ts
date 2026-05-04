import { create } from "zustand";

interface UIState {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  selectedTaskId: string | null;
  commandOpen: boolean;
  toggleTheme: () => void;
  setTheme: (t: "light" | "dark") => void;
  setSidebarCollapsed: (b: boolean) => void;
  setSelectedTaskId: (id: string | null) => void;
  setCommandOpen: (b: boolean) => void;
}

const getInitialTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("aura-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  sidebarCollapsed: false,
  selectedTaskId: null,
  commandOpen: false,
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        localStorage.setItem("aura-theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
      }
      return { theme: next };
    }),
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aura-theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    set({ theme });
  },
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));
