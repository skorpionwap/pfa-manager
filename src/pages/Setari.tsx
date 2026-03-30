import { useEffect, useState } from "react";
import { Check, User, Building2, CreditCard, Layers, Calculator, RotateCcw, Palette, Bot, Eye, EyeOff, FileText, Loader2, RefreshCw, ListPlus, Trash2, Plus } from "lucide-react";
import { getDb, setSetting, isTauri } from "@/lib/db";
import { analyzeLegislation, listGeminiModels, type LegislationAnalysis, type GeminiModelInfo } from "@/lib/gemini";
import { FISCAL, FISCAL_DEFAULTS } from "@/lib/fiscal";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/Toast";
import type { OperatingMode, PfaMode, ServiceCatalogItem } from "@/types";

const DATA_SECTIONS = [
  {
    title: "Date personale",
    icon: User,
    fields: [
      { key: "my_name",  label: "Nume complet",    placeholder: "Ion Popescu",      mono: false },
      { key: "my_cif",   label: "CNP / CIF",        placeholder: "1234567890123",    mono: true  },
      { key: "my_email", label: "Email",             placeholder: "ion@exemplu.ro",   mono: false },
      { key: "my_phone", label: "Telefon",           placeholder: "0722 000 000",     mono: false },
    ],
  },
  {
    title: "Date activitate",
    icon: Building2,
    fields: [
      { key: "my_address",     label: "Adresă",        placeholder: "Str. Exemplu nr. 1, Cluj-Napoca", mono: false },
      { key: "invoice_series", label: "Serie factură", placeholder: "FA",                              mono: true  },
    ],
  },
  {
    title: "Date bancare",
    icon: CreditCard,
    fields: [
      { key: "my_bank", label: "Bancă", placeholder: "BT / ING / Revolut",       mono: false },
      { key: "my_iban", label: "IBAN",  placeholder: "RO49AAAA1B31007593840000", mono: true  },
    ],
  },
] as const;

const MODES: { value: OperatingMode; label: string; desc: string }[] = [
  {
    value: "dda",
    label: "Drepturi de autor",
    desc: "Cesiune cod sursă, design, conținut. Cheltuieli forfetare 40%. Fără PFA.",
  },
  {
    value: "pfa",
    label: "PFA",
    desc: "Persoană Fizică Autorizată. Sistem real sau normă de venit. Factură fiscală.",
  },
];

const PFA_MODES: { value: PfaMode; label: string }[] = [
  { value: "real", label: "Sistem Real" },
  { value: "norma", label: "Normă de venit" },
];

export default function Setari() {
  const [values, setValues]       = useState<Record<string, string>>({});
  const [fiscalOverrides, setFiscalOverrides] = useState<Record<string, string>>({});
  const [mode, setMode]           = useState<OperatingMode>("dda");
  const [pfaMode, setPfaMode]     = useState<PfaMode>("real");
  const [saved, setSaved]         = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [showApiKey, setShowApiKey]     = useState(false);
  const [geminiModels, setGeminiModels] = useState<GeminiModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError]   = useState("");
  const [legisText, setLegisText]       = useState("");
  const [legisLoading, setLegisLoading] = useState(false);
  const [legisResult, setLegisResult]   = useState<LegislationAnalysis | null>(null);
const { theme, setTheme, themes } = useTheme();
  const { toast }                 = useToast();

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const db   = await getDb();
        const rows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
        const map: Record<string, string> = {};
        const fMap: Record<string, string> = {};
        rows.forEach(({ key, value }) => {
          if (key.startsWith("fiscal_")) fMap[key] = value;
          else map[key] = value;
        });
        setValues(map);
        setFiscalOverrides(fMap);
        setMode((map["operating_mode"] as OperatingMode) || "dda");
        setPfaMode((map["pfa_mode"] as PfaMode) || "real");
        if (map["gemini_api_key"]) {
          // fire-and-forget, don't block settings load
          setModelsLoading(true);
          listGeminiModels().then(list => {
            setGeminiModels(list);
          }).catch(() => {}).finally(() => setModelsLoading(false));
        }

      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    })();
  }, []);

  const set = (key: string, val: string) => {
    setValues(v => ({ ...v, [key]: val }));
    setDirty(true);
    setSaved(false);
  };

  const setFiscal = (key: string, val: string) => {
    setFiscalOverrides(v => ({ ...v, [key]: val }));
    setDirty(true);
    setSaved(false);
  };

  const resetFiscal = (key: string) => {
    setFiscalOverrides(v => {
      const next = { ...v };
      delete next[key];
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  const setModeVal = (m: OperatingMode) => {
    setMode(m);
    setDirty(true);
    setSaved(false);
  };

  const setPfaModeVal = (pm: PfaMode) => {
    setPfaMode(pm);
    setDirty(true);
    setSaved(false);
  };

  const fetchModels = async (apiKey?: string) => {
    const key = apiKey ?? values["gemini_api_key"];
    if (!key?.trim()) { setModelsError("Introdu mai întâi cheia API."); return; }
    setModelsLoading(true);
    setModelsError("");
    try {
      const list = await listGeminiModels();
      setGeminiModels(list);
      if (list.length && !values["gemini_model"]) {
        const flash = list.find(m => m.name.includes("flash")) ?? list[0];
        set("gemini_model", flash.name);
      }
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
    } finally {
      setModelsLoading(false);
    }
  };

  const handleAnalyzeLegis = async () => {
    if (!isTauri() || !legisText.trim()) return;
    setLegisLoading(true);
    setLegisResult(null);
    try {
      const result = await analyzeLegislation(legisText);
      setLegisResult(result);
    } catch (e) {
      alert(`Eroare AI: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLegisLoading(false);
    }
  };

  const save = async () => {
    try {
      for (const [key, value] of Object.entries(values)) {
        await setSetting(key, value);
      }
      await setSetting("operating_mode", mode);
      await setSetting("pfa_mode", pfaMode);

      // Salvează override-urile fiscale
      for (const [key, value] of Object.entries(fiscalOverrides)) {
        await setSetting(key, value);
      }
      // Șterge override-urile care au fost resetate (nu mai sunt în state)
      const db = await getDb();
      const existing = await db.select<{ key: string }[]>(
        "SELECT key FROM settings WHERE key LIKE 'fiscal_%'"
      );
      for (const { key } of existing) {
        if (!(key in fiscalOverrides)) {
          await db.execute("DELETE FROM settings WHERE key=?", [key]);
        }
      }

      setSaved(true);
      setDirty(false);
      toast("Setările au fost salvate");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert(`Eroare la salvarea setărilor:\n${err instanceof Error ? err.message : String(err)}`);
    }
  };


  return (
    <div style={{ padding: "36px 40px", maxWidth: 680 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="page-title">Setări</h1>
          <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 6 }}>
            Datele tale apar pe facturi și contracte
          </p>
        </div>
        <button className="btn btn-primary" onClick={save}
          disabled={!dirty} style={{ opacity: dirty ? 1 : 0.45, transition: "opacity 0.2s" }}>
          <Check size={13} strokeWidth={2.5} />
          {saved ? "Salvat!" : "Salvează"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Aspect (Teme) ── */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-1)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--ac-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Palette size={13} color="var(--ac)" />
            </div>
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 13, color: "var(--tx-1)" }}>
              Aspect
            </span>
          </div>
          <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {themes.map(t => {
              const active = theme.id === t.id;
              return (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  style={{
                    padding: 14, borderRadius: "var(--r-lg)", cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s", border: `1.5px solid ${active ? "var(--ac)" : "var(--border)"}`,
                    background: active ? "var(--ac-dim)" : "var(--bg-1)",
                  }}>
                  <div style={{
                    width: "100%", height: 40, borderRadius: "var(--r-md)", marginBottom: 10,
                    background: t.preview.bg, border: `1px solid ${t.preview.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 10px",
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.preview.ac }} />
                    <div style={{ width: 20, height: 4, borderRadius: 2, background: t.preview.text, opacity: 0.5 }} />
                    <div style={{ width: 14, height: 4, borderRadius: 2, background: t.preview.text, opacity: 0.25 }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--ac)" : "var(--tx-1)", marginBottom: 2 }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--tx-3)", lineHeight: 1.4 }}>{t.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Mod de operare ── */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-1)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--ac-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={13} color="var(--ac)" />
            </div>
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 13, color: "var(--tx-1)" }}>
              Mod de operare
            </span>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.6 }}>
              Modul ales influențează tipul documentelor, calculele fiscale și template-urile de contracte.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {MODES.map(({ value, label, desc }) => (
                <button key={value} onClick={() => setModeVal(value)}
                  style={{
                    textAlign: "left", padding: "14px 16px", borderRadius: "var(--r-lg)", cursor: "pointer",
                    transition: "all 0.15s",
                    background: mode === value ? "var(--ac-dim)" : "var(--bg-1)",
                    border: `1.5px solid ${mode === value ? "var(--ac)" : "var(--border)"}`,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: mode === value ? "var(--ac)" : "var(--tx-1)" }}>
                      {label}
                    </span>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: `2px solid ${mode === value ? "var(--ac)" : "var(--border-md)"}`,
                      background: mode === value ? "var(--ac)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {mode === value && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--tx-3)", lineHeight: 1.6 }}>{desc}</p>
                </button>
              ))}
            </div>

            {mode === "pfa" && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase" }}>Regim PFA</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {PFA_MODES.map(pm => (
                    <button key={pm.value} onClick={() => setPfaModeVal(pm.value)}
                      style={{
                        flex: 1, padding: "8px 12px", borderRadius: "var(--r-md)", cursor: "pointer", fontSize: 12, fontWeight: 500,
                        background: pfaMode === pm.value ? "var(--bg-3)" : "var(--bg-1)",
                        color: pfaMode === pm.value ? "var(--tx-1)" : "var(--tx-3)",
                        border: `1px solid ${pfaMode === pm.value ? "var(--border-md)" : "var(--border)"}`,
                      }}>
                      {pm.label}
                    </button>
                  ))}
                </div>
                {pfaMode === "norma" && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 6 }}>Valoare normă anuală (RON)</div>
                    <input className="field" type="number" 
                      value={values["pfa_norma_valoare"] ?? "0"} 
                      onChange={e => set("pfa_norma_valoare", e.target.value)} 
                      placeholder="Ex: 35000" style={{ maxWidth: 160 }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Parametri fiscali ── */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-1)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--ac-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calculator size={13} color="var(--ac)" />
            </div>
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 13, color: "var(--tx-1)" }}>
              Parametri fiscali
            </span>
          </div>

          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.6 }}>
              Suprascrie valorile default dacă ANAF modifică legislația. Lasă gol pentru a folosi valorile din aplicație.
            </p>

            {/* Salariu minim pe an */}
            <div>
              <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>
                Salariu minim brut (RON)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(Object.keys(FISCAL) as unknown as Array<keyof typeof FISCAL>).map(an => {
                  const key = `fiscal_SM_${an}`;
                  const defaultVal = FISCAL[an].SM;
                  const overridden = key in fiscalOverrides;
                  return (
                    <div key={an} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 4 }}>
                          Anul {an}
                          {!overridden && <span style={{ marginLeft: 6, opacity: 0.5 }}>default: {defaultVal}</span>}
                        </div>
                        <input className="field" type="number"
                          value={fiscalOverrides[key] ?? ""}
                          onChange={e => setFiscal(key, e.target.value)}
                          placeholder={String(defaultVal)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
                      </div>
                      {overridden && (
                        <button onClick={() => resetFiscal(key)} title="Resetează la default"
                          style={{ width: 30, height: 30, borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                          <RotateCcw size={12} color="var(--tx-3)" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cote fiscale */}
            <div>
              <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>
                Cote fiscale (%)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  { key: "fiscal_CASS", label: "CASS (Sănătate)", default: FISCAL_DEFAULTS.CASS },
                  { key: "fiscal_CAS", label: "CAS (Pensie)", default: FISCAL_DEFAULTS.CAS },
                  { key: "fiscal_IMPOZIT", label: "Impozit venit", default: FISCAL_DEFAULTS.IMPOZIT },
                  { key: "fiscal_FORFETAR", label: "Forfetar DDA", default: FISCAL_DEFAULTS.FORFETAR },
                ] as const).map(({ key, label, default: def }) => {
                  const overridden = key in fiscalOverrides;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 4 }}>
                          {label}
                          {!overridden && <span style={{ marginLeft: 6, opacity: 0.5 }}>{(def * 100).toFixed(0)}%</span>}
                        </div>
                        <div style={{ position: "relative" }}>
                          <input className="field" type="number" step="0.1" min="0" max="100"
                            value={fiscalOverrides[key] ?? ""}
                            onChange={e => setFiscal(key, e.target.value)}
                            placeholder={String(def * 100)} style={{ fontFamily: "var(--font-mono)", fontSize: 12, paddingRight: 28 }} />
                          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--tx-3)" }}>%</span>
                        </div>
                      </div>
                      {overridden && (
                        <button onClick={() => resetFiscal(key)} title="Resetează la default"
                          style={{ width: 30, height: 30, borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                          <RotateCcw size={12} color="var(--tx-3)" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Integrare AI ── */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-1)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--ac-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={13} color="var(--ac)" />
            </div>
            <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 13, color: "var(--tx-1)" }}>
              Integrare AI
            </span>
          </div>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.6 }}>
              Folosit pentru analiza contractelor primite de la clienți și identificarea clauzelor problematice.
              Obține o cheie gratuită de la{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--tx-2)" }}>aistudio.google.com</span>.
            </p>
            <div>
              <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                Gemini API Key
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  className="field"
                  type={showApiKey ? "text" : "password"}
                  value={values["gemini_api_key"] ?? ""}
                  onChange={e => set("gemini_api_key", e.target.value)}
                  placeholder="AIzaSy..."
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, paddingRight: 36 }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--tx-3)", display: "flex", padding: 4 }}
                  title={showApiKey ? "Ascunde" : "Arată"}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Model selector */}
            <div>
              <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                Model Gemini
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="field"
                  value={values["gemini_model"] ?? ""}
                  onChange={e => set("gemini_model", e.target.value)}
                  disabled={geminiModels.length === 0}
                  style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
                >
                  {geminiModels.length === 0 && (
                    <option value="">{modelsLoading ? "Se încarcă..." : "— apasă Refresh —"}</option>
                  )}
                  {geminiModels.map(m => (
                    <option key={m.name} value={m.name}>{m.display_name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => fetchModels()}
                  disabled={modelsLoading}
                  title="Reîncarcă lista de modele"
                  style={{ padding: "0 12px", flexShrink: 0 }}
                >
                  {modelsLoading
                    ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                    : <RefreshCw size={13} />}
                </button>
              </div>
              {modelsError && (
                <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{modelsError}</div>
              )}
              {geminiModels.length > 0 && !modelsLoading && (
                <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>
                  {geminiModels.length} modele disponibile
                </div>
              )}
            </div>

            {/* Monitor legislație */}
            <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <FileText size={13} color="var(--tx-3)" />
                <span style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Monitor legislație
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.6, marginBottom: 10 }}>
                Lipește textul unui OUG sau al unei legi fiscale — AI extrage modificările relevante pentru PFA/DDA.
              </p>
              <textarea className="field" rows={4} value={legisText} onChange={e => setLegisText(e.target.value)}
                placeholder="Lipește textul actului normativ aici..." style={{ resize: "vertical", fontSize: 12 }} />
              <button className="btn btn-ghost" onClick={handleAnalyzeLegis}
                disabled={legisLoading || !legisText.trim()}
                style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                {legisLoading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={13} />}
                {legisLoading ? "Se analizează..." : "Analizează cu AI"}
              </button>

              {legisResult && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--tx-1)", marginBottom: 4 }}>{legisResult.titlu}</div>
                    <div style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.6 }}>{legisResult.rezumat}</div>
                  </div>
                  {legisResult.modificari.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--tx-3)" }}>Nicio modificare relevantă pentru PFA/DDA identificată.</p>
                  ) : (
                    legisResult.modificari.map((m, i) => (
                      <div key={i} style={{ padding: "10px 14px", background: "var(--ac-dim)", borderRadius: "var(--r-md)", border: "1px solid var(--ac)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>{m.camp}</div>
                          <div style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.5 }}>{m.explicatie}</div>
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--ac)", flexShrink: 0 }}>
                          {m.camp.startsWith("SM") ? `${m.valoare_noua.toLocaleString("ro-RO")} RON` : `${(m.valoare_noua * 100).toFixed(0)}%`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Data sections ── */}
        {DATA_SECTIONS.map(({ title, icon: Icon, fields }) => (
          <div key={title} className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-1)" }}>
              <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--ac-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={13} color="var(--ac)" />
              </div>
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 13, color: "var(--tx-1)" }}>
                {title}
              </span>
            </div>
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {fields.map(({ key, label, placeholder, mono }) => (
                <div key={key} style={{ gridColumn: key === "my_address" ? "span 2" : "span 1" }}>
                  <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                    {label}
                  </div>
                  <input className="field" value={values[key] ?? ""} onChange={e => set(key, e.target.value)}
                    placeholder={placeholder}
                    style={mono ? { fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.02em" } : {}} />
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
