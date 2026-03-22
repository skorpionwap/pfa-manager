export interface Theme {
  id: string;
  name: string;
  description: string;
  preview: { bg: string; ac: string; border: string; text: string };
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  // ── Dark ──────────────────────────────────────────────────────────

  {
    id: "dark",
    name: "Dark",
    description: "Alb-negru, contrast maxim",
    preview: { bg: "#0a0a0a", ac: "#e5e5e5", border: "#262626", text: "#fafafa" },
    vars: {
      "--bg-base": "#0a0a0a", "--bg-1": "#111111", "--bg-2": "#1a1a1a",
      "--bg-3": "#222222", "--bg-hover": "#2a2a2a",
      "--border": "#262626", "--border-md": "#404040", "--border-hi": "#525252",
      "--border-light": "#262626",
      "--tx-1": "#fafafa", "--tx-2": "#a3a3a3", "--tx-3": "#737373", "--tx-4": "#404040",
      "--ac": "#e5e5e5", "--ac-hover": "#ffffff",
      "--ac-dim": "rgba(229,229,229,0.08)", "--ac-glow": "rgba(229,229,229,0.15)",
      "--btn-text": "#0a0a0a",
      "--green": "#4ade80", "--green-dim": "rgba(74,222,128,0.1)",
      "--red": "#f87171", "--red-dim": "rgba(248,113,113,0.1)",
      "--blue": "#60a5fa", "--blue-dim": "rgba(96,165,250,0.1)",
      "--amber": "#fbbf24", "--amber-dim": "rgba(251,191,36,0.1)",
    },
  },

  // ── Dark Colorat (Navy + Cyan) ────────────────────────────────────

  {
    id: "navy",
    name: "Navy",
    description: "Navy profund cu accent cyan",
    preview: { bg: "#0a192f", ac: "#00b4d8", border: "#1a3050", text: "#e0f0ff" },
    vars: {
      "--bg-base": "radial-gradient(ellipse at 50% 0%, #0f2744 0%, #0a192f 50%, #060e1a 100%)",
      "--bg-1": "#0d1f38",
      "--bg-2": "#132d4a",
      "--bg-3": "#1a3a5c",
      "--bg-hover": "#1e3f60",
      "--border": "#1a3050", "--border-md": "#264060", "--border-hi": "#2d5070",
      "--border-light": "#152a44",
      "--tx-1": "#e0f0ff", "--tx-2": "#7eb8e0", "--tx-3": "#4a8ab5", "--tx-4": "#2a5575",
      "--ac": "#00b4d8", "--ac-hover": "#48cae4",
      "--ac-dim": "rgba(0,180,216,0.12)", "--ac-glow": "rgba(0,180,216,0.25)",
      "--btn-text": "#0a192f",
      "--green": "#2dd4a8", "--green-dim": "rgba(45,212,168,0.12)",
      "--red": "#f87171", "--red-dim": "rgba(248,113,113,0.12)",
      "--blue": "#60a5fa", "--blue-dim": "rgba(96,165,250,0.12)",
      "--amber": "#fbbf24", "--amber-dim": "rgba(251,191,36,0.12)",
    },
  },

  // ── Light ─────────────────────────────────────────────────────────

  {
    id: "light",
    name: "Light",
    description: "Alb-negru, curat și simplu",
    preview: { bg: "#ffffff", ac: "#171717", border: "#e5e5e5", text: "#171717" },
    vars: {
      "--bg-base": "#ffffff", "--bg-1": "#f9fafb", "--bg-2": "#f3f4f6",
      "--bg-3": "#e5e7eb", "--bg-hover": "#e5e7eb",
      "--border": "#e5e5e5", "--border-md": "#d4d4d4", "--border-hi": "#a3a3a3",
      "--border-light": "#f0f0f0",
      "--tx-1": "#171717", "--tx-2": "#525252", "--tx-3": "#737373", "--tx-4": "#a3a3a3",
      "--ac": "#171717", "--ac-hover": "#000000",
      "--ac-dim": "rgba(0,0,0,0.06)", "--ac-glow": "rgba(0,0,0,0.12)",
      "--btn-text": "#ffffff",
      "--green": "#16a34a", "--green-dim": "rgba(22,163,74,0.08)",
      "--red": "#dc2626", "--red-dim": "rgba(220,38,38,0.08)",
      "--blue": "#2563eb", "--blue-dim": "rgba(37,99,235,0.08)",
      "--amber": "#d97706", "--amber-dim": "rgba(217,119,6,0.08)",
    },
  },

  // ── Light Colorat (Blue Gradient) ─────────────────────────────────

  {
    id: "ocean",
    name: "Ocean",
    description: "Light cu note de albastru",
    preview: { bg: "#eef4ff", ac: "#2563eb", border: "#c7d8f0", text: "#0f172a" },
    vars: {
      "--bg-base": "linear-gradient(160deg, #f5f8ff 0%, #e8f0fe 35%, #f0f4ff 65%, #eaf0ff 100%)",
      "--bg-1": "#f0f5ff",
      "--bg-2": "#e0eaff",
      "--bg-3": "#d0dfff",
      "--bg-hover": "#d5e2f8",
      "--border": "#c7d8f0", "--border-md": "#b0c8e8", "--border-hi": "#8aaddd",
      "--border-light": "#e8f0ff",
      "--tx-1": "#0f172a", "--tx-2": "#3b5578", "--tx-3": "#5a7aaa", "--tx-4": "#8aa8d0",
      "--ac": "#2563eb", "--ac-hover": "#1d4ed8",
      "--ac-dim": "rgba(37,99,235,0.08)", "--ac-glow": "rgba(37,99,235,0.18)",
      "--btn-text": "#ffffff",
      "--green": "#16a34a", "--green-dim": "rgba(22,163,74,0.08)",
      "--red": "#dc2626", "--red-dim": "rgba(220,38,38,0.08)",
      "--blue": "#2563eb", "--blue-dim": "rgba(37,99,235,0.1)",
      "--amber": "#d97706", "--amber-dim": "rgba(217,119,6,0.08)",
    },
  },
];

export function getThemeById(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
