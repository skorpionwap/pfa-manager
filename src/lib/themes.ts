export interface Theme {
  id: string;
  name: string;
  description: string;
  preview: { bg: string; ac: string; border: string; text: string };
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  // ── Ubuntu Dark "Studio Charcoal" ────────────────────────────────
  // Warm brown-black base, sidebar distinctly darker, cream typography

  {
    id: "ubuntu-dark",
    name: "Ubuntu Dark",
    description: "Cărbune cald, portocaliu Ubuntu",
    preview: { bg: "#1a1815", ac: "#e95420", border: "#3a3330", text: "#f7f3ec" },
    vars: {
      "--sidebar-bg": "#0e0c0b",
      "--bg-base": "#1a1815",
      "--bg-1": "#201d1a",
      "--bg-2": "#2a2622",
      "--bg-3": "#352f2b",
      "--bg-hover": "#403a35",
      "--border": "#3a3330", "--border-md": "#4d4642", "--border-hi": "#5e5750",
      "--border-light": "#242120",
      "--tx-1": "#f7f3ec", "--tx-2": "#b8b0a8", "--tx-3": "#78706a", "--tx-4": "#4a4440",
      "--ac": "#e95420", "--ac-hover": "#f26a38",
      "--ac-dim": "rgba(233,84,32,0.13)", "--ac-glow": "rgba(233,84,32,0.28)",
      "--btn-text": "#ffffff",
      "--green": "#4ade80", "--green-dim": "rgba(74,222,128,0.12)",
      "--red": "#f87171", "--red-dim": "rgba(248,113,113,0.12)",
      "--blue": "#60a5fa", "--blue-dim": "rgba(96,165,250,0.12)",
      "--amber": "#fbbf24", "--amber-dim": "rgba(251,191,36,0.12)",
    },
  },

  // ── Ubuntu Light "Parchment" ──────────────────────────────────────
  // Warm cream base with gradient, sepia borders, tan sidebar

  {
    id: "ubuntu-light",
    name: "Ubuntu Light",
    description: "Pergament cald, portocaliu Ubuntu",
    preview: { bg: "#f6f1ea", ac: "#e95420", border: "#c4bdb6", text: "#1c1814" },
    vars: {
      "--sidebar-bg": "#e5dfd8",
      "--bg-base": "linear-gradient(160deg, #faf7f3 0%, #f4ede5 55%, #f7f2eb 100%)",
      "--bg-1": "#f0ebe3",
      "--bg-2": "#e9e2da",
      "--bg-3": "#ddd6ce",
      "--bg-hover": "#d4cdc5",
      "--border": "#c4bdb6", "--border-md": "#b0a89f", "--border-hi": "#9a9089",
      "--border-light": "#ede8e2",
      "--tx-1": "#1c1814", "--tx-2": "#4a4038", "--tx-3": "#6e6258", "--tx-4": "#9e9288",
      "--ac": "#e95420", "--ac-hover": "#c24418",
      "--ac-dim": "rgba(233,84,32,0.10)", "--ac-glow": "rgba(233,84,32,0.22)",
      "--btn-text": "#ffffff",
      "--green": "#16803d", "--green-dim": "rgba(22,128,61,0.10)",
      "--red": "#dc2626", "--red-dim": "rgba(220,38,38,0.08)",
      "--blue": "#1d4ed8", "--blue-dim": "rgba(29,78,216,0.09)",
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
  root.setAttribute("data-theme", theme.id);
}
