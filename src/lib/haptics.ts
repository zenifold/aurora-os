/**
 * Lightweight haptic feedback via navigator.vibrate (no-op on unsupported browsers).
 */
export type HapticPattern = "tap" | "success" | "warn" | "error" | "long";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [10, 30, 10],
  warn: [20, 40, 20],
  error: [40, 60, 40],
  long: 30,
};

export function haptic(p: HapticPattern = "tap") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(PATTERNS[p]);
  } catch {
    /* noop */
  }
}
