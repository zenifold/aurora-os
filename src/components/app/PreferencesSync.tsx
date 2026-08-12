import { useEffect } from "react";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useUIStore, type Accent } from "@/stores/ui-store";

const VALID_ACCENTS: Accent[] = ["workspace", "aurora", "indigo", "emerald", "sunset", "ocean", "rose", "mono"];

export function PreferencesSync() {
  const { data: prefs } = useUserPreferences();
  const setTheme = useUIStore((s) => s.setTheme);
  const setDensity = useUIStore((s) => s.setDensity);
  const setFontSize = useUIStore((s) => s.setFontSize);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const setHighContrast = useUIStore((s) => s.setHighContrast);
  const setAccent = useUIStore((s) => s.setAccent);

  useEffect(() => {
    if (!prefs) return;
    setTheme(prefs.theme);
    setDensity(prefs.density);
    setFontSize(prefs.font_size);
    setReducedMotion(prefs.reduced_motion);
    setHighContrast(prefs.high_contrast);
    const a = (prefs.accent_preference ?? "workspace") as Accent;
    setAccent(VALID_ACCENTS.includes(a) ? a : "workspace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.id, prefs?.accent_preference]);

  return null;
}
