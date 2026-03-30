import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText,
  FileSignature, Receipt, Calculator, Settings,
  BarChart3, FileCheck, Search, Bot, FileSpreadsheet
} from "lucide-react";
import { getSetting, isTauri } from "@/lib/db";
import type { OperatingMode } from "@/types";
import GeminiSidebar from "./GeminiSidebar";

const nav = [
  { to: "/",           icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clienti",   icon: Users,            label: "Clienți"   },
  { to: "/oferte",    icon: FileSpreadsheet,  label: "Oferte"   },
  { to: "/facturi",   icon: FileText,         label: "Facturi", ddaLabel: "Venituri" },
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
            <svg width="26" height="26" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="512" height="512" rx="112" fill="#181818"/>
              <rect x="88"  y="88"  width="148" height="148" rx="32" fill="#e95420"/>
              <rect x="276" y="88"  width="148" height="148" rx="32" fill="#e95420" opacity="0.35"/>
              <rect x="88"  y="276" width="148" height="148" rx="32" fill="#e95420" opacity="0.35"/>
              <rect x="276" y="276" width="148" height="148" rx="32" fill="#e95420" opacity="0.75"/>
            </svg>
          </div>
          <span className="sidebar-logo-text">Libero</span>
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
          {nav.map((item) => {
            const Icon = item.icon;
            const label = (mode === "dda" && item.ddaLabel) ? item.ddaLabel : item.label;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
                data-tooltip={label}
              >
                <div style={{ minWidth: 36, display: "flex", justifyContent: "center" }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <span className="sidebar-nav-label">{label}</span>
              </NavLink>
            );
          })}

          <div className="sidebar-section-label" style={{ marginTop: 12 }}>Secțiuni</div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-text">v0.1.0</div>
        </div>
      </aside>

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
          
          <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 8px" }} />
          
          <button 
            onClick={(e) => { e.stopPropagation(); setGeminiOpen(!geminiOpen); }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: "var(--r-md)",
              border: geminiOpen ? "1px solid var(--ac)" : "1px solid var(--border)",
              background: geminiOpen ? "var(--ac-dim)" : "var(--bg-2)",
              color: geminiOpen ? "var(--ac)" : "var(--tx-2)",
              fontSize: 12, fontWeight: 600, transition: "all 0.15s"
            }}
          >
            <Bot size={15} />
            Asistent AI
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </div>
      </main>

      <GeminiSidebar 
        open={geminiOpen} 
        onClose={() => setGeminiOpen(false)} 
      />
    </div>
  );
}
