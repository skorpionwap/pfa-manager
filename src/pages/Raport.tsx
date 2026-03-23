import { useEffect, useState, useRef } from "react";
import { Printer, TrendingUp, TrendingDown, Wallet, Receipt, Users, PieChart, CheckCircle2 } from "lucide-react";
import { getSetting, getFiscalOverrides, parseFiscalOverrides } from "@/lib/db";
import { fetchAnnualData, type AnnualData } from "@/lib/raport";
import { calculeaza, FISCAL_YEARS, type An, type FiscalOverrides } from "@/lib/fiscal";
import { getCategoryLabel, CATEGORY_BADGE } from "@/lib/constants";
import type { OperatingMode, PfaMode } from "@/types";

export default function Raport() {
  const [an, setAn]               = useState<An>(2026);
  const [data, setData]           = useState<AnnualData | null>(null);
  const [mode, setMode]           = useState<OperatingMode>("dda");
  const [pfaMode, setPfaMode]     = useState<PfaMode>("real");
  const [normaValue, setNormaValue] = useState(0);
  const [areSalariu, setAreSalariu] = useState(false);
  const [casBifat, setCasBifat]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [overrides, setOverrides] = useState<FiscalOverrides>({});
  const printRef = useRef<HTMLDivElement>(null);

  const [userName, setUserName]   = useState("");
  const [userCif, setUserCif]     = useState("");
  const [userAddress, setUserAddress] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await fetchAnnualData(an);
        setData(d);
        const m = (await getSetting("operating_mode")) as OperatingMode || "dda";
        const pm = (await getSetting("pfa_mode")) as PfaMode || "real";
        const nv = parseFloat(await getSetting("pfa_norma_valoare")) || 0;
        setMode(m); setPfaMode(pm); setNormaValue(nv);

        const raw = await getFiscalOverrides(Number(an));
        setOverrides(parseFiscalOverrides(raw, Number(an)));

        setUserName(await getSetting("my_name") || "");
        setUserCif(await getSetting("my_cif") || "");
        setUserAddress(await getSetting("my_address") || "");
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [an]);

  const c = data ? calculeaza(data.totalVenituri, data.totalCheltuieli, an, mode, pfaMode, normaValue, areSalariu, casBifat, overrides) : null;
  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });

  useEffect(() => {
    if (!showPrint) return;
    window.print();
    setShowPrint(false);
  }, [showPrint]);

  const handlePrint = () => setShowPrint(true);

  if (loading || !data || !c) return <div style={{ padding: 40, color: "var(--tx-3)" }}>Se încarcă...</div>;

  const modeLabel = mode === "dda" ? "Drepturi de autor" : `PFA ${pfaMode === "real" ? "Sistem Real" : "Normă de Venit"}`;

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="page-title">Raport Anual</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span className={`badge ${mode === "dda" ? "badge-blue" : "badge-amber"}`} style={{ textTransform: "uppercase", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
              {modeLabel}
            </span>
            <span style={{ fontSize: 12, color: "var(--tx-3)" }}>
              {data.invoiceCount} facturi &middot; {data.expenseCount} cheltuieli
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, background: "var(--bg-2)", padding: 4, borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
            {FISCAL_YEARS.map(a => (
              <button key={a} onClick={() => setAn(a)}
                style={{ padding: "6px 16px", borderRadius: "var(--r-sm)", border: "none",
                  background: an === a ? "var(--ac)" : "transparent",
                  color: an === a ? "#fff" : "var(--tx-3)",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
                {a}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={14} strokeWidth={2.5} /> Printează
          </button>
        </div>
      </div>

      {/* ── Options ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "16px 20px", marginBottom: 24, background: "var(--bg-1)", display: "flex", gap: 32, alignItems: "center" }}>
        <label className="checkbox-wrap">
          <input type="checkbox" checked={areSalariu} onChange={e => setAreSalariu(e.target.checked)} />
          <div className="box"><CheckCircle2 size={12} /></div>
          <span>Am și salariu activ (CIM)</span>
        </label>
        <label className="checkbox-wrap">
          <input type="checkbox" checked={casBifat || c.casObligatoriu} disabled={c.casObligatoriu} onChange={e => setCasBifat(e.target.checked)} />
          <div className="box"><CheckCircle2 size={12} /></div>
          <span>CAS voluntar</span>
        </label>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--green-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={14} color="var(--green)" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Venituri</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--green)" }}>
            {fmt(data.totalVenituri)} RON
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>{data.invoiceCount} facturi încasate</div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--red-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingDown size={14} color="var(--red)" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cheltuieli</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--red)" }}>
            -{fmt(data.totalCheltuieli)} RON
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>{data.expenseCount} cheltuieli</div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--blue-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={14} color="var(--blue)" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Taxe</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--amber)" }}>
            -{fmt(c.totalTaxe)} RON
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>~{fmt(c.totalTaxe / 12)} RON/lună</div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(82,183,136,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Receipt size={14} color="var(--green)" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Net</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--green)" }}>
            {fmt(c.netEfectiv)} RON
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>{c.rataRetentie.toFixed(1)}% din brut</div>
        </div>
      </div>

      {/* ── Monthly Table ───────────────────────────────────────────────────── */}
      <div className="card" style={{ overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>Venituri și Cheltuieli pe Lună</span>
          <span style={{ color: "var(--tx-3)", fontWeight: 400 }}>An {an}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Lună</th>
              <th style={{ textAlign: "right" }}>Venituri</th>
              <th style={{ textAlign: "right" }}>Cheltuieli</th>
              <th style={{ textAlign: "right" }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyData.map(m => {
              const net = m.venituri - m.cheltuieli;
              return (
                <tr key={m.month}>
                  <td style={{ fontWeight: 500, color: "var(--tx-1)" }}>{m.monthLabel}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: m.venituri > 0 ? "var(--green)" : "var(--tx-4)" }}>
                    {m.venituri > 0 ? fmt(m.venituri) : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: m.cheltuieli > 0 ? "var(--red)" : "var(--tx-4)" }}>
                    {m.cheltuieli > 0 ? `-${fmt(m.cheltuieli)}` : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: net >= 0 ? "var(--tx-1)" : "var(--red)" }}>
                    {net !== 0 ? (net > 0 ? "" : "-") + fmt(Math.abs(net)) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border-md)" }}>
              <td style={{ fontWeight: 700, color: "var(--tx-1)" }}>TOTAL</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--green)" }}>{fmt(data.totalVenituri)}</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--red)" }}>-{fmt(data.totalCheltuieli)}</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--tx-1)" }}>{fmt(data.totalVenituri - data.totalCheltuieli)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Two Columns: Clients + Categories ────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Top Clients */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={14} /> Top Clienți
          </div>
          <div style={{ padding: "12px 24px" }}>
            {data.topClients.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--tx-4)", fontSize: 13 }}>Nicio factură încasată</div>
            ) : data.topClients.map((cl, i) => {
              const maxTotal = data.topClients[0].total;
              const pct = maxTotal > 0 ? (cl.total / maxTotal) * 100 : 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < data.topClients.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--bg-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--tx-3)", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tx-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cl.client_name}</div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--bg-3)", marginTop: 6 }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "var(--ac)", width: `${pct}%`, transition: "width 0.3s" }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--green)", flexShrink: 0 }}>
                    {fmt(cl.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expense Categories */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <PieChart size={14} /> Categorii Cheltuieli
          </div>
          <div style={{ padding: "12px 24px" }}>
            {data.categoryBreakdown.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--tx-4)", fontSize: 13 }}>Nicio cheltuială</div>
            ) : data.categoryBreakdown.map((cat, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < data.categoryBreakdown.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span className={CATEGORY_BADGE[cat.category] || "badge badge-muted"}>
                  {getCategoryLabel(cat.category)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {data.totalCheltuieli > 0 && (
                    <span style={{ fontSize: 11, color: "var(--tx-4)" }}>
                      {(cat.total / data.totalCheltuieli * 100).toFixed(0)}%
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--red)" }}>
                    -{fmt(cat.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fiscal Breakdown ────────────────────────────────────────────────── */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>Calcul Fiscal Complet</span>
          <span style={{ color: "var(--tx-3)", fontWeight: 400 }}>SM {an}: {fmt(c.sm)} RON</span>
        </div>
        <div style={{ padding: "8px 24px" }}>
          <Row label="Venit Brut Realizat" value={`${fmt(c.brutAnual)} RON`} />

          {mode === "dda" ? (
            <Row label="Deducere forfetară (40%)" sub="Cheltuieli recunoscute automat" value={`- ${fmt(c.cheltuieliDeductibile)} RON`} red />
          ) : pfaMode === "real" ? (
            <Row label="Cheltuieli deductibile" sub="Din activitatea desfășurată" value={`- ${fmt(c.cheltuieliDeductibile)} RON`} red />
          ) : (
            <Row label="Normă de venit" sub="Valoare stabilită de ANAF" value={`${fmt(normaValue)} RON`} highlight />
          )}

          <Row label="Venit Net" value={`${fmt(c.venitNet)} RON`} highlight />
          <div style={{ margin: "16px 0", borderTop: "1px dashed var(--border)" }} />
          <Row label="Impozit pe venit (10%)" value={`${fmt(c.impozit)} RON`} red={c.impozit > 0} />
          <Row label="CASS Sănătate (10%)" sub={c.cassNivel} value={`${fmt(c.cass)} RON`} red={c.cass > 0} />
          <Row label="CAS Pensie (25%)" sub={c.casNivel} value={`${fmt(c.cas)} RON`} red={c.cas > 0} />
        </div>
        <div style={{ background: "var(--bg-2)", padding: "20px 24px", borderTop: "1px solid var(--border)" }}>
          <Row label="Total taxe" value={`${fmt(c.totalTaxe)} RON`} highlight red />
          <div style={{ marginTop: 12 }}>
            <Row label="Venit Net Rămas" sub="După toate taxele" value={`${fmt(c.netEfectiv)} RON`} highlight color="var(--green)" />
          </div>
        </div>
      </div>

      {/* ── Print Modal ─────────────────────────────────────────────────────── */}
      {showPrint && (
        <div className="modal-overlay" onClick={() => setShowPrint(false)}>
          <div style={{ width: "95vw", maxWidth: 840, maxHeight: "90vh", overflowY: "auto", borderRadius: "var(--r-lg)" }}>
            <div ref={printRef} className="print-frame">
              <div className="print-raport">
                {/* Header */}
                <div className="pr-header">
                  <div>
                    <h1>Raport Anual {an}</h1>
                    <p>{userName}{userCif ? ` — CIF/CNP: ${userCif}` : ""}</p>
                    {userAddress && <p style={{ fontSize: 10, color: "#666" }}>{userAddress}</p>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#666" }}>Mod: <strong>{modeLabel}</strong></div>
                    <div style={{ fontSize: 10, color: "#666" }}>SM {an}: <strong>{fmt(c.sm)} RON</strong></div>
                  </div>
                </div>

                {/* Summary */}
                <div className="pr-summary">
                  <div className="pr-stat">
                    <div className="pr-stat-value" style={{ color: "#2e7d32" }}>{fmt(data.totalVenituri)}</div>
                    <div className="pr-stat-label">Venituri (RON)</div>
                  </div>
                  <div className="pr-stat">
                    <div className="pr-stat-value" style={{ color: "#c62828" }}>-{fmt(data.totalCheltuieli)}</div>
                    <div className="pr-stat-label">Cheltuieli (RON)</div>
                  </div>
                  <div className="pr-stat">
                    <div className="pr-stat-value" style={{ color: "#e65100" }}>-{fmt(c.totalTaxe)}</div>
                    <div className="pr-stat-label">Taxe (RON)</div>
                  </div>
                  <div className="pr-stat">
                    <div className="pr-stat-value" style={{ color: "#2e7d32" }}>{fmt(c.netEfectiv)}</div>
                    <div className="pr-stat-label">Net (RON)</div>
                  </div>
                </div>

                {/* Monthly table */}
                <table>
                  <thead>
                    <tr><th>Lună</th><th style={{ textAlign: "right" }}>Venituri</th><th style={{ textAlign: "right" }}>Cheltuieli</th><th style={{ textAlign: "right" }}>Net</th></tr>
                  </thead>
                  <tbody>
                    {data.monthlyData.map(m => (
                      <tr key={m.month}>
                        <td>{m.monthLabel}</td>
                        <td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>{m.venituri > 0 ? fmt(m.venituri) : "—"}</td>
                        <td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>{m.cheltuieli > 0 ? `-${fmt(m.cheltuieli)}` : "—"}</td>
                        <td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>{fmt(m.venituri - m.cheltuieli)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #111" }}>
                      <td style={{ fontWeight: 700 }}>TOTAL</td>
                      <td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace", fontWeight: 700 }}>{fmt(data.totalVenituri)}</td>
                      <td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace", fontWeight: 700 }}>-{fmt(data.totalCheltuieli)}</td>
                      <td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace", fontWeight: 700 }}>{fmt(data.totalVenituri - data.totalCheltuieli)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Fiscal summary */}
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: "24px 0 12px", borderBottom: "1px solid #ccc", paddingBottom: 8 }}>Calcul Fiscal</h2>
                <table>
                  <tbody>
                    <tr><td>Venit Brut</td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>{fmt(c.brutAnual)} RON</td></tr>
                    <tr><td>{mode === "dda" ? "Forfetar (40%)" : pfaMode === "real" ? "Cheltuieli deductibile" : "Normă de venit"}</td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>-{fmt(c.cheltuieliDeductibile)} RON</td></tr>
                    <tr><td><strong>Venit Net</strong></td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace", fontWeight: 700 }}>{fmt(c.venitNet)} RON</td></tr>
                    <tr><td>Impozit (10%)</td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>{fmt(c.impozit)} RON</td></tr>
                    <tr><td>CASS (10%) — {c.cassNivel}</td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>{fmt(c.cass)} RON</td></tr>
                    <tr><td>CAS (25%) — {c.casNivel}</td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace" }}>{fmt(c.cas)} RON</td></tr>
                    <tr style={{ borderTop: "2px solid #111" }}><td><strong>Total taxe</strong></td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace", fontWeight: 700 }}>{fmt(c.totalTaxe)} RON</td></tr>
                    <tr><td><strong>Venit Net Rămas</strong></td><td style={{ textAlign: "right", fontFamily: "'Ubuntu Mono', monospace", fontWeight: 700, color: "#2e7d32" }}>{fmt(c.netEfectiv)} RON</td></tr>
                  </tbody>
                </table>

                {/* Footer */}
                <div style={{ marginTop: 32, paddingTop: 12, borderTop: "1px solid #ccc", fontSize: 9, color: "#999", textAlign: "center" }}>
                  Generat la {new Date().toLocaleDateString("ro-RO")} &middot; PFA Manager
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .checkbox-wrap { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: var(--tx-2); user-select: none; }
        .checkbox-wrap input { display: none; }
        .checkbox-wrap .box { width: 18px; height: 18px; border-radius: 4px; border: 2px solid var(--border-md); display: flex; align-items: center; justify-content: center; color: transparent; transition: all 0.2s; }
        .checkbox-wrap input:checked + .box { background: var(--ac); border-color: var(--ac); color: #fff; }
      `}</style>
    </div>
  );
}

function Row({ label, value, sub, highlight, red, color }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--border-light)" }}>
      <div>
        <div style={{ fontSize: 13, color: highlight ? "var(--tx-1)" : "var(--tx-2)", fontWeight: highlight ? 700 : 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: highlight ? 15 : 13, fontWeight: 700, color: color || (red ? "var(--red)" : "var(--tx-1)") }}>{value}</div>
      </div>
    </div>
  );
}
