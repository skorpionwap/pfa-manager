import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText,
  FileSignature, Receipt, Calculator, Settings,
  BarChart3, FileCheck,
} from "lucide-react";
import { getSetting, isTauri } from "@/lib/db";
import type { OperatingMode } from "@/types";

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

    window.addEventListener("settings-changed", handler);
    return () => window.removeEventListener("settings-changed", handler);
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 210, minWidth: 210,
        display: "flex", flexDirection: "column",
        background: "var(--bg-1)",
        borderRight: "1px solid var(--border)",
      }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28,
              background: "var(--ac-dim)",
              border: "1px solid rgba(212,132,90,0.25)",
              borderRadius: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="var(--ac)" opacity="0.8" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="var(--ac)" opacity="0.4" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="var(--ac)" opacity="0.4" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="var(--ac)" opacity="0.8" />
              </svg>
            </div>
            <span style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 600, color: "var(--tx-1)", letterSpacing: "-0.01em" }}>
              PFA Manager
            </span>
          </div>
          {/* Mode badge */}
          <div style={{ marginTop: 10, paddingLeft: 36 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", padding: "2px 7px",
              borderRadius: 99,
              background: mode === "dda" ? "var(--blue-dim)" : "var(--ac-dim)",
              color: mode === "dda" ? "var(--blue)" : "var(--ac)",
            }}>
              {MODE_LABEL[mode]}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ fontSize: 10, color: "var(--tx-4)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, padding: "8px 10px 4px" }}>
            Meniu
          </div>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: "var(--r-md)",
                fontSize: 13, fontWeight: isActive ? 500 : 400,
                textDecoration: "none",
                color: isActive ? "var(--ac)" : "var(--tx-3)",
                background: isActive ? "var(--ac-dim)" : "transparent",
                transition: "all 0.12s",
              })}
            >
              {({ isActive }) => (
                <><Icon size={15} strokeWidth={isActive ? 2 : 1.75} />{label}</>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, color: "var(--tx-4)", fontFamily: "var(--font-mono)" }}>v0.1.0</div>
        </div>
      </aside>

      {/* ── Content ── */}
      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-base)" }}>
        <Outlet />
      </main>
    </div>
  );
}
