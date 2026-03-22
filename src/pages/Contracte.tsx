import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Plus, X, Check, Trash2, FileSignature, Bold, Italic,
  Underline as UnderlineIcon, List, ListOrdered, Minus } from "lucide-react";
import { getDb, getSetting } from "@/lib/db";
import { useToast } from "@/components/Toast";
import type { Client, Contract, OperatingMode } from "@/types";
import { TEMPLATE_HTML, substituteVars } from "@/lib/templates";

type ContractType = Contract["type"];
type ContractStatus = Contract["status"];

const TYPE_LABELS: Record<ContractType, string> = {
  cesiune: "Cesiune drepturi autor",
  prestari: "Prestări servicii",
};
const STATUS_BADGE: Record<ContractStatus, string> = {
  activ: "badge badge-green",
  expirat: "badge badge-muted",
  reziliat: "badge badge-red",
};

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Omit<Contract, "id" | "created_at" | "client_name"> => ({
  client_id: null, type: "cesiune", number: "", date: today(),
  description: "", amount: 0, status: "activ", notes: "",
});

// ── Toolbar ───────────────────────────────────────────────────────────────────
function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const btn = (active: boolean, onClick: () => void, label: React.ReactNode, title?: string) => (
    <button type="button" className={active ? "is-active" : ""} onClick={onClick} title={title}>{label}</button>
  );
  return (
    <div className="tiptap-toolbar">
      {btn(editor.isActive("bold"),      () => editor.chain().focus().toggleBold().run(),      <Bold size={12} />, "Bold (Ctrl+B)")}
      {btn(editor.isActive("italic"),    () => editor.chain().focus().toggleItalic().run(),    <Italic size={12} />, "Italic (Ctrl+I)")}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={12} />, "Underline (Ctrl+U)")}
      <div className="sep" />
      {btn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "H1")}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "H2")}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "H3")}
      <div className="sep" />
      {btn(editor.isActive("bulletList"),  () => editor.chain().focus().toggleBulletList().run(),  <List size={12} />, "Bullet list")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={12} />, "Numbered list")}
      <div className="sep" />
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), <Minus size={12} />, "Separator")}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Contracte() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Contract | null>(null);
  const [form, setForm]           = useState(empty());
  const [mode, setMode]           = useState<OperatingMode>("dda");

  const editor = useEditor({
    extensions: [StarterKit, Underline],
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

  const loadVars = async (type: ContractType, clientId: number | null, formData: typeof form) => {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
    const s: Record<string, string> = {};
    rows.forEach(r => (s[r.key] = r.value));
    
    const client = clients.find(c => c.id === clientId);
    const clientDetails = [
      client?.cif ? `CIF ${client.cif}` : "",
      client?.address ? `cu sediul în ${client.address}` : "",
    ].filter(Boolean).join(", ");

    return {
      AUTOR_NUME:    s.my_name    || "Numele Dvs.",
      AUTOR_CNP:     s.my_cif     || "CNP/CIF",
      AUTOR_ADRESA:  s.my_address || "Adresa Dvs.",
      AUTOR_EMAIL:   s.my_email   || "email@exemplu.ro",
      AUTOR_IBAN:    s.my_iban    || "RO................",
      AUTOR_BANCA:   s.my_bank    || "Banca...",
      
      CESIONAR_NUME: client?.name || "Beneficiar",
      CESIONAR_DETALII: clientDetails || "cu datele de identificare...",
      
      CONTRACT_NR:   formData.number || "—",
      DATA:          formData.date,
      VALOARE:       formData.amount > 0 ? formData.amount.toLocaleString("ro-RO") : "—",
      DESCRIERE_SCURTA: formData.description ? "Conform specificațiilor" : "Software personalizat",
      
      RESPONSABIL_TAXE: mode === "dda" ? "Cesionarului (reținere la sursă) / Cedentului (declarație proprie)" : "Prestatorului (PFA)",
    };
  };

  const openNew = () => {
    setEditing(null);
    const f = empty();
    // Set default type based on mode
    f.type = mode === "dda" ? "cesiune" : "prestari";
    setForm(f);
    editor?.commands.setContent("");
    setShowForm(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({ client_id: c.client_id, type: c.type, number: c.number, date: c.date,
              description: c.description, amount: c.amount, status: c.status, notes: c.notes });
    editor?.commands.setContent(c.description || "");
    setShowForm(true);
  };

  const applyTemplate = async (type: ContractType, clientId: number | null, formData: typeof form) => {
    const vars = await loadVars(type, clientId, formData);
    const html = substituteVars(TEMPLATE_HTML[type], vars);
    setForm(f => ({ ...f, type }));
    editor?.commands.setContent(html);
  };

  const save = async () => {
    const db = await getDb();
    const description = editor?.getHTML() ?? form.description;
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
        <button className="btn btn-primary" onClick={openNew}><Plus size={14} strokeWidth={2.5} /> Contract nou</button>
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
                <td><span className={c.type === "cesiune" ? "badge badge-blue" : "badge badge-amber"}>{TYPE_LABELS[c.type]}</span></td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--tx-1)" }}>
                  {c.amount > 0 ? `${c.amount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON` : "—"}
                </td>
                <td><span className={STATUS_BADGE[c.status]}>{c.status}</span></td>
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

      {/* ── Contract form modal ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: "min(860px, 96vw)", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* Modal header */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>
                {editing ? "Editează contract" : "Contract nou"}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 6, color: "var(--tx-3)", display: "flex", cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              {/* Metadata bar */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--bg-1)" }}>
                {/* Type toggle */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {(Object.entries(TYPE_LABELS) as [ContractType, string][]).map(([t, l]) => (
                    <button key={t} type="button"
                      onClick={() => applyTemplate(t, form.client_id, form)}
                      style={{ flex: 1, padding: "7px 12px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.12s",
                        background: form.type === t ? "var(--ac)" : "var(--bg-2)",
                        color: form.type === t ? "#fff" : "var(--tx-2)",
                        border: `1px solid ${form.type === t ? "var(--ac)" : "var(--border)"}` }}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Fields grid */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <Label>Client</Label>
                    <select className="field" value={form.client_id ?? ""} onChange={e => setForm(f => ({ ...f, client_id: Number(e.target.value) || null }))}>
                      <option value="">Fără client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Nr. contract</Label>
                    <input className="field" style={{ fontFamily: "var(--font-mono)" }} value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="C-2026-001" />
                  </div>
                  <div>
                    <Label>Dată</Label>
                    <input className="field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Valoare (RON)</Label>
                    <input className="field" type="number" style={{ fontFamily: "var(--font-mono)" }} value={form.amount || ""} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="0" min={0} step={0.01} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select className="field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))}>
                      <option value="activ">Activ</option>
                      <option value="expirat">Expirat</option>
                      <option value="reziliat">Reziliat</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Rich text editor */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 24px 0" }}>
                <div style={{ paddingTop: 14, paddingBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <Label style={{ marginBottom: 0 }}>Text contract</Label>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={() => applyTemplate(form.type, form.client_id, form)}>
                    Reîncarcă template
                  </button>
                </div>
                <div className="tiptap-wrap" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", marginBottom: 12 }}>
                  <Toolbar editor={editor} />
                  <EditorContent editor={editor} style={{ flex: 1, overflow: "hidden" }} />
                </div>
              </div>

              {/* Notes */}
              <div style={{ padding: "0 24px 16px", flexShrink: 0 }}>
                <Label>Note interne</Label>
                <textarea className="field" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Note vizibile doar pentru tine..." style={{ resize: "none" }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Anulează</button>
              <button className="btn btn-primary" onClick={save}>
                <Check size={13} strokeWidth={2.5} />
                {editing ? "Salvează" : "Înregistrează contract"}
              </button>
            </div>
          </div>
        </div>
      )}
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
