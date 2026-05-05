import { useCallback, useEffect, useState } from "react";

const KEY = "aura-sidebar-tree-v1";

function read(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useTreeState() {
  const [state, setState] = useState<Record<string, boolean>>(() => read());

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const isOpen = useCallback(
    (id: string, defaultOpen = false) => state[id] ?? defaultOpen,
    [state]
  );

  const toggle = useCallback((id: string, defaultOpen = false) => {
    setState((s) => {
      const cur = s[id] ?? defaultOpen;
      return { ...s, [id]: !cur };
    });
  }, []);

  const setOpen = useCallback((id: string, open: boolean) => {
    setState((s) => ({ ...s, [id]: open }));
  }, []);

  return { isOpen, toggle, setOpen };
}
