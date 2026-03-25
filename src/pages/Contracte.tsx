import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { Plus, X, Check, Trash2, FileSignature, Bold, Italic,
  Underline as UnderlineIcon, Strikethrough, List, ListOrdered, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Quote, Code, Palette,
  Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { getDb, getSetting, isTauri } from "@/lib/db";
import { pickAndAnalyzeContract, ContractAnalysis, ContractRisk } from "@/lib/gemini";
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
});

// ── Toolbar ───────────────────────────────────────────────────────────────────
const FONTS = [
  { value: "",                              label: "Implicit" },
  { value: "Palatino Linotype, Palatino, serif", label: "Palatino" },
  { value: "Georgia, serif",                label: "Georgia" },
  { value: "Times New Roman, serif",        label: "Times New Roman" },
  { value: "Arial, sans-serif",             label: "Arial" },
  { value: "Helvetica, sans-serif",         label: "Helvetica" },
  { value: "Courier New, monospace",        label: "Courier New" },
];

const TEXT_COLORS = [
  { value: "#000000", label: "Negru" },
  { value: "#374151", label: "Gri închis" },
  { value: "#6b7280", label: "Gri" },
  { value: "#dc2626", label: "Roșu" },
  { value: "#2563eb", label: "Albastru" },
  { value: "#16a34a", label: "Verde" },
  { value: "#d97706", label: "Portocaliu" },
  { value: "#7c3aed", label: "Violet" },
];

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showColors, setShowColors] = useState(false);
  const savedSelection = useRef<{ from: number; to: number } | null>(null);
  if (!editor) return null;
  const btn = (active: boolean, onClick: () => void, label: React.ReactNode, title?: string) => (
    <button type="button" className={active ? "is-active" : ""} onClick={onClick} title={title}>{label}</button>
  );
  const currentColor = editor.getAttributes("textStyle").color as string | undefined;
  return (
    <div className="tiptap-toolbar">
      {/* Font family */}
      <select
        className="tiptap-font-select"
        title="Font"
        value={editor.getAttributes("textStyle").fontFamily ?? ""}
        onMouseDown={() => {
          const { from, to } = editor.state.selection;
          savedSelection.current = { from, to };
        }}
        onChange={e => {
          const v = e.target.value;
          if (savedSelection.current) {
            editor.commands.setTextSelection(savedSelection.current);
          }
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
          savedSelection.current = null;
        }}
      >
        {FONTS.map(f => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value || "inherit" }}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="sep" />
      {/* Formatting */}
      {btn(editor.isActive("bold"),        () => editor.chain().focus().toggleBold().run(),        <Bold size={12} />, "Bold (Ctrl+B)")}
      {btn(editor.isActive("italic"),      () => editor.chain().focus().toggleItalic().run(),      <Italic size={12} />, "Italic (Ctrl+I)")}
      {btn(editor.isActive("underline"),   () => editor.chain().focus().toggleUnderline().run(),   <UnderlineIcon size={12} />, "Underline (Ctrl+U)")}
      {btn(editor.isActive("strike"),      () => editor.chain().focus().toggleStrike().run(),      <Strikethrough size={12} />, "Tăiat")}
      <div className="sep" />
      {/* Headings */}
      {btn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "H1")}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2")}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "H3")}
      <div className="sep" />
      {/* Alignment */}
      {btn(editor.isActive({ textAlign: "left" }),    () => editor.chain().focus().setTextAlign("left").run(),    <AlignLeft size={12} />, "Aliniere stânga")}
      {btn(editor.isActive({ textAlign: "center" }),  () => editor.chain().focus().setTextAlign("center").run(),  <AlignCenter size={12} />, "Centrat")}
      {btn(editor.isActive({ textAlign: "right" }),   () => editor.chain().focus().setTextAlign("right").run(),   <AlignRight size={12} />, "Aliniere dreapta")}
      {btn(editor.isActive({ textAlign: "justify" }), () => editor.chain().focus().setTextAlign("justify").run(), <AlignJustify size={12} />, "Justified")}
      <div className="sep" />
      {/* Lists */}
      {btn(editor.isActive("bulletList"),  () => editor.chain().focus().toggleBulletList().run(),  <List size={12} />, "Listă puncte")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={12} />, "Listă numerotată")}
      <div className="sep" />
      {/* Block types */}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), <Quote size={12} />, "Citat")}
      {btn(editor.isActive("code"),       () => editor.chain().focus().toggleCode().run(),       <Code size={12} />, "Cod inline")}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), <Minus size={12} />, "Separator")}
      <div className="sep" />
      {/* Color picker */}
      <div style={{ position: "relative" }}>
        <button type="button" title="Culoare text" onClick={() => setShowColors(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Palette size={12} />
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2,
            background: currentColor ?? "var(--tx-1)", border: "1px solid var(--border)" }} />
        </button>
        {showColors && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
            background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
            padding: 8, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, width: 120 }}>
            {TEXT_COLORS.map(c => (
              <button key={c.value} type="button" title={c.label}
                onClick={() => { editor.chain().focus().setColor(c.value).run(); setShowColors(false); }}
                style={{ width: 20, height: 20, borderRadius: 4, background: c.value,
                  border: currentColor === c.value ? "2px solid var(--ac)" : "1px solid var(--border)",
                  cursor: "pointer", padding: 0 }} />
            ))}
            <button type="button" title="Culoare implicită"
              onClick={() => { editor.chain().focus().unsetColor().run(); setShowColors(false); }}
              style={{ width: 20, height: 20, borderRadius: 4, background: "var(--bg-base)",
                border: "1px solid var(--border)", cursor: "pointer", fontSize: 10, color: "var(--tx-3)" }}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    editorProps: { attributes: { spellcheck: "false" } },
  });

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

  const openNew = () => {
    setEditing(null);
    const f = empty();
    f.type = mode === "dda" ? "cesiune" : "prestari";
    const opts = defaultTemplateOptions(f.type);
    setForm(f);
    setTemplateOpts(opts);
    editor?.commands.setContent("");
    setShowForm(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({ client_id: c.client_id, type: c.type, number: c.number, date: c.date,
              description: c.description, amount: c.amount, status: c.status, notes: c.notes });
    setTemplateOpts(defaultTemplateOptions(c.type));
    editor?.commands.setContent(c.description || "");
    setShowForm(true);
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
    editor?.commands.setContent(html);
  };

  const save = async () => {
    if (!form.date) { toast("Data contractului este obligatorie", "error"); return; }
    const description = editor?.getHTML() ?? form.description;
    const isEmpty = !description || description === "<p></p>" || description.trim() === "";
    if (!editing && isEmpty) { toast("Conținutul contractului nu poate fi gol", "error"); return; }
    const db = await getDb();
    if (editing) {
      await db.execute(
        "UPDATE contracts SET client_id=?,type=?,number=?,date=?,description=?,amount=?,status=?,notes=? WHERE id=?",
        [form.client_id, form.type, form.number, form.date, description, form.amount, form.status, form.notes, editing.id]
      );
    } else {
      await db.execute(
        "INSERT INTO contracts(client_id,type,number,date,description,amount,status,notes) VALUES(?,?,?,?,?,?,?,?)",
        [form.client_id, form.type, form.number, form.date, description, form.amount, form.status, form.notes]
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
    editor?.commands.setContent("");
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
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} onClick={() => openEdit(c)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn btn-danger-ghost" style={{ padding: "5px 8px" }} onClick={() => remove(c.id)}>
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
          <div className="modal" style={{ width: "min(1100px, 96vw)", height: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

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
                {/* Type toggle */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-1)" }}>
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

                {/* Template options */}
                <TemplateOptionsPanel opts={templateOpts} onChange={setTemplateOpts} type={form.type} />

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

              {/* RIGHT COLUMN - Editor sidebar */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-0)", minWidth: 0 }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <Label style={{ marginBottom: 0 }}>Text contract</Label>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={() => applyTemplate(form.type, form.client_id, form, templateOpts)}>
                    Regenerează
                  </button>
                </div>
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div className="tiptap-wrap" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <Toolbar editor={editor} />
                    <EditorContent editor={editor} style={{ flex: 1 }} />
                  </div>
                </div>
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
  opts, onChange, type,
}: {
  opts: TemplateOptions;
  onChange: (o: TemplateOptions) => void;
  type: ContractType;
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
      {/* Section label + total warning */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={f11}>Configurare template</span>
        {total !== 100 && (
          <span style={{ fontSize: 11, color: "#dc2626", fontFamily: "var(--font-mono)" }}>
            ⚠ Tranșe: {total}% / 100%
          </span>
        )}
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
