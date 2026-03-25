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

  // ── Ubuntu Light — Yaru 2025/26 (authentic) ──────────────────────
  // $bg_color=#f6f5f4 (gri cald Yaru), $text_color=#2e3436, orange #E95420
  // Yaru 25.04/25.10: fondul ferestrei este #f6f5f4, cardurile ridicate spre #fff
  // borders: darken($bg_color, 18%) ≈ #c5c3c2

  {
    id: "ubuntu-light",
    name: "Ubuntu Light",
    description: "Yaru 2026 — gri cald autentic, portocaliu Ubuntu, umbre reale",
    preview: { bg: "#f6f5f4", ac: "#e95420", border: "#c5c3c2", text: "#2e3436" },
    vars: {
      "--sidebar-bg":    "#d8d3cd",     // panel lateral — distinct mai închis, cald
      "--bg-base":       "#f6f5f4",     // $bg_color Yaru — gri cald, fondul ferestrei
      "--bg-1":          "#f0eeeb",     // ușor mai adânc
      "--bg-2":          "#e9e5e0",     // carduri, suprafețe
      "--bg-3":          "#e1dbd5",     // hover, elemente adânci
      "--bg-hover":      "#d9d2cb",
      "--border":        "#c5c3c2",     // darken(#f6f5f4, 18%) — Yaru exact
      "--border-md":     "#b5b2af",
      "--border-hi":     "#a09d9a",
      "--border-light":  "#ede9e5",
      "--tx-1":          "#2e3436",     // $text_color Yaru — negru cald profund
      "--tx-2":          "#4e5456",
      "--tx-3":          "#8c9295",
      "--tx-4":          "#adb2b5",
      "--ac":            "#e95420",     // $orange Ubuntu — neschimbat
      "--ac-hover":      "#c94619",
      "--ac-dim":        "rgba(233,84,32,0.13)", "--ac-glow": "rgba(233,84,32,0.28)",
      "--btn-text":      "#ffffff",
      "--green":         "#1a7a40", "--green-dim": "rgba(26,122,64,0.12)",
      "--red":           "#c82020", "--red-dim":   "rgba(200,32,32,0.10)",
      "--blue":          "#1a56c4", "--blue-dim":  "rgba(26,86,196,0.10)",
      "--amber":         "#a05010", "--amber-dim": "rgba(160,80,16,0.10)",
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
