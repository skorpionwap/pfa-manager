import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText,
  FileSignature, Receipt, Calculator, Settings,
  BarChart3, FileCheck, Search, Bot
} from "lucide-react";
import { getSetting, isTauri } from "@/lib/db";
import type { OperatingMode } from "@/types";
import GeminiSidebar from "./GeminiSidebar";

const nav = [
  { to: "/",           icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clienti",   icon: Users,            label: "Clienți"   },
  { to: "/facturi",   icon: FileText,         label: "Facturi"   },
  { to: "/contracte", icon: FileSignature,    label: "Contracte" },
  { to: "/cheltuieli", icon: Receipt,          label: "Cheltuieli" },
  { to: "/fiscal",    icon: Calculator,       label: "Fiscal"    },
  { to: "/raport",    icon: BarChart3,        label: "Raport anual" },
  { to: "/declaratie",icon: FileCheck,        label: "Declarație" },
  { to: "/setari",    icon: Settings,         label: "Setări"    },
];

const MODE_LABEL: Record<OperatingMode, string> = {
  dda: "Drepturi de autor",
  pfa: "PFA",
};

export default function Layout() {
  const [mode, setMode] = useState<OperatingMode>("dda");
  const [geminiOpen, setGeminiOpen] = useState(false);

  const refreshMode = () => {
    if (!isTauri()) return;
    getSetting("operating_mode").then(m => {
      if (m === "pfa" || m === "dda") setMode(m);
    }).catch(() => {});
  };

  useEffect(() => {
    refreshMode();

    const handler = (e: Event) => {
      const { key } = (e as CustomEvent).detail;
      if (key === "operating_mode") refreshMode();
    };

    const keyHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "g") {
        e.preventDefault();
        setGeminiOpen(v => !v);
      }
    };

    window.addEventListener("settings-changed", handler);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("settings-changed", handler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>

      {/* ── Slim Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" fill="var(--ac)" />
              <rect x="8" y="1" width="6" height="6" rx="1.5" fill="var(--ac)" opacity="0.35" />
              <rect x="1" y="8" width="6" height="6" rx="1.5" fill="var(--ac)" opacity="0.35" />
              <rect x="8" y="8" width="6" height="6" rx="1.5" fill="var(--ac)" opacity="0.7" />
            </svg>
          </div>
          <span className="sidebar-logo-text">PFA Manager</span>
        </div>

        {/* Mode badge */}
        <div className="sidebar-mode-badge">
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase", padding: "2px 7px", borderRadius: 99,
            background: mode === "dda" ? "var(--blue-dim)" : "var(--ac-dim)",
            color: mode === "dda" ? "var(--blue)" : "var(--ac)",
          }}>
            {MODE_LABEL[mode]}
          </span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Meniu</div>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
              data-tooltip={label}
            >
              <div style={{ minWidth: 36, display: "flex", justifyContent: "center" }}>
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <span className="sidebar-nav-label">{label}</span>
            </NavLink>
          ))}

          <div className="sidebar-section-label" style={{ marginTop: 12 }}>Inteligență AI</div>
          <button 
            className={`sidebar-nav-item ${geminiOpen ? "active" : ""}`}
            onClick={() => setGeminiOpen(!geminiOpen)}
            data-tooltip="Asistent Gemini (Ctrl+G)"
          >
            <div style={{ minWidth: 36, display: "flex", justifyContent: "center" }}>
              <Bot size={18} strokeWidth={1.75} />
            </div>
            <span className="sidebar-nav-label">Asistent Gemini</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-text">v0.1.0</div>
        </div>
      </aside>

      <GeminiSidebar open={geminiOpen} onClose={() => setGeminiOpen(false)} />

      {/* ── Content ── */}
      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-base)", display: "flex", flexDirection: "column" }}>
        {/* Search trigger bar */}
        <div onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
          style={{
            padding: "10px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer",
          }}>
          <Search size={14} color="var(--tx-4)" />
          <span style={{ fontSize: 12, color: "var(--tx-4)" }}>Caută...</span>
          <kbd style={{
            marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)",
            background: "var(--bg-3)", border: "1px solid var(--border)",
            borderRadius: 4, padding: "1px 6px", color: "var(--tx-4)",
          }}>⌘K</kbd>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
