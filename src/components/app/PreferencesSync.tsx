import { useEffect } from "react";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useUIStore } from "@/stores/ui-store";

/**
 * Pulls the user's saved preferences from the database and applies them to
 * the UI store on first load. User prefs always win over local defaults.
 */
export function PreferencesSync() {
  const { data: prefs } = useUserPreferences();
  const setTheme = useUIStore((s) => s.setTheme);
  const setDensity = useUIStore((s) => s.setDensity);
  const setFontSize = useUIStore((s) => s.setFontSize);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const setHighContrast = useUIStore((s) => s.setHighContrast);

  useEffect(() => {
    if (!prefs) return;
    setTheme(prefs.theme);
    setDensity(prefs.density);
    setFontSize(prefs.font_size);
    setReducedMotion(prefs.reduced_motion);
    setHighContrast(prefs.high_contrast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.id]);

  return null;
}
