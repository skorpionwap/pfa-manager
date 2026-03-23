export interface Theme {
  id: string;
  name: string;
  description: string;
  preview: { bg: string; ac: string; border: string; text: string };
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  // ── Ubuntu Dark (Yaru Dark) ───────────────────────────────────────

  {
    id: "ubuntu-dark",
    name: "Ubuntu Dark",
    description: "Cărbune cald, portocaliu Ubuntu",
    preview: { bg: "#1c1917", ac: "#e95420", border: "#3d3836", text: "#f2efec" },
    vars: {
      "--bg-base": "#1c1917",
      "--bg-1": "#232120",
      "--bg-2": "#2d2a28",
      "--bg-3": "#383330",
      "--bg-hover": "#433e3a",
      "--border": "#3d3836", "--border-md": "#504845", "--border-hi": "#605552",
      "--border-light": "#252220",
      "--tx-1": "#f2efec", "--tx-2": "#b8b2ac", "--tx-3": "#7a7470", "--tx-4": "#4a4540",
      "--ac": "#e95420", "--ac-hover": "#f47046",
      "--ac-dim": "rgba(233,84,32,0.12)", "--ac-glow": "rgba(233,84,32,0.25)",
      "--btn-text": "#ffffff",
      "--green": "#4ade80", "--green-dim": "rgba(74,222,128,0.12)",
      "--red": "#f87171", "--red-dim": "rgba(248,113,113,0.12)",
      "--blue": "#60a5fa", "--blue-dim": "rgba(96,165,250,0.12)",
      "--amber": "#fbbf24", "--amber-dim": "rgba(251,191,36,0.12)",
    },
  },

  // ── Ubuntu Light (Yaru Light) ─────────────────────────────────────

  {
    id: "ubuntu-light",
    name: "Ubuntu Light",
    description: "Piatră caldă, portocaliu Ubuntu",
    preview: { bg: "#f5f3f0", ac: "#e95420", border: "#bdb6b0", text: "#1a1614" },
    vars: {
      "--bg-base": "linear-gradient(150deg, #f8f5f2 0%, #f2ede8 50%, #f5f1ed 100%)",
      "--bg-1": "#ede8e3",
      "--bg-2": "#e2ddd8",
      "--bg-3": "#d4cec9",
      "--bg-hover": "#c9c3bd",
      "--border": "#bdb6b0", "--border-md": "#a8a09a", "--border-hi": "#908880",
      "--border-light": "#eae5e0",
      "--tx-1": "#1a1614", "--tx-2": "#4a4540", "--tx-3": "#6e6860", "--tx-4": "#9e9890",
      "--ac": "#e95420", "--ac-hover": "#c44418",
      "--ac-dim": "rgba(233,84,32,0.10)", "--ac-glow": "rgba(233,84,32,0.20)",
      "--btn-text": "#ffffff",
      "--green": "#15803d", "--green-dim": "rgba(21,128,61,0.10)",
      "--red": "#dc2626", "--red-dim": "rgba(220,38,38,0.08)",
      "--blue": "#1d4ed8", "--blue-dim": "rgba(29,78,216,0.08)",
      "--amber": "#b45309", "--amber-dim": "rgba(180,83,9,0.09)",
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
