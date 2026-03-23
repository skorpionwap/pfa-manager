import { useEffect, useState } from "react";
import { Info, AlertTriangle, CheckCircle2, TrendingUp, Receipt, Calculator, Settings as SettingsIcon, CalendarClock, BookOpen, GraduationCap, Gavel, ArrowRight, ChevronDown, Scale, Landmark, FileCheck, Shield } from "lucide-react";
import { getDb, getSetting, getFiscalOverrides, parseFiscalOverrides } from "@/lib/db";
import { FISCAL, FISCAL_YEARS, calculeaza, type An, type FiscalOverrides } from "@/lib/fiscal";
import type { OperatingMode, PfaMode } from "@/types";

export default function Fiscal() {
  const [an, setAn]               = useState<An>(2026);
  const [mode, setMode]           = useState<OperatingMode>("dda");
  const [pfaMode, setPfaMode]     = useState<PfaMode>("real");
  const [normaValue, setNormaValue] = useState(0);
  const [areSalariu, setAreSalariu] = useState(false);
  const [casBifat, setCasBifat]   = useState(false);
  const [tab, setTab]             = useState<"calcul" | "ghid">("calcul");
  
  const [isManual, setIsManual]   = useState(false);
  const [dbVenit, setDbVenit]     = useState(0);
  const [dbExpenses, setDbExpenses] = useState(0);
  const [manualVenit, setManualVenit] = useState("");
  const [manualExp, setManualExp] = useState("");
  
  const [loading, setLoading]     = useState(true);
  const [overrides, setOverrides] = useState<FiscalOverrides>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const m = (await getSetting("operating_mode")) as OperatingMode || "dda";
      const pm = (await getSetting("pfa_mode")) as PfaMode || "real";
      const nv = parseFloat(await getSetting("pfa_norma_valoare")) || 0;
      setMode(m); setPfaMode(pm); setNormaValue(nv);

      const raw = await getFiscalOverrides(Number(an));
      setOverrides(parseFiscalOverrides(raw, Number(an)));

      const start = `${an}-01-01`; const end = `${an}-12-31`;
      const invRows = await db.select<{ total: number }[]>("SELECT SUM(total) as total FROM invoices WHERE status = 'paid' AND date >= ? AND date <= ?", [start, end]);
      setDbVenit(invRows[0]?.total || 0);

      try {
        const expRows = await db.select<{ total: number }[]>("SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ?", [start, end]);
        setDbExpenses(expRows[0]?.total || 0);
      } catch { setDbExpenses(0); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [an]);

  const brut = isManual ? (parseFloat(manualVenit) || 0) : dbVenit;
  const exp  = isManual ? (parseFloat(manualExp) || 0) : dbExpenses;
  const c = calculeaza(brut, exp, an, mode, pfaMode, normaValue, areSalariu, casBifat, overrides);
  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });


  if (loading) return <div style={{ padding: 40, color: "var(--tx-3)" }}>Se încarcă...</div>;

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1000 }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 className="page-title">Fiscalitate & Taxe</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span className={`badge ${mode === "dda" ? "badge-blue" : "badge-amber"}`} style={{ textTransform: "uppercase", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
              {mode === "dda" ? "Drepturi de autor" : `PFA ${pfaMode === "real" ? "Sistem Real" : "Normă Venit"}`}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--tx-3)" }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--tx-4)" }} />
              Salariu minim {an}: <strong style={{ color: "var(--tx-1)" }}>{fmt(c.sm)} RON</strong>
            </div>
          </div>
        </div>
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
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", padding: 4, width: "fit-content" }}>
        <button onClick={() => setTab("calcul")} className={tab === "calcul" ? "btn-tab active" : "btn-tab"}>
          <Calculator size={15} /> Calculator Inteligente
        </button>
        <button onClick={() => setTab("ghid")} className={tab === "ghid" ? "btn-tab active" : "btn-tab"}>
          <GraduationCap size={15} /> Ghid Fiscal & Legislație
        </button>
      </div>

      {tab === "calcul" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32 }}>
          {/* Left Column: Inputs & Detail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Input Config Card */}
            <div className="card" style={{ padding: 24, background: "var(--bg-1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "var(--r-md)", background: "var(--ac-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <SettingsIcon size={16} color="var(--ac)" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Date de calcul</span>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 12px" }} onClick={() => setIsManual(!isManual)}>
                  {isManual ? "Conectează cu DB" : "Introducere manuală"}
                </button>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <Label>Venit Brut Anual (RON)</Label>
                  <div style={{ position: "relative" }}>
                    <input className="field" type="number" value={isManual ? manualVenit : dbVenit} 
                      readOnly={!isManual}
                      onChange={e => setManualVenit(e.target.value)} placeholder="0.00" 
                      style={{ paddingLeft: 12, background: isManual ? "var(--bg-1)" : "var(--bg-2)" }} />
                  </div>
                </div>
                <div>
                  <Label>Cheltuieli Duse (RON)</Label>
                  <input className="field" type="number" value={isManual ? manualExp : dbExpenses} 
                    readOnly={!isManual || mode === "dda"}
                    onChange={e => setManualExp(e.target.value)} placeholder="0.00" 
                    style={{ paddingLeft: 12, background: (!isManual || mode === "dda") ? "var(--bg-2)" : "var(--bg-1)" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 32, padding: "16px 0", borderTop: "1px solid var(--border)" }}>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={areSalariu} onChange={e => setAreSalariu(e.target.checked)} />
                  <div className="box"><CheckCircle2 size={12} /></div>
                  <span>Am și salariu activ (CIM)</span>
                </label>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={casBifat || c.casObligatoriu} disabled={c.casObligatoriu} onChange={e => setCasBifat(e.target.checked)} />
                  <div className="box"><CheckCircle2 size={12} /></div>
                  <span>Plătesc CAS voluntar</span>
                </label>
              </div>
            </div>

            {/* Detailed Table Card */}
            <div className="card" style={{ overflow: "hidden" }}>
               <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>Defalcare Impozite și Contribuții</span>
                  <span style={{ color: "var(--tx-3)", fontWeight: 400 }}>An fiscal {an}</span>
               </div>
               <div style={{ padding: "8px 24px" }}>
                  <Row label="Venit Brut Realizat" value={`${fmt(brut)} RON`} />

                  {mode === "dda" ? (
                    <Row label="Deducere forfetară (40%)" sub="Cheltuieli recunoscute automat fără acte" value={`− ${fmt(c.cheltuieliDeductibile)} RON`} red />
                  ) : (
                    pfaMode === "real" ? (
                      <Row label="Cheltuieli deductibile" sub="Din activitatea desfășurată" value={`− ${fmt(exp)} RON`} red />
                    ) : (
                      <Row label="Normă de venit" sub="Valoare stabilită de ANAF" value={`${fmt(normaValue)} RON`} highlight />
                    )
                  )}

                  <Row label="Venit Net (Baza de calcul)" sub="Suma la care se aplică taxele" value={`${fmt(c.venitNet)} RON`} highlight />

                  <div style={{ margin: "16px 0", borderTop: "1px dashed var(--border)" }} />

                  <Row label="Impozit pe venit (10%)" sub={mode === "pfa" ? "După scăderea CAS și CASS (PFA Real)" : "Din venitul net"} value={`${fmt(c.impozit)} RON`} red={c.impozit > 0} />
                  <Row label="CASS Sănătate (10%)" sub={c.cassNivel} value={`${fmt(c.cass)} RON`} red={c.cass > 0} />
                  <Row label="CAS Pensie (25%)" sub={c.casNivel} value={`${fmt(c.cas)} RON`} red={c.cas > 0} />
               </div>
               <div style={{ background: "var(--bg-2)", padding: "20px 24px", borderTop: "1px solid var(--border)" }}>
                  <Row label="Total taxe de plătit" value={`${fmt(c.totalTaxe)} RON`} highlight red />
                  <div style={{ marginTop: 12 }}>
                    <Row label="Venit Net Rămas (Bani în mână)" sub="După toate taxele" value={`${fmt(c.netEfectiv)} RON`} highlight color="var(--green)" />
                  </div>
               </div>
            </div>

            {/* ── Contextual info box ── */}
            <div className="card" style={{ padding: 16, borderLeft: "4px solid var(--ac)", background: "var(--ac)08", marginTop: 4 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Info size={15} color="var(--ac)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: "var(--tx-2)", lineHeight: 1.6 }}>
                  {mode === "dda" ? (
                    <>
                      <strong>Mod DDA:</strong> Statul îți recunoaște automat 40% din brut ca cheltuieli (nu ai nevoie de facturi).
                      Impozitul 10% se aplică pe ce rămâne. CASS folosește praguri fixe (6/12/24 SM). CAS e obligatoriu peste 12 SM.
                    </>
                  ) : pfaMode === "real" ? (
                    <>
                      <strong>PFA Sistem Real:</strong> Deduci cheltuielile reale cu facturi.
                      <strong>Avantaj:</strong> CAS și CASS se scad din baza de impozitare — plătești mai puțin impozit.
                      Adună cheltuielile în secțiunea Cheltuieli.
                    </>
                  ) : (
                    <>
                      <strong>PFA Normă de Venit:</strong> ANAF stabilește venitul estimat — nu aduci facturi.
                      Impozitul 10% se aplică direct la norma de venit.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Summaries & Dates */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="summary-stat">
              <div className="icon" style={{ color: "var(--ac)" }}><TrendingUp size={20} /></div>
              <div className="data">
                <div className="lab">Eficienta Venit</div>
                <div className="val">{c.rataRetentie.toFixed(1)}% <span style={{ fontSize: 12, fontWeight: 400, color: "var(--tx-3)" }}>din brut</span></div>
              </div>
            </div>

            <SummaryCard label="Venit Brut" val={fmt(brut)} color="var(--tx-1)" icon={<Receipt size={16} />} />
            <SummaryCard label="Taxe Totale" val={fmt(c.totalTaxe)} color="var(--red)" sub={`Echiv. ~${fmt(c.totalTaxe/12)} RON / lună`} icon={<AlertTriangle size={16} />} />
            <SummaryCard label="Venit Net" val={fmt(c.netEfectiv)} color="var(--green)" sub={`Suma curată după impozitare`} icon={<CheckCircle2 size={16} />} />
            
            <div className="card" style={{ padding: 20, background: "linear-gradient(135deg, var(--bg-3) 0%, var(--bg-2) 100%)", border: "1px solid var(--ac-dim)" }}>
               <div style={{ display: "flex", gap: 10, marginBottom: 12, color: "var(--ac)" }}>
                <CalendarClock size={18} />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Termen Declarație</span>
               </div>
               <div style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.5 }}>
                 Declarația Unică pentru veniturile din {an} trebuie depusă până la:
               </div>
               <div style={{ fontSize: 18, fontWeight: 800, color: "var(--tx-1)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                 {FISCAL[an].declarare}
               </div>
               <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ac)", fontWeight: 600, cursor: "pointer" }}>
                 DETALII PLATĂ <ArrowRight size={12} />
               </div>
            </div>
          </div>
        </div>
      )}

      {tab === "ghid" && <GhidFiscal />}


      <style>{`
        .btn-tab { flex: 1; padding: 12px 20px; border: none; background: transparent; border-radius: var(--r-lg); cursor: pointer; font-size: 14px; color: var(--tx-3); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 500; }
        .btn-tab.active { background: var(--bg-1); color: var(--ac); font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid var(--border-md); }
        
        .checkbox-wrap { display: flex; alignItems: center; gap: 10px; cursor: pointer; font-size: 13px; color: var(--tx-2); user-select: none; }
        .checkbox-wrap input { display: none; }
        .checkbox-wrap .box { width: 18px; height: 18px; border-radius: 4px; border: 2px solid var(--border-md); display: flex; align-items: center; justify-content: center; color: transparent; transition: all 0.2s; }
        .checkbox-wrap input:checked + .box { background: var(--ac); border-color: var(--ac); color: #fff; }
        
        .summary-stat { background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 16px; display: flex; gap: 16px; align-items: center; }
        .summary-stat .icon { width: 44px; height: 44px; border-radius: 12px; background: var(--bg-2); display: flex; align-items: center; justify-content: center; }
        .summary-stat .lab { fontSize: 11px; fontWeight: 700; color: var(--tx-3); textTransform: uppercase; marginBottom: 2px; }
        .summary-stat .val { fontSize: 18px; fontWeight: 800; color: var(--tx-1); }

        .ghid-section { margin-bottom: 32px; }
        .ghid-section h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: var(--tx-1); }
        .ghid-section p { font-size: 14px; color: var(--tx-2); line-height: 1.7; margin-bottom: 12px; }
        .ghid-section ul { padding-left: 20px; font-size: 14px; color: var(--tx-2); line-height: 1.8; }
        .ghid-section strong { color: var(--tx-1); }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, val, color, sub, icon }: { label: string; val: string; color: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, borderLeft: `4px solid ${color}`, display: "flex", gap: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-4)", textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.02em" }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "var(--font-mono)" }}>{val} <span style={{ fontSize: 13, fontWeight: 400 }}>RON</span></div>
        {sub && <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
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

function Label({ children }: any) {
  return <div style={{ fontSize: 11, color: "var(--tx-4)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GHID FISCAL — Componentă separată, secțiuni colapsabile
   ═══════════════════════════════════════════════════════════════════════════ */

function GhidFiscal() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    dda: true, pfa: true, cass: true, cas: true, impozit: true, declaratii: false, termeni: false, sfaturi: true,
  });

  const toggle = (key: string) => setOpen(s => ({ ...s, [key]: !s[key] }));

  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });
  const sm = 4200; // 2026

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 28, background: "linear-gradient(135deg, var(--bg-3) 0%, var(--bg-2) 100%)", border: "1px solid var(--ac-dim)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--ac-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={22} color="var(--ac)" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--tx-1)" }}>Ghid Fiscal & Legislație</h2>
            <p style={{ fontSize: 13, color: "var(--tx-3)", marginTop: 2 }}>Explicații clare pentru dezvoltatori IT independenți în România</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span className="badge badge-blue" style={{ fontSize: 11 }}>Codul Fiscal nr. 227/2015</span>
          <span className="badge badge-green" style={{ fontSize: 11 }}>Legea 296/2023 (CASS)</span>
          <span className="badge badge-muted" style={{ fontSize: 11 }}>Codul de Procedură Fiscală</span>
          <span className="badge badge-purple" style={{ fontSize: 11 }}>SM 2026: {fmt(sm)} RON</span>
        </div>
      </div>

      {/* ── Accordion sections ──────────────────────────────────────────── */}
      <Accordion id="dda" icon={<FileCheck size={18} />} title="Drepturi de Autor (DDA) — Tot ce trebuie să știi" open={open.dda} toggle={toggle} accent="var(--blue)">
        <div className="ghid-section">
          <h3>Ce sunt Drepturile de Autor?</h3>
          <p>Veniturile din drepturi de autor (art. 7 din Codul Fiscal) sunt remunerațiile primite pentru crearea de opere literare, artistice, științifice sau software. Ca dezvoltator IT, poți încasa venituri din DDA dacă ești autorul de soft pe care îl vinzi sau licențiezi.</p>
        </div>

        <div className="ghid-section">
          <h3>Cum funcționează impozitarea?</h3>
          <p>La DDA, statul îți recunoaște automat <strong>40% cheltuieli forfetare</strong> — adică presupune că ai cheltuit 40% din venituri pentru a produce opera. Nu trebuie să aduci facturi sau dovezi.</p>
          <div style={{ background: "var(--bg-2)", borderRadius: "var(--r-md)", padding: 16, marginTop: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Exemplu practic (2026)</div>
            <ExampleRow label="Venit brut anual" value="60.000 RON" />
            <ExampleRow label="Cheltuială forfetară (40%)" value="-24.000 RON" red />
            <ExampleRow label="Venit net impozabil" value="36.000 RON" bold />
            <ExampleRow label="Impozit 10%" value="-3.600 RON" red />
            <ExampleRow label="CASS (prag 12 SM = 50.400 RON)" value="-5.040 RON" red />
            <ExampleRow label="CAS (obligatoriu peste 12 SM)" value="-12.600 RON" red />
            <div style={{ borderTop: "2px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
              <ExampleRow label="Bani în mână" value="38.760 RON" green bold />
            </div>
          </div>
        </div>

        <div className="ghid-section">
          <h3>Avantaje și dezavantaje</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 14, borderRadius: "var(--r-md)", background: "rgba(82,183,136,0.06)", border: "1px solid rgba(82,183,136,0.15)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 8 }}>Avantaje</div>
              <ul style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.8 }}>
                <li>Nu ai nevoie de facturi pentru cheltuieli</li>
                <li>Administrare simplă</li>
                <li>Retenție la sursă de către beneficiar</li>
              </ul>
            </div>
            <div style={{ padding: 14, borderRadius: "var(--r-md)", background: "rgba(235,87,87,0.06)", border: "1px solid rgba(235,87,87,0.15)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>Dezavantaje</div>
              <ul style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.8 }}>
                <li>Forfetarul e fix la 40% — nu poți deduce mai mult</li>
                <li>TVA nu se aplică (limitare pentru clienți corporate)</li>
                <li>Necesită înregistrare la ANAF</li>
              </ul>
            </div>
          </div>
        </div>
      </Accordion>

      <Accordion id="pfa" icon={<Landmark size={18} />} title="PFA (Persoană Fizică Autorizată) — Sistem Real & Normă de Venit" open={open.pfa} toggle={toggle} accent="var(--ac)">
        <div className="ghid-section">
          <h3>Ce este un PFA?</h3>
          <p>Un PFA (Persoană Fizică Autorizată) este o formă de organizare pentru persoanele fizice care desfășoară activități independente. Ca dezvoltator IT, poți emite facturi cu TVA, ai mai multă flexibilitate în tipurile de venituri, și poți deduce cheltuielile reale.</p>
        </div>

        <div className="ghid-section">
          <h3>Cele două sub-moduri</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 16, borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ac)", marginBottom: 6 }}>Sistem Real</div>
              <p style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.6 }}>Deduci <strong>cheltuielile reale</strong> (laptop, internet, cursuri, contabil). Trebuie să ai facturi și documente justificative. CAS și CASS sunt deductibile din baza de impozitare.</p>
              <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--bg-3)", borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--tx-3)" }}>
                Ideal dacă: ai cheltuieli mari, investești în echipamente
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", marginBottom: 6 }}>Normă de Venit</div>
              <p style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.6 }}>ANAF stabilește un venit estimat pe care îl consideră realizat. Nu trebuie să aduci facturi. Simplu, dar nu poți deduce nimic și e mai puțin flexibil.</p>
              <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--bg-3)", borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--tx-3)" }}>
                Ideal dacă: activitate constantă, venituri stabile, puține cheltuieli
              </div>
            </div>
          </div>
        </div>

        <div className="ghid-section">
          <h3>Exemplu practic — PFA Sistem Real (2026)</h3>
          <div style={{ background: "var(--bg-2)", borderRadius: "var(--r-md)", padding: 16, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Scenariu: 60.000 RON venit brut, 15.000 RON cheltuieli reale</div>
            <ExampleRow label="Venit brut anual" value="60.000 RON" />
            <ExampleRow label="Cheltuieli reale (laptop, cursuri, etc.)" value="-15.000 RON" red />
            <ExampleRow label="Venit net" value="45.000 RON" bold />
            <ExampleRow label="CASS 10% din venit net" value="-4.500 RON" red />
            <ExampleRow label="CAS 25% (obligatoriu peste 12 SM)" value="-12.600 RON" red />
            <ExampleRow label="Venit impozabil (după CAS+CASS)" value="27.900 RON" bold />
            <ExampleRow label="Impozit 10%" value="-2.790 RON" red />
            <div style={{ borderTop: "2px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
              <ExampleRow label="Bani în mână" value="40.110 RON" green bold />
            </div>
          </div>
        </div>
      </Accordion>

      <Accordion id="cass" icon={<Shield size={18} />} title="CASS — Asigurări de Sănătate (10%)" open={open.cass} toggle={toggle} accent="var(--green)">
        <div className="ghid-section">
          <h3>Ce este CASS?</h3>
          <p>Contribuția de Asigurări Sociale de Sănătate (CASS) finanțează sistemul public de sănătate. O plătești pentru a avea acces la servicii medicale prin CNAS. Cota este de <strong>10%</strong> din baza de calcul.</p>
        </div>

        <div className="ghid-section">
          <h3>Praguri DDA (praguri fixe)</h3>
          <div className="ghid-table">
            <table>
              <thead><tr><th>Venit Net Anual</th><th>Bază CASS</th><th>CASS de plătit</th></tr></thead>
              <tbody>
                <tr><td>Sub 6 SM ({fmt(6*sm)} RON)</td><td>0 (sau scutit dacă salariat)</td><td>0 RON</td></tr>
                <tr><td>6–12 SM</td><td>6 SM = {fmt(6*sm)} RON</td><td>{fmt(6*sm*0.1)} RON</td></tr>
                <tr><td>12–24 SM</td><td>12 SM = {fmt(12*sm)} RON</td><td>{fmt(12*sm*0.1)} RON</td></tr>
                <tr><td>Peste 24 SM</td><td>24 SM = {fmt(24*sm)} RON (max)</td><td>{fmt(24*sm*0.1)} RON</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="ghid-section">
          <h3>Praguri PFA (10% din venit, cu plafon) — Legea 296/2023</h3>
          <div className="ghid-table">
            <table>
              <thead><tr><th>Venit Net Anual</th><th>Bază CASS</th><th>CASS de plătit</th></tr></thead>
              <tbody>
                <tr><td>Sub 6 SM, neasigurat</td><td>Minim 6 SM = {fmt(6*sm)} RON</td><td>{fmt(6*sm*0.1)} RON</td></tr>
                <tr><td>Sub 6 SM, salariat</td><td>Venitul real</td><td>10% din venit</td></tr>
                <tr><td>6–60 SM</td><td>10% din venit net</td><td>10% din venit net</td></tr>
                <tr><td>Peste 60 SM</td><td>60 SM = {fmt(60*sm)} RON (max)</td><td>{fmt(60*sm*0.1)} RON</td></tr>
              </tbody>
            </table>
          </div>
          <TipBox>La PFA, dacă ai și un salariu activ (CIM cu normă întreagă), plătești CASS la nivelul venitului real, nu la minimul de 6 SM. Dar plătești totuși — nu ești scutit.</TipBox>
        </div>
      </Accordion>

      <Accordion id="cas" icon={<Scale size={18} />} title="CAS — Pensie (25%)" open={open.cas} toggle={toggle} accent="var(--purple)">
        <div className="ghid-section">
          <h3>Ce este CAS?</h3>
          <p>Contribuția de Asigurări Sociale (CAS) finanțează pensia. Cota este <strong>25%</strong> din baza de calcul. La DDA și PFA, nu e obligatorie dacă venitul net anual e sub 12 salarii minime.</p>
        </div>

        <div className="ghid-section">
          <h3>Praguri (aceleași pentru DDA și PFA)</h3>
          <div className="ghid-table">
            <table>
              <thead><tr><th>Venit Net Anual</th><th>Bază CAS</th><th>CAS de plătit</th><th>Obligatoriu?</th></tr></thead>
              <tbody>
                <tr><td>Sub 12 SM ({fmt(12*sm)} RON)</td><td>Opțional: 12 SM</td><td>{fmt(12*sm*0.25)} RON</td><td><span className="badge badge-muted">Opțional</span></td></tr>
                <tr><td>12–24 SM</td><td>12 SM = {fmt(12*sm)} RON</td><td>{fmt(12*sm*0.25)} RON</td><td><span className="badge badge-yellow">Da</span></td></tr>
                <tr><td>Peste 24 SM</td><td>24 SM = {fmt(24*sm)} RON (max)</td><td>{fmt(24*sm*0.25)} RON</td><td><span className="badge badge-yellow">Da</span></td></tr>
              </tbody>
            </table>
          </div>
          <TipBox>Dacă depășești 12 SM, CAS devine <strong>obligatoriu</strong>. Dacă ești sub 12 SM, poți alege să plătești voluntar — ani de contribuție în plus pentru pensie.</TipBox>
        </div>

        <div className="ghid-section">
          <h3>Diferență importantă: PFA Real</h3>
          <p>La PFA în sistem real, <strong>CAS și CASS sunt deductibile</strong> din baza de impozitare. Asta înseamnă că impozitul de 10% se calculează doar pe ce rămâne după ce plătești CAS și CASS — deci taxa totală e mai mică decât la DDA.</p>
        </div>
      </Accordion>

      <Accordion id="impozit" icon={<Calculator size={18} />} title="Impozit pe Venit (10%)" open={open.impozit} toggle={toggle} accent="var(--red)">
        <div className="ghid-section">
          <h3>Cota unică de 10%</h3>
          <p>România are o cotă unică de impozit pe venit de <strong>10%</strong> (art. 61 din Codul Fiscal). Se aplică la baza de calcul after deducting cheltuielile.</p>
        </div>

        <div className="ghid-section">
          <h3>Baza de calcul — diferă per mod</h3>
          <div className="ghid-table">
            <table>
              <thead><tr><th>Mod</th><th>Baza de calcul</th><th>Formula</th></tr></thead>
              <tbody>
                <tr><td><span className="badge badge-blue">DDA</span></td><td>Venit net (după 40% forfetar)</td><td>(Brut - 40%) × 10%</td></tr>
                <tr><td><span className="badge badge-amber">PFA Real</span></td><td>Venit net - CAS - CASS</td><td>(Brut - Cheltuieli - CAS - CASS) × 10%</td></tr>
                <tr><td><span className="badge badge-muted">PFA Normă</span></td><td>Norma de venit</td><td>Normă × 10%</td></tr>
              </tbody>
            </table>
          </div>
          <TipBox accent="var(--green)">La PFA Real, pentru că CAS și CASS se scad din baza de impozitare, cota efectivă de impozitare e mai mică decât 10% din brut. De exemplu, din 60.000 RON brut poți rămâne cu peste 40.000 RON net.</TipBox>
        </div>
      </Accordion>

      <Accordion id="declaratii" icon={<FileCheck size={18} />} title="Declarații și Termene" open={open.declaratii} toggle={toggle}>
        <div className="ghid-section">
          <h3>Declarația Unică</h3>
          <p>Declarația Unică se depune anual până la <strong>25 mai</strong> pentru veniturile din anul precedent. Cuprinde impozitul pe venit, CASS și CAS. Se depune online prin SPV (Spațiul Privat Virtual) sau la ghișeul ANAF.</p>
        </div>

        <div className="ghid-section">
          <h3>Calendar fiscal pe scurt</h3>
          <div className="ghid-table">
            <table>
              <thead><tr><th>Termen</th><th>Obligație</th></tr></thead>
              <tbody>
                <tr><td><strong>Lunar, până pe 25</strong></td><td>Plata CAS/CASS dacă optezi pentru plata în rate (dacă veniturile sunt estimate)</td></tr>
                <tr><td><strong>25 mai</strong></td><td>Depunerea Declarației Unice + plata diferențelor</td></tr>
                <tr><td><strong>Decembrie</strong></td><td>Estimarea veniturilor pentru anul următor (opțional)</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="ghid-section">
          <h3>Reținere la sursă</h3>
          <p>Dacă beneficiarul tău este o firmă românească, aceasta poate reține impozitul și contribuțiile direct la plată (art. 58-60 Cod Fiscal). În acest caz, tu nu mai depui Declarația Unică pentru impozit — doar pentru CAS/CASS dacă e cazul.</p>
        </div>
      </Accordion>

      <Accordion id="termeni" icon={<Gavel size={18} />} title="Glosar de Termeni Fiscali" open={open.termeni} toggle={toggle}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Termen term="SM (Salariu Minim)" def="Salariul minim brut pe economie stabilit prin HG. În 2026: 4.200 RON." />
          <Termen term="CASS" def="Contribuție Asigurări Sociale de Sănătate — 10%. Finanțează sistemul medical." />
          <Termen term="CAS" def="Contribuție Asigurări Sociale — 25%. Finanțează pensia." />
          <Termen term="Forfetar" def="Procent fix recunoscut ca cheltuială fără dovezi. La DDA: 40%." />
          <Termen term="Normă de venit" def="Venit estimat de ANAF pentru anumite activități PFA. Nu necesită facturi." />
          <Termen term="Declarația Unică" def="Formularul unic de declarare a veniturilor, impozitului și contribuțiilor sociale." />
          <Termen term="Bază de calcul" def="Suma la care se aplică procentul de impozit/contribuție." />
          <Termen term="Retenție la sursă" def="Când plătitorul reține automat impozitul înainte de a-ți transfera banii." />
          <Termen term="CNAS" def="Casa Națională de Asigurări de Sănătate — instituția care gestionează CASS." />
          <Termen term="SPV" def="Spațiul Privat Virtual — platforma online ANAF pentru declarații și plăți." />
          <Termen term="ANAF" def="Agenția Națională de Administrare Fiscală — autoritatea fiscală din România." />
          <Termen term="CIM" def="Contract Individual de Muncă — contractul de angajat cu normă întreagă." />
        </div>
      </Accordion>

      <Accordion id="sfaturi" icon={<Info size={18} />} title="Sfaturi Practice pentru Dezvoltatori" open={open.sfaturi} toggle={toggle} accent="var(--ac)">
        <div className="ghid-section">
          <h3>Optimizează-ți taxele legal</h3>
          <ul style={{ fontSize: 14, color: "var(--tx-2)", lineHeight: 2 }}>
            <li><strong>La PFA Real, colectează facturi</strong> — laptop, monitor, telefon, internet, cursuri online, servicii contabile, abonamente software. Totul e deductibil.</li>
            <li><strong>Dacă ești salariat și ai DDA sub 6 SM</strong> — nu plătești CASS la DDA, dar la PFA plătești oricum.</li>
            <li><strong>CAS voluntar merită</strong> dacă ești aproape de 12 SM — ani de contribuție în plus pentru pensie.</li>
            <li><strong>Ține un registru de cheltuieli</strong> — folosește secțiunea Cheltuieli din aplicație.</li>
            <li><strong>Depune Declarația Unică la timp</strong> — amânările atrag dobânzi și penalități (0.1%/zi).</li>
            <li><strong>Verifică SPV regulat</strong> — uneori ANAF actualizează praguri sau termene.</li>
          </ul>
        </div>

        <TipBox accent="var(--ac)">
          <strong>Regula de aur:</strong> La PFA Sistem Real cu cheltuieli mari (laptop + cursuri + echipament), poți avea o rată de retenție mai bună decât la DDA. La DDA forfetarul e doar 40%, dar tu poate ai cheltuieli de 60%+ din venituri.
        </TipBox>

        <div className="card" style={{ padding: 20, borderLeft: "4px solid var(--red)", background: "rgba(235,87,87,0.04)" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <AlertTriangle size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--red)" }}>Atenție</div>
              <div style={{ fontSize: 13, color: "var(--tx-3)", lineHeight: 1.6 }}>
                Acest ghid are rol informativ și nu înlocuiește consultanța fiscală profesională. Legislatia se schimbă frecvent — verifică întotdeauna pe <strong>ANAF.ro</strong> sau cu un contabil autorizat înainte de a lua decizii fiscale.
              </div>
            </div>
          </div>
        </div>
      </Accordion>

      <style>{`
        .ghid-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ghid-table th { text-align: left; padding: 10px 14px; background: var(--bg-3); font-weight: 700; font-size: 11px; color: var(--tx-3); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); }
        .ghid-table td { padding: 10px 14px; color: var(--tx-2); border-bottom: 1px solid var(--border-light); }
        .ghid-table tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}

/* ── Sub-components pentru Ghid ──────────────────────────────────────── */

function Accordion({ id, icon, title, open, toggle, accent, children }: {
  id: string; icon: React.ReactNode; title: string; open: boolean; toggle: (id: string) => void; accent?: string; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button
        onClick={() => toggle(id)}
        style={{
          width: "100%", padding: "18px 24px", border: "none", background: "transparent",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", color: "var(--tx-1)", textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: accent ? `${accent}18` : "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", color: accent || "var(--tx-3)" }}>
            {icon}
          </div>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        </div>
        <ChevronDown size={18} style={{ color: "var(--tx-3)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{ padding: "0 24px 24px", borderTop: "1px solid var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ExampleRow({ label, value, red, green, bold }: { label: string; value: string; red?: boolean; green?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: bold ? "var(--tx-1)" : "var(--tx-3)", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: bold ? 700 : 500, color: green ? "var(--green)" : red ? "var(--red)" : "var(--tx-1)" }}>{value}</span>
    </div>
  );
}

function TipBox({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="card" style={{ padding: 16, marginTop: 14, borderLeft: `4px solid ${accent || "var(--ac)"}`, background: `${accent || "var(--ac)"}08` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Info size={16} style={{ color: accent || "var(--ac)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

function Termen({ term, def }: { term: string; def: string }) {
  return (
    <div style={{ padding: 12, borderRadius: "var(--r-md)", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>{term}</div>
      <div style={{ fontSize: 13, color: "var(--tx-3)", lineHeight: 1.5 }}>{def}</div>
    </div>
  );
}

