import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, Users, FileText, AlertCircle,
  Receipt, ArrowUpRight, Calculator, Info,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { getDb, getSetting, getFiscalOverrides, parseFiscalOverrides } from "@/lib/db";
import { fetchAnnualData, type MonthlyData, type CategoryExpense } from "@/lib/raport";
import { calculeaza, FISCAL_YEARS, type An, type CalculeResult, type FiscalOverrides } from "@/lib/fiscal";
import { getCategoryLabel } from "@/lib/constants";
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

const DONUT_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#06b6d4", "#ec4899", "#f97316"];

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
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryExpense[]>([]);
  const [fiscalYear, setFiscalYear] = useState<An>(2026);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const month = selectedMonth;
      const year = selectedMonth.slice(0, 4);
      const currentYear = parseInt(year);

      const m = (await getSetting("operating_mode")) as OperatingMode || "dda";
      const pm = (await getSetting("pfa_mode")) as PfaMode || "real";
      const nv = parseFloat(await getSetting("pfa_norma_valoare")) || 0;
      setMode(m); setPfaMode(pm); setNormaValue(nv);

      const knownYears = FISCAL_YEARS.map(Number);
      const clampedYear = (knownYears.includes(currentYear) ? currentYear : knownYears[knownYears.length - 1]) as An;
      setFiscalYear(clampedYear);
      const raw = await getFiscalOverrides(currentYear);
      setOverrides(parseFiscalOverrides(raw, currentYear));

      const [c] = await db.select<[{ count: number }]>("SELECT COUNT(*) as count FROM clients WHERE is_archived = 0");
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

      // Chart data
      try {
        const annual = await fetchAnnualData(currentYear);
        setMonthlyData(annual.monthlyData);
        setCategoryData(annual.categoryBreakdown);
      } catch { /* ignore */ }
    })();
  }, [selectedMonth]);

  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });
  const fmtShort = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 0 });

  const calc = calculeaza(stats.revenueThisYear, stats.expensesThisYear, fiscalYear, mode, pfaMode, normaValue, false, false, overrides);

  const selectedYear = selectedMonth.slice(0, 4);
  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
  const _td = new Date();
  const todayMonth = `${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedMonth === todayMonth;

  function shiftMonth(delta: number) {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const modeLabel =
    mode === "dda" ? "Drepturi de autor" : `PFA ${pfaMode === "real" ? "Sistem Real" : "Normă de Venit"}`;
  const modeDesc =
    mode === "dda"
      ? "forfetar 40% din venituri"
      : pfaMode === "real"
        ? "cheltuieli reale deductibile"
        : `normă de venit: ${fmtShort(normaValue)} RON`;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 960 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <button onClick={() => shiftMonth(-1)} style={{ display: "flex", alignItems: "center", padding: "2px 4px", background: "none", border: "none", cursor: "pointer", color: "var(--tx-3)", borderRadius: "var(--r-sm)" }}>
                <ChevronLeft size={14} />
              </button>
              <p style={{ fontSize: 12, color: "var(--tx-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", margin: 0 }}>
                {monthLabel}
              </p>
              <button onClick={() => shiftMonth(1)} style={{ display: "flex", alignItems: "center", padding: "2px 4px", background: "none", border: "none", cursor: "pointer", color: "var(--tx-3)", borderRadius: "var(--r-sm)" }}>
                <ChevronRight size={14} />
              </button>
              {!isCurrentMonth && (
                <button onClick={() => setSelectedMonth(todayMonth)} style={{ fontSize: 10, padding: "2px 8px", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", cursor: "pointer", color: "var(--tx-3)", fontFamily: "var(--font-mono)" }}>
                  azi
                </button>
              )}
            </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard
          label="Clienți"
          value={stats.totalClients}
          icon={<Users size={15} />}
          color="var(--blue)"
          bg="var(--blue-dim)"
        />
        <StatCard
          label="Facturi (luna aceasta)"
          value={stats.invoicesThisMonth}
          icon={<FileText size={15} />}
          color="var(--ac)"
          bg="var(--ac-dim)"
        />
        <StatCard
          label="Venituri (luna aceasta)"
          value={stats.revenueThisMonth}
          icon={<TrendingUp size={15} />}
          color="var(--green)"
          bg="var(--green-dim)"
          format="currency"
        />
        <StatCard
          label="Neîncasate"
          value={stats.unpaidTotal}
          icon={<AlertCircle size={15} />}
          color={stats.unpaidTotal > 0 ? "var(--red)" : "var(--tx-3)"}
          bg={stats.unpaidTotal > 0 ? "var(--red-dim)" : "var(--bg-3)"}
          format="currency"
        />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12, marginBottom: 20 }}>
        {/* Bar chart: venituri vs cheltuieli */}
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-2)", marginBottom: 4 }}>
            Venituri vs Cheltuieli
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginBottom: 16 }}>
            {selectedYear} — lunar
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barGap={2} barCategoryGap="20%">
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 10, fill: "var(--tx-4)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--tx-4)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--bg-hover)", radius: 4 }} />
              <Bar dataKey="venituri" fill="var(--green)" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="cheltuieli" fill="var(--red)" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
            <LegendDot color="var(--green)" label="Venituri" />
            <LegendDot color="var(--red)" label="Cheltuieli" />
          </div>
        </div>

        {/* Donut chart: categorii cheltuieli */}
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-2)", marginBottom: 4 }}>
            Categorii cheltuieli
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginBottom: 12 }}>
            {selectedYear} — distribuire
          </div>
          {categoryData.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={62}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {categoryData.slice(0, 6).map((cat, i) => (
                  <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                      background: DONUT_COLORS[i % DONUT_COLORS.length],
                    }} />
                    <span style={{ color: "var(--tx-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getCategoryLabel(cat.category)}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--tx-3)", flexShrink: 0 }}>
                      {fmtShort(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx-4)", fontSize: 12 }}>
              Nicio cheltuială înregistrată
            </div>
          )}
        </div>
      </div>

      {/* ── Fiscal estimate ── */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
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
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <Link to="/fiscal" style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--ac)", textDecoration: "none", fontWeight: 600,
        }}>
          Calculator fiscal detaliat <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function StatCard({ label, value, icon, color, bg, format }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; bg: string; format?: "currency";
}) {
  const displayRef = useRef<HTMLDivElement>(null);

  // Animate number with requestAnimationFrame
  useEffect(() => {
    const el = displayRef.current;
    if (!el) return;
    const duration = 600;
    const start = performance.now();
    const from = 0;
    const to = value;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * ease;
      if (format === "currency") {
        el.textContent = `${current.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} RON`;
      } else {
        el.textContent = Math.round(current).toLocaleString("ro-RO");
      }
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, format]);

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
      <div
        ref={displayRef}
        className="stat-num"
        style={{
          fontFamily: format === "currency" ? "var(--font-mono)" : "var(--font-head)",
          fontSize: format === "currency" ? 22 : 28,
        }}
      />
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
            {fmt(amount)} RON
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Chart sub-components ── */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--tx-3)" }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-3)", border: "1px solid var(--border-md)",
      borderRadius: "var(--r-md)", padding: "8px 12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      <div style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ fontSize: 12, color: "var(--tx-1)", display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.dataKey === "venituri" ? "Venituri" : "Cheltuieli"}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
            {p.value.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
          </span>
        </div>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "var(--bg-3)", border: "1px solid var(--border-md)",
      borderRadius: "var(--r-md)", padding: "8px 12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      <div style={{ fontSize: 12, color: "var(--tx-1)", fontWeight: 500 }}>
        {getCategoryLabel(d.category)}
      </div>
      <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--tx-2)", marginTop: 2 }}>
        {d.total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
      </div>
    </div>
  );
}
