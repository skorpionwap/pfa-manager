export interface Theme {
  id: string;
  name: string;
  description: string;
  preview: { bg: string; ac: string; border: string; text: string };
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  // ── Ubuntu Dark — Yaru (exact) ───────────────────────────────────
  // $jet=#181818, bg = lighten(jet, 8%) = #2c2c2c, orange #E95420
  // Source: ubuntu/yaru gtk/src/default/gtk-3.0/_colors.scss + _palette.scss

  {
    id: "ubuntu-dark",
    name: "Ubuntu Dark",
    description: "Yaru dark — gri neutru, portocaliu Ubuntu",
    preview: { bg: "#2c2c2c", ac: "#e95420", border: "#1a1a1a", text: "#f7f7f7" },
    vars: {
      "--sidebar-bg": "#181818",        // $jet — panel bg color
      "--bg-base": "#2c2c2c",           // lighten($jet, 8%) — main window bg
      "--bg-1": "#292929",              // lighten($jet, 7%)
      "--bg-2": "#242424",              // lighten($jet, 6%) — $base_color dark
      "--bg-3": "#1f1f1f",              // lighten($jet, 4%)
      "--bg-hover": "#383838",          // lighten($jet, 12%)
      "--border": "#1a1a1a",            // darken(bg, 8%) ≈ jet
      "--border-md": "#404040",
      "--border-hi": "#565656",
      "--border-light": "#202020",
      "--tx-1": "#f7f7f7",              // $porcelain
      "--tx-2": "#c0bfbc",
      "--tx-3": "#878787",              // $ash
      "--tx-4": "#5d5d5d",              // $slate
      "--ac": "#e95420",                // $orange — Ubuntu brand orange
      "--ac-hover": "#f26a38",
      "--ac-dim": "rgba(233,84,32,0.14)", "--ac-glow": "rgba(233,84,32,0.30)",
      "--btn-text": "#ffffff",
      "--green": "#4ade80", "--green-dim": "rgba(74,222,128,0.12)",
      "--red": "#f87171", "--red-dim": "rgba(248,113,113,0.12)",
      "--blue": "#60a5fa", "--blue-dim": "rgba(96,165,250,0.12)",
      "--amber": "#fbbf24", "--amber-dim": "rgba(251,191,36,0.12)",
    },
  },

  // ── Ubuntu Light — Yaru (exact) ──────────────────────────────────
  // $light_bg_color=#FAFAFA, text=$inkstone=#3D3D3D, orange #E95420
  // Source: ubuntu/yaru gtk/src/default/gtk-3.0/_colors.scss + _palette.scss

  {
    id: "ubuntu-light",
    name: "Ubuntu Light",
    description: "Yaru light — alb cald, portocaliu Ubuntu",
    preview: { bg: "#fafafa", ac: "#e95420", border: "#c8c8c8", text: "#3d3d3d" },
    vars: {
      "--sidebar-bg": "#d5d0ce",        // mix(bg, base, 50%) darkened for sidebar
      "--bg-base": "#fafafa",           // $light_bg_color
      "--bg-1": "#f3f3f3",
      "--bg-2": "#ebebeb",
      "--bg-3": "#e0e0e0",
      "--bg-hover": "#d6d6d6",
      "--border": "#c8c8c8",            // darken(#fafafa, 20%)
      "--border-md": "#b5b5b5",
      "--border-hi": "#9e9e9e",
      "--border-light": "#f0f0f0",
      "--tx-1": "#3d3d3d",              // $inkstone
      "--tx-2": "#5d5d5d",              // $slate
      "--tx-3": "#878787",              // $ash
      "--tx-4": "#aea79f",              // $warm_gray
      "--ac": "#e95420",                // $orange
      "--ac-hover": "#c24418",
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
