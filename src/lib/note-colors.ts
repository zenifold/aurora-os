export interface NoteColor {
  name: string;
  hex: string;
}

export const NOTE_COLORS: NoteColor[] = [
  { name: "White", hex: "#ffffff" },
  { name: "Cream", hex: "#fef9c3" },
  { name: "Peach", hex: "#fed7aa" },
  { name: "Mint", hex: "#bbf7d0" },
  { name: "Sky", hex: "#bae6fd" },
  { name: "Lavender", hex: "#e9d5ff" },
  { name: "Blush", hex: "#fecdd3" },
  { name: "Sage", hex: "#d9f99d" },
  { name: "Fog", hex: "#f1f5f9" },
];

export const DEFAULT_NOTE_COLOR = "#ffffff";

export function colorName(hex: string): string {
  return NOTE_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? "Custom";
}
