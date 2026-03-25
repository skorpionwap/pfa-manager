import { useEffect, useState } from "react";
import { Plus, X, Check, Trash2, FileSignature,
  Sparkles, Loader2, AlertTriangle, RefreshCw,
  Eye, Printer, Upload, FileText } from "lucide-react";
import LexicalEditor from "@/components/LexicalEditor";
import { getDb, getSetting, isTauri } from "@/lib/db";
import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { pickAndAnalyzeContract, analyzeClientContract, ContractAnalysis, ContractRisk } from "@/lib/gemini";
import { useToast } from "@/components/Toast";
import type { Client, Contract, OperatingMode } from "@/types";
import { TEMPLATE_HTML, substituteVars, generateTranseTable } from "@/lib/templates";

type ContractType = Contract["type"];
type ContractStatus = Contract["status"];

const TYPE_LABELS: Record<ContractType, string> = {
  cesiune: "Cesiune drepturi autor",
  cesiune_abonament: "Cesiune + Abonament",
  prestari: "Prestări servicii",
};
const TYPE_BADGE: Record<ContractType, string> = {
  cesiune: "badge badge-blue",
  cesiune_abonament: "badge badge-purple",
  prestari: "badge badge-amber",
};
const STATUS_BADGE: Record<ContractStatus, string> = {
  activ: "badge badge-green",
  expirat: "badge badge-muted",
  reziliat: "badge badge-red",
  pending: "badge badge-amber",
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  activ: "activ",
  expirat: "expirat",
  reziliat: "reziliat",
  pending: "spre aprobare",
};

const RISK_STYLE: Record<ContractRisk["nivel"], { border: string; label: string }> = {
  ridicat: { border: "#ef4444", label: "badge badge-red" },
  mediu:   { border: "#f59e0b", label: "badge badge-amber" },
  scăzut:  { border: "#22c55e", label: "badge badge-green" },
};

// ── Template options ──────────────────────────────────────────────────────────
interface TransaConfig { label: string; procent: number; }
interface TemplateOptions {
  transe: TransaConfig[];
  termen_plata: number;          // zile termen plată
  preaviz: number;               // zile preaviz reziliere
  exclusivitate: "exclusiv" | "neexclusiv";
  valoare_abonament: string;     // cesiune_abonament
  luna_start_abonament: string;  // cesiune_abonament
}

function defaultTemplateOptions(type: ContractType): TemplateOptions {
  const base: TemplateOptions = {
    transe: [
      { label: "La semnarea contractului", procent: 50 },
      { label: "La recepția finală (Proces-Verbal)", procent: 50 },
    ],
    termen_plata: 5,
    preaviz: 30,
    exclusivitate: "neexclusiv",
    valoare_abonament: "",
    luna_start_abonament: "luna a 3-a de la livrarea finală",
  };
  if (type === "cesiune") return { ...base, preaviz: 15 };
  if (type === "prestari") return {
    ...base,
    transe: [
      { label: "Avans la semnare", procent: 30 },
      { label: "La predarea livrabilelor finale", procent: 70 },
    ],
    termen_plata: 15,
    preaviz: 15,
  };
  return base; // cesiune_abonament
}

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Omit<Contract, "id" | "created_at" | "client_name"> => ({
  client_id: null, type: "cesiune", number: "", date: today(),
  description: "", amount: 0, status: "activ", notes: "",
  source: "mine", file_path: "",
});

// ── Main component ────────────────────────────────────────────────────────────
export default function Contracte() {
  const { toast } = useToast();
  const [contracts, setContracts]   = useState<Contract[]>([]);
  const [clients, setClients]       = useState<Client[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Contract | null>(null);
  const [form, setForm]             = useState(empty());
  const [mode, setMode]             = useState<OperatingMode>("dda");
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ContractAnalysis | null>(null);
  const [templateOpts, setTemplateOpts] = useState<TemplateOptions>(() => defaultTemplateOptions("cesiune"));
  const [editorContent, setEditorContent] = useState("");
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  const load = async () => {
    const db = await getDb();
    const rows = await db.select<(Contract & { client_name: string })[]>(`
      SELECT c.*, cl.name as client_name
      FROM contracts c LEFT JOIN clients cl ON cl.id = c.client_id
      ORDER BY c.created_at DESC
    `);
    setContracts(rows);
    setClients(await db.select<Client[]>("SELECT * FROM clients ORDER BY name ASC"));
    
    // Get mode to set default template
    const m = (await getSetting("operating_mode")) as OperatingMode || "dda";
    setMode(m);
  };

  useEffect(() => { load(); }, []);

  const loadVars = async (
    _type: ContractType,
    clientId: number | null,
    formData: typeof form,
    opts: TemplateOptions,
  ) => {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
    const s: Record<string, string> = {};
    rows.forEach(r => (s[r.key] = r.value));

    const client = clients.find(c => c.id === clientId);
    const clientDetails = [
      client?.cif ? `CIF ${client.cif}` : "",
      client?.address ? `cu sediul în ${client.address}` : "",
    ].filter(Boolean).join(", ");

    const vars: Record<string, string> = {
      AUTOR_NUME:       s.my_name    || "Numele Dvs.",
      AUTOR_CNP:        s.my_cif     || "CNP/CIF",
      AUTOR_ADRESA:     s.my_address || "Adresa Dvs.",
      AUTOR_EMAIL:      s.my_email   || "email@exemplu.ro",
      AUTOR_IBAN:       s.my_iban    || "RO................",
      AUTOR_BANCA:      s.my_bank    || "Banca...",

      CESIONAR_NUME:    client?.name || "Beneficiar",
      CESIONAR_DETALII: clientDetails || "cu datele de identificare...",

      CONTRACT_NR:      formData.number || "—",
      DATA:             formData.date,
      VALOARE:          formData.amount > 0
                          ? formData.amount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })
                          : "—",

      TRANSE_TABLE:     generateTranseTable(formData.amount, opts.transe),
      TERMEN_PLATA:     String(opts.termen_plata),
      PREAVIZ:          String(opts.preaviz),
      EXCLUSIVITATE:    opts.exclusivitate,

      RESPONSABIL_TAXE: mode === "dda"
        ? "Cesionarul va reține și vira la bugetul de stat impozitul pe venit de 10%, în numele Cedentului"
        : "Prestatorul este responsabil cu declararea și plata impozitului pe venit și a contribuțiilor sociale",
    };

    // Abonament — only substituted if provided; otherwise stay as visible {{PLACEHOLDER}}
    if (opts.valoare_abonament)    vars.VALOARE_ABONAMENT    = opts.valoare_abonament;
    if (opts.luna_start_abonament) vars.LUNA_START_ABONAMENT = opts.luna_start_abonament;

    return vars;
  };

  const openNew = async () => {
    setEditing(null);
    const f = empty();
    f.type = mode === "dda" ? "cesiune" : "prestari";
    const opts = defaultTemplateOptions(f.type);
    setForm(f);
    setTemplateOpts(opts);
    // Auto-load template so the editor isn't blank on open
    const vars = await loadVars(f.type, f.client_id, f, opts);
    const html = substituteVars(TEMPLATE_HTML[f.type] ?? "", vars);
    setEditorContent(html);
    setShowForm(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({ client_id: c.client_id, type: c.type, number: c.number, date: c.date,
              description: c.description, amount: c.amount, status: c.status, notes: c.notes,
              source: c.source ?? "mine", file_path: c.file_path ?? "" });
    setTemplateOpts(defaultTemplateOptions(c.type));
    setEditorContent(c.description || "");
    setShowForm(true);
  };

  const pickClientFile = async () => {
    if (!isTauri()) { toast("Disponibil doar în aplicația desktop", "error"); return; }
    const selected = await openFilePicker({
      title: "Selectează documentul contractului",
      filters: [{ name: "Documente", extensions: ["pdf", "doc", "docx"] }],
      multiple: false,
    });
    if (!selected || typeof selected !== "string") return;

    setForm(f => ({ ...f, file_path: selected }));

    // Auto-extract with Gemini (silently skips if no API key)
    setAnalyzeLoading(true);
    try {
      const analysis = await analyzeClientContract(selected);

      // Try to match client from extracted parties
      const nameHint = analysis.parti.beneficiar || analysis.parti.prestator;
      const matchedClient = nameHint
        ? clients.find(c =>
            c.name.toLowerCase().includes(nameHint.toLowerCase()) ||
            nameHint.toLowerCase().includes(c.name.toLowerCase()))
        : undefined;

      setForm(f => ({
        ...f,
        file_path: selected,
        number:    analysis.numar  || f.number,
        date:      analysis.data   || f.date,
        amount:    analysis.valoare > 0 ? analysis.valoare : f.amount,
        client_id: matchedClient?.id ?? f.client_id,
        notes:     analysis.riscuri.length > 0
          ? `⚠ ${analysis.riscuri.length} clauze atenționare detectate de Gemini.${f.notes ? " " + f.notes : ""}`
          : f.notes,
      }));

      if (analysis.riscuri.length > 0) {
        setAnalysisResult(analysis);  // deschide modalul de riscuri existent
      } else {
        toast("Date extrase automat de Gemini ✓", "success");
      }
    } catch {
      toast("Fișier selectat. Adaugă cheia Gemini în Setări pentru extracție automată.", "info");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const printContract = (html: string, number: string) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Contract ${number || ""}</title>
<style>
  body { font-family: 'Palatino Linotype', Palatino, Georgia, serif; font-size: 11pt; line-height: 1.7; margin: 2.5cm; color: #111; }
  h1 { font-size: 14pt; text-align: center; margin-bottom: 0.5em; }
  h2 { font-size: 12pt; margin-top: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 11pt; margin-top: 1em; }
  p { margin: 0 0 0.8em; }
  ul, ol { margin: 0 0 0.8em; padding-left: 1.5em; }
  li { margin-bottom: 0.3em; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  td, th { border: 1px solid #555; padding: 6px 10px; font-size: 10pt; }
  th { background: #eee; font-weight: bold; }
  @media print { @page { margin: 1.5cm; } body { margin: 0; } }
</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const applyTemplate = async (
    type: ContractType,
    clientId: number | null,
    formData: typeof form,
    opts: TemplateOptions,
  ) => {
    const vars = await loadVars(type, clientId, formData, opts);
    const html = substituteVars(TEMPLATE_HTML[type] ?? "", vars);
    setForm(f => ({ ...f, type }));
    setEditorContent(html);
  };

  const save = async () => {
    if (!form.date) { toast("Data contractului este obligatorie", "error"); return; }
    const description = editorContent || form.description;
    const isEmpty = !description || description === "<p></p>" || description.trim() === "";
    if (!editing && isEmpty) { toast("Conținutul contractului nu poate fi gol", "error"); return; }
    const db = await getDb();
    const src = form.source ?? "mine";
    const fp  = form.file_path ?? "";
    if (editing) {
      await db.execute(
        "UPDATE contracts SET client_id=?,type=?,number=?,date=?,description=?,amount=?,status=?,notes=?,source=?,file_path=? WHERE id=?",
        [form.client_id, form.type, form.number, form.date, description, form.amount, form.status, form.notes, src, fp, editing.id]
      );
    } else {
      await db.execute(
        "INSERT INTO contracts(client_id,type,number,date,description,amount,status,notes,source,file_path) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [form.client_id, form.type, form.number, form.date, description, form.amount, form.status, form.notes, src, fp]
      );
    }
    setShowForm(false);
    load();
    toast(editing ? "Contract actualizat" : "Contract adăugat", "success");
  };

  const remove = async (id: number) => {
    if (!confirm("Ștergi contractul?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM contracts WHERE id=?", [id]);
    load();
    toast("Contract șters", "info");
  };

  const handleAnalyzePDF = async () => {
    if (!isTauri()) { toast("Disponibil doar în aplicația desktop", "error"); return; }
    setAnalyzeLoading(true);
    try {
      const result = await pickAndAnalyzeContract();
      if (result) setAnalysisResult(result.analysis);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare la analiza AI", "error");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const importAnalysis = (analysis: ContractAnalysis) => {
    const matchedClient = clients.find(c =>
      c.name.toLowerCase().includes(analysis.parti.beneficiar.toLowerCase()) ||
      analysis.parti.beneficiar.toLowerCase().includes(c.name.toLowerCase())
    );
    const f = empty();
    f.type    = mode === "pfa" ? "prestari" : (analysis.tip === "cesiune" ? "cesiune" : "cesiune_abonament");
    f.number  = analysis.numar || "";
    f.date    = analysis.data  || today();
    f.amount  = analysis.valoare || 0;
    f.status  = "pending";
    f.client_id = matchedClient?.id ?? null;
    f.notes   = !matchedClient && analysis.parti.beneficiar
      ? `Client identificat în contract: ${analysis.parti.beneficiar}`
      : "";
    setForm(f);
    setEditing(null);
    setAnalysisResult(null);
    setEditorContent("");
    setShowForm(true);
  };

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Contracte</h1>
          <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 5 }}>
            Mod curent: <strong style={{ color: "var(--tx-1)" }}>{mode === "dda" ? "Drepturi de autor" : "PFA"}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleAnalyzePDF} disabled={analyzeLoading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {analyzeLoading
              ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              : <Sparkles size={14} />}
            {analyzeLoading ? "Se analizează..." : "Analizează PDF client"}
          </button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={14} strokeWidth={2.5} /> Contract nou</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nr. / Dată</th><th>Client</th><th>Tip</th>
              <th style={{ textAlign: "right" }}>Valoare</th><th>Status</th><th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "60px 0", color: "var(--tx-4)" }}>
                <FileSignature size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                Niciun contract înregistrat
              </td></tr>
            ) : contracts.map(c => (
              <tr key={c.id}>
                <td>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tx-1)", fontWeight: 500 }}>{c.number || `#${c.id}`}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--tx-3)", fontFamily: "var(--font-mono)" }}>{c.date}</span>
                </td>
                <td style={{ color: "var(--tx-1)" }}>{c.client_name || <span style={{ color: "var(--tx-4)" }}>—</span>}</td>
                <td><span className={TYPE_BADGE[c.type]}>{TYPE_LABELS[c.type]}</span></td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--tx-1)" }}>
                  {c.amount > 0 ? `${c.amount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON` : "—"}
                </td>
                <td><span className={STATUS_BADGE[c.status]}>{STATUS_LABELS[c.status]}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} title="Vizualizează" onClick={() => setViewContract(c)}>
                      <Eye size={12} />
                    </button>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} title="Editează" onClick={() => openEdit(c)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn btn-danger-ghost" style={{ padding: "5px 8px" }} title="Șterge" onClick={() => remove(c.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── AI Analysis modal ────────────────────────────────────────────────── */}
      {analysisResult && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAnalysisResult(null)}>
          <div className="modal" style={{ width: "min(700px, 96vw)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={15} color="var(--ac)" />
                <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>
                  Analiză contract AI
                </h3>
                {analysisResult.riscuri.filter(r => r.nivel === "ridicat").length > 0 && (
                  <span className="badge badge-red" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={10} />
                    {analysisResult.riscuri.filter(r => r.nivel === "ridicat").length} riscuri ridicate
                  </span>
                )}
              </div>
              <button onClick={() => setAnalysisResult(null)} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 6, color: "var(--tx-3)", display: "flex", cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Extracted fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Tip contract", value: analysisResult.tip === "cesiune" ? "Cesiune drepturi autor" : analysisResult.tip === "prestari" ? "Prestări servicii" : "Altul" },
                  { label: "Beneficiar (client)", value: analysisResult.parti.beneficiar || "—" },
                  { label: "Nr. contract",  value: analysisResult.numar  || "—" },
                  { label: "Dată",          value: analysisResult.data   || "—" },
                  { label: "Valoare",       value: analysisResult.valoare > 0 ? `${analysisResult.valoare.toLocaleString("ro-RO")} RON` : "—" },
                  { label: "Prestator identificat", value: analysisResult.parti.prestator || "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--bg-1)", borderRadius: "var(--r-md)", padding: "10px 14px", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 10, color: "var(--tx-3)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, color: "var(--tx-1)", fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Rezumat */}
              <div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Rezumat</div>
                <p style={{ fontSize: 13, color: "var(--tx-2)", lineHeight: 1.7, background: "var(--bg-1)", padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                  {analysisResult.rezumat}
                </p>
              </div>

              {/* Riscuri */}
              {analysisResult.riscuri.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Clauze de atenționat ({analysisResult.riscuri.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {analysisResult.riscuri.map((r, i) => (
                      <div key={i} style={{ borderLeft: `3px solid ${RISK_STYLE[r.nivel]?.border ?? "#888"}`, background: "var(--bg-1)", borderRadius: "0 var(--r-md) var(--r-md) 0", padding: "10px 14px", border: "1px solid var(--border)", borderLeftWidth: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span className={RISK_STYLE[r.nivel]?.label ?? "badge badge-muted"}>{r.nivel}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}>{r.clauza}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.6, margin: 0 }}>{r.detaliu}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.riscuri.length === 0 && (
                <div style={{ textAlign: "center", padding: "16px 0", color: "var(--tx-3)", fontSize: 13 }}>
                  <Check size={20} style={{ margin: "0 auto 8px", display: "block", color: "#22c55e" }} />
                  Nicio clauză problematică identificată
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "var(--tx-4)" }}>Analiză generată de Gemini AI · Verifică întotdeauna cu un jurist</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setAnalysisResult(null)}>Anulează</button>
                <button className="btn btn-primary" onClick={() => importAnalysis(analysisResult)}>
                  <Check size={13} strokeWidth={2.5} />
                  Creează contract (spre aprobare)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Contract form modal ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: "min(1400px, 98vw)", height: "95vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* Modal header */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>
                {editing ? "Editează contract" : "Contract nou"}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 6, color: "var(--tx-3)", display: "flex", cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>

            {/* Body - two columns */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

              {/* LEFT COLUMN */}
              <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "auto" }}>
                {/* Source toggle */}
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-1)" }}>
                  <Label style={{ marginBottom: 6 }}>Origine contract</Label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["mine", "client"] as const).map(s => (
                      <button key={s} type="button"
                        onClick={() => setForm(f => ({ ...f, source: s }))}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.12s",
                          background: (form.source ?? "mine") === s ? "var(--ac)" : "var(--bg-2)",
                          color: (form.source ?? "mine") === s ? "#fff" : "var(--tx-2)",
                          border: `1px solid ${(form.source ?? "mine") === s ? "var(--ac)" : "var(--border)"}` }}>
                        {s === "mine" ? "Creat de mine" : "Primit de la client"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type toggle — only for own contracts */}
                {(form.source ?? "mine") === "mine" && (
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-1)" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(Object.entries(TYPE_LABELS) as [ContractType, string][])
                      .filter(([t]) => mode === "dda" ? t !== "prestari" : t === "prestari")
                      .map(([t, l]) => (
                      <button key={t} type="button"
                        onClick={() => {
                          const newOpts = defaultTemplateOptions(t);
                          setTemplateOpts(newOpts);
                          applyTemplate(t, form.client_id, form, newOpts);
                        }}
                        style={{ flex: 1, padding: "7px 12px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.12s",
                          background: form.type === t ? "var(--ac)" : "var(--bg-2)",
                          color: form.type === t ? "#fff" : "var(--tx-2)",
                          border: `1px solid ${form.type === t ? "var(--ac)" : "var(--border)"}` }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {/* Fields */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <Label>Client</Label>
                      <select className="field" value={form.client_id ?? ""} onChange={e => setForm(f => ({ ...f, client_id: Number(e.target.value) || null }))}>
                        <option value="">Fără client</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <Label>Nr. contract</Label>
                        <input className="field" style={{ fontFamily: "var(--font-mono)" }} value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="C-2026-001" />
                      </div>
                      <div>
                        <Label>Dată</Label>
                        <input className="field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <Label>Valoare (RON)</Label>
                        <input className="field" type="number" style={{ fontFamily: "var(--font-mono)" }} value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="0" min={0} step={0.01} />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <select className="field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
                          <option value="activ">Activ</option>
                          <option value="pending">Spre aprobare</option>
                          <option value="expirat">Expirat</option>
                          <option value="reziliat">Reziliat</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Template options — only for own contracts */}
                {(form.source ?? "mine") === "mine" && (
                  <TemplateOptionsPanel
                    opts={templateOpts}
                    onChange={setTemplateOpts}
                    type={form.type}
                    onRegenerate={() => applyTemplate(form.type, form.client_id, form, templateOpts)}
                  />
                )}

                {/* File attachment — only for client contracts */}
                {(form.source ?? "mine") === "client" && (
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                    <Label>Document primit</Label>
                    {analyzeLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "var(--bg-1)", borderRadius: "var(--r-md)", border: "1px solid var(--border)", color: "var(--tx-3)", fontSize: 12 }}>
                        <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "var(--ac)" }} />
                        Gemini extrage datele...
                      </div>
                    ) : form.file_path ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--bg-1)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                        <FileText size={14} color="var(--ac)" />
                        <span style={{ flex: 1, fontSize: 12, color: "var(--tx-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(form.file_path || "").split(/[\\/]/).pop() || form.file_path}
                        </span>
                        <button type="button" onClick={pickClientFile}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tx-3)", display: "flex", padding: 2, fontSize: 10 }} title="Schimbă fișierul">
                          <Upload size={11} />
                        </button>
                        <button type="button" onClick={() => setForm(f => ({ ...f, file_path: "" }))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tx-4)", display: "flex", padding: 2 }}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-ghost" onClick={pickClientFile}
                        style={{ width: "100%", justifyContent: "center", padding: "14px", gap: 8, border: "1px dashed var(--border)" }}>
                        <Upload size={14} />
                        Selectează fișier · Gemini extrage automat datele
                      </button>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div style={{ padding: "16px 20px", flexShrink: 0 }}>
                  <Label>Note interne</Label>
                  <textarea className="field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Note vizibile doar pentru tine..." style={{ resize: "none" }} />
                </div>

                {/* Footer */}
                <div style={{ padding: "14px 20px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0, marginTop: "auto" }}>
                  <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Anulează</button>
                  <button className="btn btn-primary" onClick={save}>
                    <Check size={13} strokeWidth={2.5} />
                    {editing ? "Salvează" : "Înregistrează"}
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN - Editor */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-0)", minWidth: 0 }}>
                {(form.source ?? "mine") === "mine" && (
                  <div style={{ padding: "8px 16px 4px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Conținut contract
                    </span>
                  </div>
                )}
                {(form.source ?? "mine") === "client" && (
                  <div style={{ padding: "8px 16px 4px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Notițe / adnotări (opțional)
                    </span>
                  </div>
                )}
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <LexicalEditor
                    value={editorContent}
                    onChange={setEditorContent}
                    placeholder={(form.source ?? "mine") === "client" ? "Adaugă notițe despre acest contract..." : "Text contract..."}
                    className="lexical-editor-wrap"
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── View contract modal ───────────────────────────────────────────────── */}
      {viewContract && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewContract(null)}>
          <div className="modal" style={{ width: "min(860px, 96vw)", height: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "16px 24px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14, color: "var(--tx-1)" }}>
                  {viewContract.number || `Contract #${viewContract.id}`}
                </span>
                <span style={{ marginLeft: 12, fontSize: 11, color: "var(--tx-3)" }}>{viewContract.date}</span>
                {viewContract.client_name && (
                  <span style={{ marginLeft: 12, fontSize: 11, color: "var(--tx-3)" }}>· {viewContract.client_name}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Print button — only if there's HTML content */}
                {viewContract.description && (
                  <button className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                    onClick={() => printContract(viewContract.description, viewContract.number)}>
                    <Printer size={13} /> Printează
                  </button>
                )}
                {/* Open file button — only for client contracts with a file */}
                {viewContract.file_path && isTauri() && (
                  <button className="btn btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                    onClick={() => openPath(viewContract.file_path!).catch(() => toast("Nu s-a putut deschide fișierul", "error"))}>
                    <FileText size={13} /> Deschide fișier
                  </button>
                )}
                <button onClick={() => setViewContract(null)} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 6, color: "var(--tx-3)", display: "flex", cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Meta strip */}
            <div style={{ padding: "10px 24px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, flexShrink: 0, background: "var(--bg-1)" }}>
              <span className={TYPE_BADGE[viewContract.type]} style={{ fontSize: 11 }}>{TYPE_LABELS[viewContract.type]}</span>
              <span className={STATUS_BADGE[viewContract.status]} style={{ fontSize: 11 }}>{STATUS_LABELS[viewContract.status]}</span>
              {viewContract.amount > 0 && (
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--tx-2)" }}>
                  {viewContract.amount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                </span>
              )}
              {viewContract.source === "client" && (
                <span style={{ fontSize: 11, color: "var(--tx-3)", background: "var(--bg-2)", padding: "2px 8px", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                  Primit de la client
                </span>
              )}
              {viewContract.file_path && (
                <span style={{ fontSize: 11, color: "var(--tx-3)", display: "flex", alignItems: "center", gap: 4 }}>
                  <FileText size={11} />
                  {(viewContract.file_path).split(/[\\/]/).pop()}
                </span>
              )}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto", padding: "28px 40px" }}>
              {viewContract.description ? (
                <div
                  className="contract-view-content"
                  dangerouslySetInnerHTML={{ __html: viewContract.description }}
                  style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.7 }}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "60px 0", color: "var(--tx-4)" }}>
                  <FileText size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                  {viewContract.source === "client"
                    ? "Nicio adnotare. Folosiți butonul «Deschide fișier» pentru a vedea documentul original."
                    : "Contract fără conținut text salvat."}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "var(--tx-4)" }}>
                Înregistrat: {viewContract.created_at?.slice(0, 10) || "—"}
                {viewContract.notes && <> · <em>{viewContract.notes}</em></>}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => { setViewContract(null); openEdit(viewContract); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editează
                </button>
                <button className="btn btn-ghost" onClick={() => setViewContract(null)}>Închide</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Options Panel ────────────────────────────────────────────────────
function TemplateOptionsPanel({
  opts, onChange, type, onRegenerate,
}: {
  opts: TemplateOptions;
  onChange: (o: TemplateOptions) => void;
  type: ContractType;
  onRegenerate: () => void;
}) {
  const total = opts.transe.reduce((s, t) => s + t.procent, 0);

  const updateTransa = (i: number, field: keyof TransaConfig, raw: string) => {
    const transe = opts.transe.map((t, idx) =>
      idx === i ? { ...t, [field]: field === "procent" ? Math.max(0, Number(raw)) : raw } : t,
    );
    onChange({ ...opts, transe });
  };

  const addTransa = () => {
    if (opts.transe.length >= 4) return;
    onChange({ ...opts, transe: [...opts.transe, { label: "Altă condiție de plată", procent: 0 }] });
  };

  const removeTransa = (i: number) => {
    if (opts.transe.length <= 1) return;
    onChange({ ...opts, transe: opts.transe.filter((_, idx) => idx !== i) });
  };

  const f11: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--tx-3)", marginBottom: 5 };
  const numInput: React.CSSProperties = { width: 52, fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 7px", textAlign: "center" };

  return (
    <div style={{ padding: "12px 24px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-0)", flexShrink: 0 }}>
      {/* Section label + total warning + regenerate button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={f11}>Configurare template</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {total !== 100 && (
            <span style={{ fontSize: 11, color: "#dc2626", fontFamily: "var(--font-mono)" }}>
              ⚠ Tranșe: {total}%
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "4px 10px" }}
            onClick={onRegenerate}
            title="Regenerează textul contractului cu setările actuale"
          >
            <RefreshCw size={11} />
            Regenerează
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Tranches column */}
        <div style={{ flex: "1 1 300px", minWidth: 260 }}>
          <div style={f11}>Tranșe de plată</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {opts.transe.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <input
                  className="field"
                  value={t.label}
                  onChange={e => updateTransa(i, "label", e.target.value)}
                  placeholder="Condiție de plată"
                  style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
                />
                <input
                  className="field"
                  type="number"
                  value={t.procent}
                  onChange={e => updateTransa(i, "procent", e.target.value)}
                  min={0} max={100}
                  style={numInput}
                />
                <span style={{ fontSize: 11, color: "var(--tx-3)" }}>%</span>
                {opts.transe.length > 1 && (
                  <button type="button" onClick={() => removeTransa(i)}
                    style={{ padding: 3, background: "none", border: "none", cursor: "pointer", color: "var(--tx-4)", display: "flex" }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {opts.transe.length < 4 && (
            <button type="button" onClick={addTransa} className="btn btn-ghost"
              style={{ marginTop: 6, fontSize: 11, padding: "3px 9px", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={10} /> Adaugă tranșă
            </button>
          )}
        </div>

        {/* Terms + exclusivity column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div>
              <div style={f11}>Termen plată</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input className="field" type="number" value={opts.termen_plata} min={1}
                  onChange={e => onChange({ ...opts, termen_plata: Math.max(1, Number(e.target.value)) })}
                  style={numInput} />
                <span style={{ fontSize: 11, color: "var(--tx-3)" }}>zile</span>
              </div>
            </div>
            <div>
              <div style={f11}>Preaviz reziliere</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input className="field" type="number" value={opts.preaviz} min={1}
                  onChange={e => onChange({ ...opts, preaviz: Math.max(1, Number(e.target.value)) })}
                  style={numInput} />
                <span style={{ fontSize: 11, color: "var(--tx-3)" }}>zile</span>
              </div>
            </div>
          </div>

          <div>
            <div style={f11}>Tip cesiune</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["neexclusiv", "exclusiv"] as const).map(v => (
                <button key={v} type="button" onClick={() => onChange({ ...opts, exclusivitate: v })}
                  style={{ padding: "3px 10px", fontSize: 11, fontWeight: 500, borderRadius: "var(--r-md)", cursor: "pointer",
                    background: opts.exclusivitate === v ? "var(--ac)" : "var(--bg-2)",
                    color: opts.exclusivitate === v ? "#fff" : "var(--tx-2)",
                    border: `1px solid ${opts.exclusivitate === v ? "var(--ac)" : "var(--border)"}` }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Abonament fields — only for cesiune_abonament */}
        {type === "cesiune_abonament" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={f11}>Abonament (RON/lună)</div>
              <input className="field" type="number" value={opts.valoare_abonament} min={0}
                onChange={e => onChange({ ...opts, valoare_abonament: e.target.value })}
                placeholder="ex: 400"
                style={{ width: 100, fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 8px" }} />
            </div>
            <div>
              <div style={f11}>Pornind din</div>
              <input className="field" value={opts.luna_start_abonament}
                onChange={e => onChange({ ...opts, luna_start_abonament: e.target.value })}
                placeholder="luna a 3-a de la livrare"
                style={{ minWidth: 200, fontSize: 12, padding: "4px 8px" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6, ...style }}>
      {children}
    </div>
  );
}
