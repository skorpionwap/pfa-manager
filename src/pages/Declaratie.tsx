import { useEffect, useState } from "react";
import { Printer, CheckCircle2, Info, ChevronDown, AlertTriangle } from "lucide-react";
import { getSetting, getFiscalOverrides, parseFiscalOverrides } from "@/lib/db";
import { fetchAnnualData } from "@/lib/raport";
import { calculeaza, FISCAL, FISCAL_YEARS, type An, type CalculeResult, type FiscalOverrides } from "@/lib/fiscal";
import type { OperatingMode, PfaMode } from "@/types";

interface Rubric {
  id: string;
  section: string;
  label: string;
  value: number;
  unit: string;
  note?: string;
  highlight?: boolean;
}

function buildRubrics(
  mode: OperatingMode,
  pfaMode: PfaMode,
  c: CalculeResult,
  brut: number,
  expenses: number,
  normaValue: number,
): Rubric[] {
  if (mode === "dda") {
    return [
      { id: "1.1", section: "I. Venituri", label: "Venituri din drepturi de autor (brut)", value: brut, unit: "RON" },
      { id: "1.2", section: "I. Venituri", label: "Cheltuieli deductibile — forfetar 40%", value: c.cheltuieliDeductibile, unit: "RON" },
      { id: "1.3", section: "I. Venituri", label: "Venit net anual", value: c.venitNet, unit: "RON", highlight: true },
      { id: "2.1", section: "II. CASS", label: `Baza de calcul CASS (${c.cassNivel})`, value: c.cassBase, unit: "RON" },
      { id: "2.2", section: "II. CASS", label: "CASS datorată (10%)", value: c.cass, unit: "RON" },
      { id: "3.1", section: "III. CAS", label: `Baza de calcul CAS (${c.casNivel})`, value: c.casBase, unit: "RON" },
      { id: "3.2", section: "III. CAS", label: "CAS datorată (25%)", value: c.cas, unit: "RON" },
      { id: "4.1", section: "IV. Impozit", label: "Baza de calcul impozit", value: c.venitNet, unit: "RON" },
      { id: "4.2", section: "IV. Impozit", label: "Impozit pe venit datorat (10%)", value: c.impozit, unit: "RON" },
      { id: "5.1", section: "V. Total", label: "Total obligații fiscale", value: c.totalTaxe, unit: "RON", highlight: true },
    ];
  }

  if (pfaMode === "real") {
    const bazaImpozit = Math.max(0, c.venitNet - c.cas - c.cass);
    return [
      { id: "1.1", section: "I. Venituri", label: "Venituri din activități independente (brut)", value: brut, unit: "RON" },
      { id: "1.2", section: "I. Venituri", label: "Cheltuieli efectuate (reale)", value: expenses, unit: "RON" },
      { id: "1.3", section: "I. Venituri", label: "Venit net anual", value: c.venitNet, unit: "RON", highlight: true },
      { id: "2.1", section: "II. CASS", label: `Baza de calcul CASS (${c.cassNivel})`, value: c.cassBase, unit: "RON" },
      { id: "2.2", section: "II. CASS", label: "CASS datorată (10%)", value: c.cass, unit: "RON" },
      { id: "3.1", section: "III. CAS", label: `Baza de calcul CAS (${c.casNivel})`, value: c.casBase, unit: "RON" },
      { id: "3.2", section: "III. CAS", label: "CAS datorată (25%)", value: c.cas, unit: "RON" },
      { id: "4.1", section: "IV. Impozit", label: "Baza de calcul impozit (venit net - CAS - CASS)", value: bazaImpozit, unit: "RON" },
      { id: "4.2", section: "IV. Impozit", label: "Impozit pe venit datorat (10%)", value: c.impozit, unit: "RON" },
      { id: "5.1", section: "V. Total", label: "Total obligații fiscale", value: c.totalTaxe, unit: "RON", highlight: true },
    ];
  }

  // PFA Normă
  return [
    { id: "1.1", section: "I. Venituri", label: "Venituri brute realizate", value: brut, unit: "RON" },
    { id: "1.2", section: "I. Venituri", label: "Normă de venit (stabilită de ANAF)", value: normaValue, unit: "RON" },
    { id: "2.1", section: "II. CASS", label: `Baza de calcul CASS (${c.cassNivel})`, value: c.cassBase, unit: "RON" },
    { id: "2.2", section: "II. CASS", label: "CASS datorată (10%)", value: c.cass, unit: "RON" },
    { id: "3.1", section: "III. CAS", label: `Baza de calcul CAS (${c.casNivel})`, value: c.casBase, unit: "RON" },
    { id: "3.2", section: "III. CAS", label: "CAS datorată (25%)", value: c.cas, unit: "RON" },
    { id: "4.1", section: "IV. Impozit", label: "Baza de calcul impozit (norma de venit)", value: normaValue, unit: "RON" },
    { id: "4.2", section: "IV. Impozit", label: "Impozit pe venit datorat (10%)", value: c.impozit, unit: "RON" },
    { id: "5.1", section: "V. Total", label: "Total obligații fiscale", value: c.totalTaxe, unit: "RON", highlight: true },
  ];
}

const EXPLANATIONS: Record<string, { title: string; text: string }[]> = {
  dda: [
    { title: "Rubrica 1.1 — Venituri din drepturi de autor", text: "Suma totală a facturilor încasate în anul {an} pentru care ai cesionat drepturi de autor. Include toate facturile cu statusul 'Încasată'." },
    { title: "Rubrica 1.2 — Forfetar 40%", text: "La DDA, statul recunoaște automat 40% din venituri ca fiind cheltuieli de producție. Nu ai nevoie de facturi justificative. Dacă ai cheltuieli reale mai mari de 40%, poți opta pentru deducerea cheltuielilor reale (mai complex administrativ)." },
    { title: "Rubrica 1.3 — Venit net", text: "Venitul brut minus cheltuielile deductibile (forfetar sau reale). Acesta este venitul pe care se calculează impozitul." },
    { title: "Rubrica 2.1-2.2 — CASS", text: "Contribuția de Asigurări de Sănătate (10%). La DDA se aplică praguri fixe: 6/12/24 salarii minime. Dacă ai și un salariu activ și venitul net e sub 6 SM, ești scutit." },
    { title: "Rubrica 3.1-3.2 — CAS", text: "Contribuția de Asigurări Sociale pentru pensie (25%). Devine obligatorie dacă venitul net depășește 12 SM. Sub 12 SM, poți plăti voluntar pentru ani de contribuție în plus." },
    { title: "Rubrica 4.1-4.2 — Impozit", text: "Impozitul pe venit de 10% se aplică la venitul net. La DDA, baza de calcul e simplă: venit net = brut - 40%." },
  ],
  pfa_real: [
    { title: "Rubrica 1.1 — Venituri din activități independente", text: "Suma totală a facturilor încasate în anul {an}. Include toate facturile cu statusul 'Încasată'." },
    { title: "Rubrica 1.2 — Cheltuieli efectuate", text: "Suma totală a cheltuielilor reale din anul {an}. Acestea trebuie justificate cu facturi și documente (laptop, cursuri, internet, contabil, etc.)." },
    { title: "Rubrica 1.3 — Venit net", text: "Venitul brut minus cheltuielile reale. Acesta e baza pentru CASS și CAS." },
    { title: "Rubrica 2.1-2.2 — CASS", text: "La PFA, CASS e 10% din venitul net, plafonat între 6 și 60 SM. Dacă ești salariat, plătești la nivelul venitului real (dar tot plătești). Dacă nu ești asigurat, minimul e 6 SM." },
    { title: "Rubrica 3.1-3.2 — CAS", text: "CAS e 25% din baza de calcul. Obligatoriu peste 12 SM venit net. Important: la PFA Real, CAS și CASS se deduc din baza de impozitare, deci plătești mai puțin impozit decât la DDA." },
    { title: "Rubrica 4.1-4.2 — Impozit", text: "La PFA Real, impozitul 10% se aplică la (venit net - CAS - CASS). Aceasta e o deducere importantă față de DDA unde impozitul se calculează doar pe venitul net." },
  ],
  pfa_norma: [
    { title: "Rubrica 1.1 — Venituri brute", text: "Suma totală a facturilor încasate (informativ). La norma de venit, impozitul se calculează pe norma stabilită de ANAF, nu pe venitul real." },
    { title: "Rubrica 1.2 — Normă de venit", text: "Valoarea fixă stabilită de ANAF pentru activitatea ta. Se declară în Declarația Unică." },
    { title: "CASS, CAS, Impozit", text: "Se calculează pe baza normei de venit, similar cu PFA Real. CASS plafonat 6-60 SM, CAS 25% peste 12 SM, impozit 10% din norma." },
  ],
};

export default function Declaratie() {
  const [an, setAn]               = useState<An>(2026);
  const [data, setData]           = useState<{ totalVenituri: number; totalCheltuieli: number } | null>(null);
  const [mode, setMode]           = useState<OperatingMode>("dda");
  const [pfaMode, setPfaMode]     = useState<PfaMode>("real");
  const [normaValue, setNormaValue] = useState(0);
  const [areSalariu, setAreSalariu] = useState(false);
  const [casBifat, setCasBifat]   = useState(false);
  const [tab, setTab]             = useState<"rubrici" | "explicatii">("rubrici");
  const [loading, setLoading]     = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [overrides, setOverrides] = useState<FiscalOverrides>({});

  const [userName, setUserName]   = useState("");
  const [userCif, setUserCif]     = useState("");
  const [userAddress, setUserAddress] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await fetchAnnualData(an);
        setData({ totalVenituri: d.totalVenituri, totalCheltuieli: d.totalCheltuieli });
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

  useEffect(() => {
    if (!showPrint) return;
    window.print();
    setShowPrint(false);
  }, [showPrint]);

  if (loading || !data) return <div style={{ padding: 40, color: "var(--tx-3)" }}>Se încarcă...</div>;

  const c = calculeaza(data.totalVenituri, data.totalCheltuieli, an, mode, pfaMode, normaValue, areSalariu, casBifat, overrides);
  const rubrics = buildRubrics(mode, pfaMode, c, data.totalVenituri, data.totalCheltuieli, normaValue);
  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });

  const modeLabel = mode === "dda" ? "Drepturi de autor" : `PFA ${pfaMode === "real" ? "Sistem Real" : "Normă de Venit"}`;
  const explKey = mode === "dda" ? "dda" : pfaMode === "real" ? "pfa_real" : "pfa_norma";
  const explanations = EXPLANATIONS[explKey] || [];

  const sections = Array.from(new Set(rubrics.map(r => r.section)));
  const handlePrint = () => setShowPrint(true);

  return (
    <div style={{ padding: "36px 40px", maxWidth: 900 }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="page-title">Declarație Unică</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span className={`badge ${mode === "dda" ? "badge-blue" : "badge-amber"}`} style={{ textTransform: "uppercase", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
              {modeLabel}
            </span>
            <span style={{ fontSize: 12, color: "var(--tx-3)" }}>
              Termen: <strong>{FISCAL[an].declarare}</strong>
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

      {/* ── Info box ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 16, borderLeft: "4px solid var(--ac)", background: "var(--ac)08", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={15} color="var(--ac)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "var(--tx-2)", lineHeight: 1.6 }}>
            Aceste valori sunt calculate automat din facturile și cheltuielile tale. Folosește-le ca referință când completezi Declarația Unică pe <strong>SPV (Spațiul Privat Virtual)</strong> al ANAF sau la ghișeu.
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", padding: 4, width: "fit-content" }}>
        <button onClick={() => setTab("rubrici")} style={{ padding: "10px 20px", borderRadius: "var(--r-lg)", border: "none", background: tab === "rubrici" ? "var(--bg-1)" : "transparent", color: tab === "rubrici" ? "var(--ac)" : "var(--tx-3)", fontSize: 13, fontWeight: tab === "rubrici" ? 700 : 500, cursor: "pointer", transition: "all 0.2s" }}>
          Rubrici
        </button>
        <button onClick={() => setTab("explicatii")} style={{ padding: "10px 20px", borderRadius: "var(--r-lg)", border: "none", background: tab === "explicatii" ? "var(--bg-1)" : "transparent", color: tab === "explicatii" ? "var(--ac)" : "var(--tx-3)", fontSize: 13, fontWeight: tab === "explicatii" ? 700 : 500, cursor: "pointer", transition: "all 0.2s" }}>
          Explicații
        </button>
      </div>

      {/* ── Rubrici Tab ─────────────────────────────────────────────────────── */}
      {tab === "rubrici" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Contributor info */}
          <div className="card" style={{ padding: "18px 24px", background: "var(--bg-1)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Date contribuabil</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><span style={{ fontSize: 11, color: "var(--tx-4)" }}>Nume:</span> <strong style={{ fontSize: 13, color: "var(--tx-1)" }}>{userName || "—"}</strong></div>
              <div><span style={{ fontSize: 11, color: "var(--tx-4)" }}>CIF/CNP:</span> <strong style={{ fontSize: 13, color: "var(--tx-1)" }}>{userCif || "—"}</strong></div>
              <div style={{ gridColumn: "1/-1" }}><span style={{ fontSize: 11, color: "var(--tx-4)" }}>Adresă:</span> <strong style={{ fontSize: 13, color: "var(--tx-1)" }}>{userAddress || "—"}</strong></div>
            </div>
          </div>

          {/* Rubric sections */}
          {sections.map(section => {
            const rows = rubrics.filter(r => r.section === section);
            return (
              <div key={section} className="card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", fontWeight: 700, fontSize: 13 }}>
                  {section}
                </div>
                <div>
                  {rows.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid var(--border-light)" }}>
                      <div style={{ width: 50, fontWeight: 700, fontSize: 12, color: "var(--ac)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{r.id}</div>
                      <div style={{ flex: 1, fontSize: 13, color: "var(--tx-2)" }}>{r.label}</div>
                      <div style={{
                        width: 160, textAlign: "right", fontFamily: "var(--font-mono)",
                        fontSize: r.highlight ? 15 : 13, fontWeight: r.highlight ? 800 : 600,
                        color: r.highlight ? "var(--tx-1)" : r.value > 0 ? "var(--red)" : "var(--tx-4)",
                        flexShrink: 0,
                      }}>
                        {r.value > 0 ? fmt(r.value) : "0,00"} {r.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Net summary */}
          <div className="card" style={{ padding: "20px 24px", background: "rgba(82,183,136,0.04)", border: "1px solid rgba(82,183,136,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--green)" }}>Venit net rămas</div>
                <div style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 4 }}>După plata tuturor obligațiilor fiscale</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--green)" }}>
                {fmt(c.netEfectiv)} RON
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 12, color: "var(--tx-3)" }}>
              <span>Eficiență: <strong style={{ color: "var(--tx-1)" }}>{c.rataRetentie.toFixed(1)}%</strong> din brut</span>
              <span>Lunar: <strong style={{ color: "var(--tx-1)" }}>~{fmt(c.totalTaxe / 12)} RON</strong> taxe/lună</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Explicații Tab ──────────────────────────────────────────────────── */}
      {tab === "explicatii" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {explanations.map((ex, i) => (
            <ExplanationCard key={i} title={ex.title} text={ex.text.replace("{an}", String(an))} />
          ))}

          <div className="card" style={{ padding: 20, borderLeft: "4px solid var(--red)", background: "rgba(235,87,87,0.04)" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <AlertTriangle size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--red)" }}>Atenție</div>
                <div style={{ fontSize: 13, color: "var(--tx-3)", lineHeight: 1.6 }}>
                  Acest ghid are rol informativ. Verifică întotdeauna pe <strong>ANAF.ro</strong> sau cu un contabil autorizat.
                  Legislatia se schimbă frecvent — aceste valori sunt calculate conform Codului Fiscal și Legii 296/2023.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Modal ─────────────────────────────────────────────────────── */}
      {showPrint && (
        <div className="modal-overlay" onClick={() => setShowPrint(false)}>
          <div style={{ width: "95vw", maxWidth: 840, maxHeight: "90vh", overflowY: "auto", borderRadius: "var(--r-lg)" }}>
            <div className="print-frame">
              <div className="print-declaratie">
                <h1>DECLARAȚIA UNICĂ — Anul {an}</h1>
                <p style={{ textAlign: "center", fontSize: 11, color: "#666", marginBottom: 20 }}>
                  {userName}{userCif ? ` — CIF/CNP: ${userCif}` : ""}{userAddress ? ` — ${userAddress}` : ""}
                </p>

                {/* Contributor info */}
                <div className="pd-section">
                  <div className="pd-section-title">Date identificare contribuabil</div>
                  <div className="pd-rubric">
                    <div className="pd-rubric-id">Nume</div>
                    <div className="pd-rubric-label">{userName || "—"}</div>
                    <div className="pd-rubric-value"></div>
                  </div>
                  <div className="pd-rubric">
                    <div className="pd-rubric-id">CIF/CNP</div>
                    <div className="pd-rubric-label">{userCif || "—"}</div>
                    <div className="pd-rubric-value"></div>
                  </div>
                </div>

                {/* Rubric sections */}
                {sections.map(section => {
                  const rows = rubrics.filter(r => r.section === section);
                  return (
                    <div key={section} className="pd-section">
                      <div className="pd-section-title">{section}</div>
                      {rows.map(r => (
                        <div key={r.id} className="pd-rubric">
                          <div className="pd-rubric-id">{r.id}</div>
                          <div className="pd-rubric-label">{r.label}</div>
                          <div className="pd-rubric-value">{r.value > 0 ? fmt(r.value) : "0,00"} RON</div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Total */}
                <div style={{ padding: "16px 12px", background: "#f5f5f5", border: "2px solid #333", borderRadius: 4, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>VENIT NET RĂMAS</div>
                  <div style={{ fontFamily: "'Ubuntu Mono', monospace", fontSize: 16, fontWeight: 700 }}>{fmt(c.netEfectiv)} RON</div>
                </div>

                <div style={{ marginTop: 32, paddingTop: 12, borderTop: "1px solid #ccc", fontSize: 9, color: "#999", textAlign: "center" }}>
                  Document informativ &middot; Generat la {new Date().toLocaleDateString("ro-RO")} &middot; Libero
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

function ExplanationCard({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "16px 24px", border: "none", background: "transparent",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: "pointer", color: "var(--tx-1)", textAlign: "left",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        <ChevronDown size={16} style={{ color: "var(--tx-3)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div style={{ padding: "0 24px 20px", borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.7 }}>{text}</p>
        </div>
      )}
    </div>
  );
}
