import { useEffect, useState } from "react";
import {
  TrendingUp, Users, FileText, AlertCircle,
  Receipt, ArrowUpRight, Calculator, Info,
} from "lucide-react";
import { getDb, getSetting, getFiscalOverrides, parseFiscalOverrides } from "@/lib/db";
import { calculeaza, type CalculeResult, type FiscalOverrides } from "@/lib/fiscal";
import type { OperatingMode, PfaMode } from "@/types";

interface Stats {
  totalClients: number;
  invoicesThisMonth: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  unpaidTotal: number;
  expensesThisYear: number;
  expensesThisMonth: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0, invoicesThisMonth: 0, revenueThisMonth: 0,
    revenueThisYear: 0, unpaidTotal: 0, expensesThisYear: 0, expensesThisMonth: 0,
  });
  const [mode, setMode] = useState<OperatingMode>("dda");
  const [pfaMode, setPfaMode] = useState<PfaMode>("real");
  const [normaValue, setNormaValue] = useState(0);
  const [overrides, setOverrides] = useState<FiscalOverrides>({});

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const now = new Date();
      const year = String(now.getFullYear());
      const month = now.toISOString().slice(0, 7);

      const m = (await getSetting("operating_mode")) as OperatingMode || "dda";
      const pm = (await getSetting("pfa_mode")) as PfaMode || "real";
      const nv = parseFloat(await getSetting("pfa_norma_valoare")) || 0;
      setMode(m); setPfaMode(pm); setNormaValue(nv);

      const currentYear = now.getFullYear();
      const raw = await getFiscalOverrides(currentYear);
      setOverrides(parseFiscalOverrides(raw, currentYear));

      const [c] = await db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM clients");
      const [inv] = await db.select<[{ count: number; total: number }]>(
        "SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM invoices WHERE status='paid' AND date LIKE ?",
        [`${month}%`],
      );
      const [yearInv] = await db.select<[{ total: number }]>(
        "SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE status='paid' AND date LIKE ?",
        [`${year}%`],
      );
      const [unpaid] = await db.select<[{ total: number }]>(
        "SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE status IN ('sent','overdue')",
      );

      let expensesYear = 0;
      let expensesMonth = 0;
      try {
        const [expY] = await db.select<[{ total: number }]>(
          "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date LIKE ?", [`${year}%`],
        );
        const [expM] = await db.select<[{ total: number }]>(
          "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date LIKE ?", [`${month}%`],
        );
        expensesYear = expY.total;
        expensesMonth = expM.total;
      } catch { /* expenses table might not exist in old DBs */ }

      setStats({
        totalClients: c.count,
        invoicesThisMonth: inv.count,
        revenueThisMonth: inv.total,
        revenueThisYear: yearInv.total,
        unpaidTotal: unpaid.total,
        expensesThisYear: expensesYear,
        expensesThisMonth: expensesMonth,
      });
    })();
  }, []);

  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });
  const fmtShort = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 0 });

  const calc = calculeaza(stats.revenueThisYear, stats.expensesThisYear, 2026 as any, mode, pfaMode, normaValue, false, false, overrides);

  const now = new Date();
  const monthLabel = now.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });

  const modeLabel =
    mode === "dda" ? "Drepturi de autor" : `PFA ${pfaMode === "real" ? "Sistem Real" : "Normă de Venit"}`;
  const modeDesc =
    mode === "dda"
      ? "forfetar 40% din venituri"
      : pfaMode === "real"
        ? "cheltuieli reale deductibile"
        : `normă de venit: ${fmtShort(normaValue)} RON`;

  return (
    <div style={{ padding: "36px 40px", maxWidth: 900 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--tx-3)", marginBottom: 6, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
              {monthLabel}
            </p>
            <h1 className="page-title">Bună ziua</h1>
            <p style={{ fontSize: 13, color: "var(--tx-3)", marginTop: 6 }}>Iată situația activității tale.</p>
          </div>
          <span className={`badge ${mode === "dda" ? "badge-blue" : "badge-amber"}`}
            style={{ textTransform: "uppercase", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
            {modeLabel}
          </span>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard
          label="Clienți"
          value={String(stats.totalClients)}
          icon={<Users size={15} />}
          color="var(--blue)"
          bg="var(--blue-dim)"
        />
        <StatCard
          label="Facturi (luna aceasta)"
          value={String(stats.invoicesThisMonth)}
          icon={<FileText size={15} />}
          color="var(--ac)"
          bg="var(--ac-dim)"
        />
        <StatCard
          label="Venituri (luna aceasta)"
          value={`${fmtShort(stats.revenueThisMonth)} RON`}
          icon={<TrendingUp size={15} />}
          color="var(--green)"
          bg="var(--green-dim)"
          mono
        />
        <StatCard
          label="Neîncasate"
          value={`${fmtShort(stats.unpaidTotal)} RON`}
          icon={<AlertCircle size={15} />}
          color={stats.unpaidTotal > 0 ? "var(--red)" : "var(--tx-3)"}
          bg={stats.unpaidTotal > 0 ? "var(--red-dim)" : "var(--bg-3)"}
          mono
        />
      </div>

      {/* ── Fiscal estimate ── */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Calculator size={16} color="var(--ac)" />
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 14, color: "var(--tx-1)" }}>
                Estimare fiscală anuală
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--tx-3)", fontFamily: "var(--font-mono)" }}>
              {modeLabel} &middot; {modeDesc}
            </span>
          </div>
        </div>
        <FiscalBreakdown calc={calc} stats={stats} mode={mode} pfaMode={pfaMode} fmt={fmt} />

        {/* ── Contextual explanation ── */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={14} color="var(--tx-3)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.5 }}>
            {mode === "dda" ? (
              <>DDA: forfetar 40% automat, impozit 10% din net, CASS praguri fixe, CAS obligatoriu peste 12 SM. Detalii complete în tab-ul <strong>Ghid Fiscal</strong>.</>
            ) : pfaMode === "real" ? (
              <>PFA Real: cheltuielile reale scad CAS+CASS din baza de impozitare — avantaj față de DDA. Adaugă cheltuieli în secțiunea <strong>Cheltuieli</strong>.</>
            ) : (
              <>PFA Normă: impozit 10% din norma stabilită de ANAF. Fără facturi necesare.</>
            )}
          </div>
        </div>
      </div>

      {/* ── PFA: Monthly expenses row (only for PFA Real) ── */}
      {mode === "pfa" && pfaMode === "real" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Receipt size={15} color="var(--red)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Cheltuieli deductibile
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--red)" }}>
              -{fmt(stats.expensesThisYear)} RON
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>
              Total anual &middot; {fmt(stats.expensesThisMonth)} RON luna aceasta
            </div>
          </div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <TrendingUp size={15} color="var(--green)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Eficiență venit
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--green)" }}>
              {stats.revenueThisYear > 0 ? (calc.netEfectiv / stats.revenueThisYear * 100).toFixed(1) : "0.0"}%
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>
              Cât rămâne din brut după taxe
            </div>
          </div>
        </div>
      )}

      {/* ── Link to Fiscal page ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <a href="/fiscal" style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--ac)", textDecoration: "none", fontWeight: 600,
        }}>
          Calculator fiscal detaliat <ArrowUpRight size={12} />
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function StatCard({ label, value, icon, color, bg, mono }: {
  label: string; value: string; icon: React.ReactNode;
  color: string; bg: string; mono?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 11, color: "var(--tx-3)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>
          {label}
        </span>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
      </div>
      <div className="stat-num" style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-head)", fontSize: mono ? 22 : 28 }}>
        {value}
      </div>
    </div>
  );
}

function FiscalBreakdown({ calc, stats, mode, pfaMode, fmt }: {
  calc: CalculeResult;
  stats: Stats;
  mode: OperatingMode;
  pfaMode: PfaMode;
  fmt: (n: number) => string;
}) {
  const rows: { label: string; amount: number; type: "pos" | "neg" | "result" | "mid" }[] = [
    { label: "Venit brut anual", amount: stats.revenueThisYear, type: "pos" },
  ];

  if (mode === "dda") {
    rows.push({ label: "Cheltuială forfetară (40%)", amount: calc.cheltuieliDeductibile, type: "neg" });
  } else if (pfaMode === "real") {
    rows.push({ label: "Cheltuieli reale", amount: calc.cheltuieliDeductibile, type: "neg" });
  }

  rows.push({ label: "Venit net", amount: calc.venitNet, type: "mid" });
  rows.push({ label: "Impozit pe venit (10%)", amount: calc.impozit, type: "neg" });
  rows.push({ label: "CASS (10%)", amount: calc.cass, type: "neg" });
  if (calc.cas > 0) rows.push({ label: "CAS (25%)", amount: calc.cas, type: "neg" });
  rows.push({ label: "Total taxe", amount: calc.totalTaxe, type: "neg" });
  rows.push({ label: "Bani în mână", amount: calc.netEfectiv, type: "result" });

  return (
    <div>
      {rows.map(({ label, amount, type }, i) => (
        <div key={label} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "13px 20px",
          background: type === "result" ? "rgba(82,183,136,0.05)" : type === "mid" ? "var(--bg-2)" : "transparent",
          borderTop: i > 0 ? "1px solid var(--border)" : "none",
        }}>
          <span style={{
            fontSize: 13,
            color: type === "result" ? "var(--tx-1)" : type === "mid" ? "var(--tx-2)" : type === "neg" ? "var(--tx-3)" : "var(--tx-2)",
            fontWeight: type === "result" ? 600 : type === "mid" ? 600 : 400,
          }}>
            {type === "neg" && <span style={{ color: "var(--tx-4)", marginRight: 6 }}>-</span>}
            {label}
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: type === "result" ? 16 : type === "mid" ? 14 : 13,
            fontWeight: type === "result" ? 700 : type === "mid" ? 600 : 400,
            color: type === "result" ? "var(--green)" : type === "neg" ? "var(--red)" : "var(--tx-1)",
          }}>
            {type === "result" ? "" : ""}{fmt(amount)} RON
          </span>
        </div>
      ))}
    </div>
  );
}
