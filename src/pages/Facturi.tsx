import { useEffect, useState, useRef } from "react";
import { Plus, X, Check, Trash2, ChevronDown, FileText, Printer, Eye } from "lucide-react";
import { getDb, peekInvoiceNumber, bumpInvoiceCounter } from "@/lib/db";
import { useToast } from "@/components/Toast";
import type { Client, Invoice, InvoiceItem, OperatingMode } from "@/types";

type Status = Invoice["status"];

const STATUS_LABELS: Record<Status, string> = {
  draft: "Ciornă", sent: "Trimisă", paid: "Încasată", overdue: "Restantă",
};
const STATUS_BADGE: Record<Status, string> = {
  draft: "badge badge-muted", sent: "badge badge-blue",
  paid: "badge badge-green", overdue: "badge badge-red",
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};
const emptyItem = (): InvoiceItem => ({ description: "", quantity: 1, unit_price: 0, total: 0 });

// ── Settings type ─────────────────────────────────────────────────────────────
interface MySettings {
  my_name: string;
  my_cif: string;
  my_address: string;
  my_email: string;
  my_phone: string;
  my_bank: string;
  my_iban: string;
  invoice_series: string;
}

export default function Facturi() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<MySettings>({
    my_name: "", my_cif: "", my_address: "", my_email: "", my_phone: "",
    my_bank: "", my_iban: "", invoice_series: "FA",
  });
  const [operatingMode, setOperatingMode] = useState<OperatingMode>("dda");
  const [showPrint, setShowPrint] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]); // Added for contract linking

  // Form state
  const [clientId, setClientId] = useState<number | "">("");
  const [contractId, setContractId] = useState<number | "">(""); // NEW
  const [category, setCategory] = useState(""); // NEW
  const [isSigned, setIsSigned] = useState(false); // NEW
  const [date, setDate]         = useState(today());
  const [dueDate, setDueDate]   = useState(addDays(today(), 30));
  const [items, setItems]       = useState<InvoiceItem[]>([emptyItem()]);
  const [notes, setNotes]       = useState("");
  const [status, setStatus]     = useState<Status>("draft");

  const printRef = useRef<HTMLDivElement>(null);

  // Trigger print only after print-frame is in the DOM
  useEffect(() => {
    if (!showPrint) return;
    window.print();
    setShowPrint(false);
  }, [showPrint]);

  const load = async () => {
    const db = await getDb();
    const rows = await db.select<(Invoice & { client_name: string; client_cif: string; client_address: string; client_email: string })[]>(`
      SELECT i.*, c.name as client_name, c.cif as client_cif, c.address as client_address, c.email as client_email
      FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
      ORDER BY i.created_at DESC
    `);
    setInvoices(rows.map(r => ({ ...r, items: JSON.parse(r.items as unknown as string || "[]"), is_signed: !!r.is_signed })));
    setClients(await db.select<Client[]>("SELECT * FROM clients ORDER BY name ASC"));
    setContracts(await db.select<any[]>("SELECT * FROM contracts ORDER BY date DESC")); // Load contracts

    // Load settings — single query instead of N+1
    const settingRows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
    const sm: Record<string, string> = {};
    settingRows.forEach(r => (sm[r.key] = r.value));
    setSettings({
      my_name: sm.my_name ?? "", my_cif: sm.my_cif ?? "", my_address: sm.my_address ?? "",
      my_email: sm.my_email ?? "", my_phone: sm.my_phone ?? "",
      my_bank: sm.my_bank ?? "", my_iban: sm.my_iban ?? "",
      invoice_series: sm.invoice_series ?? "FA",
    });
    setOperatingMode((sm.operating_mode as OperatingMode) || "dda");
  };

  useEffect(() => { load(); }, []);

  const openNew = async () => {
    setEditing(null);
    setClientId(""); setContractId(""); setCategory(operatingMode === "dda" ? "Tranșă DDA" : ""); setIsSigned(false);
    setDate(today()); setDueDate(addDays(today(), 30));
    setItems([emptyItem()]); setNotes(""); setStatus("draft");
    setShowForm(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setClientId(inv.client_id); setContractId(inv.contract_id || ""); setCategory(inv.category || ""); setIsSigned(!!inv.is_signed);
    setDate(inv.date); setDueDate(inv.due_date);
    setItems(inv.items.length ? inv.items : [emptyItem()]); setNotes(inv.notes); setStatus(inv.status);
    setShowForm(true);
  };

  const updateItem = (i: number, field: keyof InvoiceItem, val: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      next[i].total = next[i].quantity * next[i].unit_price;
      return next;
    });
  };

  const total = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  const save = async () => {
    if (!clientId) return;
    const db = await getDb();
    if (editing) {
      await db.execute(
        "UPDATE invoices SET client_id=?,contract_id=?,date=?,due_date=?,items=?,total=?,status=?,notes=?,category=?,is_signed=? WHERE id=?",
        [clientId, contractId || null, date, dueDate, JSON.stringify(items), total, status, notes, category, isSigned ? 1 : 0, editing.id]
      );
    } else {
      // Peek number first — only bump counter after INSERT succeeds
      const number = await peekInvoiceNumber();
      await db.execute(
        "INSERT INTO invoices(number,client_id,contract_id,date,due_date,items,total,status,notes,category,is_signed) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [number, clientId, contractId || null, date, dueDate, JSON.stringify(items), total, status, notes, category, isSigned ? 1 : 0]
      );
      await bumpInvoiceCounter();
    }
    setShowForm(false);
    load();
    const modeName = operatingMode === "dda" ? "Venitul" : "Factura";
    toast(editing ? `${modeName} actualizat` : `${modeName} emis`, "success");
  };

  const remove = async (id: number) => {
    if (!confirm("Ștergi factura?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM invoices WHERE id=?", [id]);
    load();
    toast("Factura ștearsă", "info");
  };

  const changeStatus = async (id: number, s: Status) => {
    const db = await getDb();
    await db.execute("UPDATE invoices SET status=? WHERE id=?", [s, id]);
    load();
    toast(`Status actualizat: ${STATUS_LABELS[s]}`, "info");
  };

  const handlePrint = () => setShowPrint(true);

  const getClient = (inv: Invoice) => clients.find(c => c.id === inv.client_id);

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">{operatingMode === "dda" ? "Venituri & Recepții" : "Facturi"}</h1>
          <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 5 }}>
            {invoices.length} {operatingMode === "dda" ? "înregistrări" : "documente emise"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={14} strokeWidth={2.5} /> {operatingMode === "dda" ? "Venit / PVR Nou" : "Factură nouă"}
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{operatingMode === "dda" ? "Document / PVR" : "Număr"}</th>
              <th>Client</th>
              {operatingMode === "dda" && <th>Contract / Categorie</th>}
              <th>Dată</th>
              {operatingMode === "pfa" && <th>Scadență</th>}
              <th style={{ textAlign: "right" }}>Total</th>
              <th>Status</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={operatingMode === "dda" ? 8 : 7} style={{ textAlign: "center", padding: "60px 0", color: "var(--tx-4)" }}>
                <FileText size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                Niciun {operatingMode === "dda" ? "venit înregistrat" : "document emis"} încă
              </td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id}>
                <td>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tx-1)", fontWeight: 500 }}>{inv.number}</span>
                    {inv.is_signed && <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 600 }}>✓ Semnat PVR</span>}
                  </div>
                </td>
                <td style={{ color: "var(--tx-1)" }}>{getClient(inv)?.name || "—"}</td>
                {operatingMode === "dda" && (
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--tx-2)" }}>{contracts.find(c => c.id === inv.contract_id)?.number || "Fără contract"}</span>
                      {inv.category && <span className="badge badge-muted" style={{ fontSize: 10, alignSelf: "flex-start" }}>{inv.category}</span>}
                    </div>
                  </td>
                )}
                <td style={{ color: "var(--tx-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{inv.date}</td>
                {operatingMode === "pfa" && (
                  <td style={{ color: inv.status === "overdue" ? "var(--red)" : "var(--tx-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{inv.due_date}</td>
                )}
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}>
                  {inv.total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                </td>
                <td>
                  <StatusDropdown value={inv.status} onChange={s => changeStatus(inv.id, s)} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} onClick={() => setPreviewInvoice(inv)} title="Preview tipizat">
                      <Eye size={12} />
                    </button>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} onClick={() => openEdit(inv)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn btn-danger-ghost" style={{ padding: "5px 8px" }} onClick={() => remove(inv.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Invoice Form Modal ──────────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 580, maxWidth: "95vw" }}>
            {/* Modal header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>
                  {editing ? `Editează ${editing.number}` : "Factură nouă"}
                </h3>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 6, color: "var(--tx-3)", display: "flex", cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, maxHeight: "70vh", overflowY: "auto" }}>
              {/* Client + Contract */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <FieldLabel>Client *</FieldLabel>
                  <select className="field" value={clientId} onChange={e => setClientId(Number(e.target.value) || "")}>
                    <option value="">Selectează client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Contract (Opțional)</FieldLabel>
                  <select className="field" value={contractId} onChange={e => setContractId(Number(e.target.value) || "")}>
                    <option value="">Selectează contract...</option>
                    {contracts.filter(c => !clientId || c.client_id === clientId).map(c => (
                      <option key={c.id} value={c.id}>{c.number} - {c.description.slice(0, 30)}...</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates + Category + Status */}
              <div style={{ display: "grid", gridTemplateColumns: operatingMode === "dda" ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <FieldLabel>{operatingMode === "dda" ? "Data PVR" : "Dată emitere"}</FieldLabel>
                  <input className="field" type="date" value={date} onChange={e => { setDate(e.target.value); setDueDate(addDays(e.target.value, 30)); }} />
                </div>
                {operatingMode === "pfa" && (
                  <div>
                    <FieldLabel>Scadență</FieldLabel>
                    <input className="field" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                )}
                {operatingMode === "dda" && (
                  <div>
                    <FieldLabel>Categorie</FieldLabel>
                    <select className="field" value={category} onChange={e => setCategory(e.target.value)}>
                      <option value="Tranșă DDA">Tranșă DDA</option>
                      <option value="Abonament DDA">Abonament DDA</option>
                      <option value="Servicii punctuale">Servicii punctuale</option>
                      <option value="Altele">Altele</option>
                    </select>
                  </div>
                )}
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <select className="field" value={status} onChange={e => setStatus(e.target.value as Status)}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {operatingMode === "dda" && (
                  <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--tx-2)" }}>
                      <input type="checkbox" checked={isSigned} onChange={e => setIsSigned(e.target.checked)} />
                      Semnat PVR
                    </label>
                  </div>
                )}
              </div>

              {/* Line items */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <FieldLabel style={{ marginBottom: 0 }}>Linii factură</FieldLabel>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setItems(p => [...p, emptyItem()])}>
                    <Plus size={12} /> Adaugă linie
                  </button>
                </div>

                <div className="card" style={{ overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--tx-3)", fontWeight: 500 }}>Descriere</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--tx-3)", fontWeight: 500, width: 60 }}>Cant.</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--tx-3)", fontWeight: 500, width: 100 }}>Preț/u.</th>
                        <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--tx-3)", fontWeight: 500, width: 100 }}>Total</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                          <td style={{ padding: "6px 8px" }}>
                            <input className="field" style={{ border: "none", background: "transparent", padding: "4px 6px" }}
                              value={item.description} placeholder="Descriere serviciu..."
                              onChange={e => updateItem(i, "description", e.target.value)} />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input className="field" type="number" style={{ border: "none", background: "transparent", padding: "4px 6px", textAlign: "right", fontFamily: "var(--font-mono)", width: 50 }}
                              value={item.quantity} min={1}
                              onChange={e => updateItem(i, "quantity", Number(e.target.value))} />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input className="field" type="number" style={{ border: "none", background: "transparent", padding: "4px 6px", textAlign: "right", fontFamily: "var(--font-mono)", width: 90 }}
                              value={item.unit_price} min={0} step={0.01}
                              onChange={e => updateItem(i, "unit_price", Number(e.target.value))} />
                          </td>
                          <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--tx-1)" }}>
                            {(item.quantity * item.unit_price).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "6px 4px" }}>
                            {items.length > 1 && (
                              <button onClick={() => setItems(p => p.filter((_, j) => j !== i))}
                                style={{ background: "none", border: "none", color: "var(--tx-4)", cursor: "pointer", padding: 2 }}>
                                <X size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "1px solid var(--border-md)", background: "var(--bg-1)" }}>
                        <td colSpan={3} style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "var(--tx-3)", fontWeight: 500 }}>TOTAL</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--tx-1)" }}>
                          {total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <FieldLabel>{operatingMode === "dda" ? "Descriere livrabile / Note" : "Note / Mențiuni"}</FieldLabel>
                <textarea className="field" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder={operatingMode === "dda" ? "ex: Predare cod sursă conform milestone 2..." : "ex: Cesiune drepturi patrimoniale de autor cod sursă..."}
                  style={{ resize: "vertical", minHeight: 56 }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Anulează</button>
              <button className="btn btn-primary" onClick={save} disabled={!clientId}>
                <Check size={13} strokeWidth={2.5} />
                {editing ? "Salvează" : (operatingMode === "dda" ? "Înregistrează venit" : "Emite factură")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Tipizat Preview ──────────────────────────────────────────────── */}
      {previewInvoice && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPreviewInvoice(null)}>
          <div className="modal" style={{ width: "min(860px, 96vw)", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>
                Preview: {previewInvoice.number}
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <Printer size={13} strokeWidth={2.5} /> {operatingMode === "dda" ? "Printează PVR" : "Printează"}
                </button>
                <button onClick={() => setPreviewInvoice(null)} style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 6, color: "var(--tx-3)", display: "flex", cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Tipizat content */}
            <div ref={printRef} className="print-frame" style={{ flex: 1, overflow: "auto", background: "#e8e8e8", padding: 24 }}>
              {operatingMode === "dda" ? (
                <PVRTipizat invoice={previewInvoice} client={getClient(previewInvoice)} settings={settings} contract={contracts.find(c => c.id === previewInvoice.contract_id)} />
              ) : (
                <InvoiceTipizat invoice={previewInvoice} client={getClient(previewInvoice)} settings={settings} operatingMode={operatingMode} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6, ...style }}>
      {children}
    </div>
  );
}

function StatusDropdown({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} className={STATUS_BADGE[value]}
        style={{ cursor: "pointer", border: "none", display: "flex", alignItems: "center", gap: 4 }}>
        {STATUS_LABELS[value]} <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
          background: "var(--bg-2)", border: "1px solid var(--border-md)",
          borderRadius: "var(--r-md)", overflow: "hidden", minWidth: 120,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
            <button key={s} onClick={() => { onChange(s); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: s === value ? "var(--bg-3)" : "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--tx-2)" }}>
              <span className={STATUS_BADGE[s]}>{STATUS_LABELS[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Invoice Tipizat (print-ready) ─────────────────────────────────────────────
function InvoiceTipizat({ invoice, client, settings, operatingMode }: {
  invoice: Invoice; client?: Client; settings: MySettings; operatingMode: OperatingMode;
}) {
  const total = invoice.items.reduce((s, it) => s + it.total, 0);
  const isDDA = operatingMode === "dda";

  const modeLabel = isDDA ? "Drepturi de Autor" : "Persoană Fizică Autorizată (PFA)";
  const tvaArticle = isDDA
    ? "art. 292 alin. (1) lit. f) din Codul Fiscal — venituri din drepturi de autor"
    : "art. 310 alin. (1) din Codul Fiscal — regim special de scutire pentru PFA";
  const fiscalNote = isDDA
    ? "Venituri din drepturi de autor. Impozitul pe venit (10%) și contribuțiile sociale se calculează prin deducerea forfetară de 40% din venitul brut, conform art. 68 din Codul Fiscal."
    : "Venituri din activități independente (PFA). Impozitul pe venit (10%) se aplică la venitul net realizat, conform art. 61 din Codul Fiscal.";

  return (
    <div className="tipizat" style={{
      background: "#fff", padding: "60px", color: "#000",
      minHeight: "1000px", display: "flex", flexDirection: "column",
      boxShadow: "0 0 40px rgba(0,0,0,0.1)", borderRadius: "2px"
    }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "60px" }}>
        <div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
            FACTURĂ
          </h1>
          <div style={{ fontSize: "14px", color: "#666", fontWeight: "500" }}>
            SERIA <span style={{ color: "#000" }}>{settings.invoice_series || "FA"}</span> &nbsp;·&nbsp;
            NR. <span style={{ color: "#000" }}>{invoice.number.split("-").pop()}</span>
          </div>
          <div style={{
            display: "inline-block", marginTop: "10px", padding: "4px 12px",
            background: "#f5f5f5", borderRadius: "4px", fontSize: "11px",
            fontWeight: "700", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            {modeLabel}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px" }}>DATA EMITERII</div>
          <div style={{ fontSize: "16px", fontFamily: "var(--font-mono)" }}>{invoice.date}</div>
          <div style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>SCADENTĂ LA: {invoice.due_date}</div>
        </div>
      </div>

      {/* ── Parties ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", marginBottom: "60px" }}>
        {/* Supplier */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: "800", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
            Furnizor
          </div>
          <div style={{ fontSize: "18px", fontWeight: "800", marginBottom: "12px" }}>{settings.my_name}</div>
          <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#333" }}>
            <div style={{ marginBottom: "4px" }}><strong>CIF/CNP:</strong> {settings.my_cif}</div>
            <div style={{ marginBottom: "4px" }}>{settings.my_address}</div>
            {settings.my_email && <div style={{ marginBottom: "4px" }}>{settings.my_email}</div>}
            {settings.my_phone && <div style={{ marginBottom: "12px", color: "#666" }}>{settings.my_phone}</div>}
            <div style={{ padding: "12px", background: "#f9f9f9", borderRadius: "4px", border: "1px solid #eee" }}>
              <div style={{ fontSize: "11px", color: "#777", marginBottom: "4px", fontWeight: "700" }}>CONT BANCAR</div>
              <div style={{ fontWeight: "700", fontFamily: "var(--font-mono)", fontSize: "13px" }}>{settings.my_iban}</div>
              <div style={{ fontSize: "12px" }}>{settings.my_bank}</div>
            </div>
          </div>
        </div>

        {/* Client */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: "800", color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
            Beneficiar
          </div>
          <div style={{ fontSize: "18px", fontWeight: "800", marginBottom: "12px" }}>{client?.name}</div>
          <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#333" }}>
            <div style={{ marginBottom: "4px" }}><strong>CIF/CUI:</strong> {client?.cif || "—"}</div>
            <div style={{ marginBottom: "4px" }}>{client?.address || "—"}</div>
            <div>{client?.email}</div>
            {client?.phone && <div style={{ color: "#666" }}>{client.phone}</div>}
          </div>
        </div>
      </div>

      {/* ── Items Table ── */}
      <div style={{ flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#000", color: "#fff" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Descriere servicii / livrabile</th>
              <th style={{ textAlign: "center", padding: "12px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", width: "60px" }}>U.M.</th>
              <th style={{ textAlign: "center", padding: "12px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", width: "60px" }}>Cant.</th>
              <th style={{ textAlign: "right", padding: "12px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", width: "120px" }}>Preț Unitar</th>
              <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", width: "120px" }}>Valoare (RON)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500" }}>{item.description}</td>
                <td style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: "#666" }}>buc.</td>
                <td style={{ padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "500" }}>{item.quantity}</td>
                <td style={{ padding: "16px", textAlign: "right", fontSize: "14px", fontFamily: "var(--font-mono)" }}>{item.unit_price.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: "16px", textAlign: "right", fontSize: "15px", fontWeight: "700", fontFamily: "var(--font-mono)" }}>{item.total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totals ── */}
      <div style={{ marginTop: "40px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "40px" }}>
          <div style={{ width: "300px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "2px solid #000" }}>
              <span style={{ fontWeight: "800", fontSize: "16px" }}>TOTAL DE PLATĂ</span>
              <span style={{ fontWeight: "900", fontSize: "20px" }}>{total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON</span>
            </div>
            <div style={{ fontSize: "11px", textAlign: "right", color: "#666", marginTop: "4px" }}>
              Cota TVA: Scutit conform Codului Fiscal
            </div>
          </div>
        </div>

        {/* ── Legal mentions ── */}
        <div style={{ padding: "24px", background: "#fcfcfc", border: "1px solid #eee", borderRadius: "4px" }}>
          <div style={{ fontSize: "11px", fontWeight: "800", color: "#999", textTransform: "uppercase", marginBottom: "12px" }}>Mențiuni legale și Informații plată</div>

          {invoice.notes && (
            <div style={{ marginBottom: "12px", padding: "12px", background: "#fff", border: "1px solid #eee", borderRadius: "4px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#555", marginBottom: "4px" }}>NOTĂ</div>
              <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#333" }}>{invoice.notes}</div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
            <div style={{ fontSize: "12px", lineHeight: "1.7", color: "#444" }}>
              <div style={{ fontWeight: "700", marginBottom: "6px", color: "#333" }}>Regim fiscal</div>
              <div style={{ marginBottom: "6px" }}>{fiscalNote}</div>
              <div style={{ marginBottom: "6px" }}>Scutit de TVA conform {tvaArticle}.</div>
              <div>Factura circulă fără semnătură și ștampilă conform Legii 227/2015 privind Codul Fiscal.</div>
            </div>
            <div style={{ fontSize: "12px", lineHeight: "1.7", color: "#444" }}>
              <div style={{ fontWeight: "700", marginBottom: "6px", color: "#333" }}>Detalii plată</div>
              <div style={{ marginBottom: "6px" }}>Vă rugăm să includeți numărul facturii <strong>{invoice.number}</strong> în detaliile transferului bancar.</div>
              <div style={{ marginBottom: "6px" }}>Cont: <strong>{settings.my_iban}</strong></div>
              <div>Banca: <strong>{settings.my_bank}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PVR Tipizat (print-ready) ────────────────────────────────────────────────
function PVRTipizat({ invoice, client, settings, contract }: {
  invoice: Invoice; client?: Client; settings: MySettings; contract?: any;
}) {
  const total = invoice.items.reduce((s, it) => s + it.total, 0);

  return (
    <div className="tipizat" style={{
      background: "#fff", padding: "60px", color: "#000",
      minHeight: "1000px", display: "flex", flexDirection: "column",
      boxShadow: "0 0 40px rgba(0,0,0,0.1)", borderRadius: "2px"
    }}>
      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "900", textTransform: "uppercase", margin: "0 0 10px" }}>
          Proces-Verbal de Recepție a Serviciilor
        </h1>
        <div style={{ fontSize: "14px", color: "#666" }}>
          Anexă la Contractul nr. {contract?.number || "—"} din data {contract?.date || "—"}
        </div>
      </div>

      <div style={{ marginBottom: "40px", fontSize: "14px", lineHeight: "1.6" }}>
        <p>Încheiat astăzi, <strong>{invoice.date}</strong>, între:</p>
        <p style={{ marginTop: "12px" }}>
          <strong>FURNIZOARE:</strong> {settings.my_name}, CIF {settings.my_cif}, cu sediul în {settings.my_address}, în calitate de Autor/Prestator.
        </p>
        <p style={{ marginTop: "12px" }}>
          <strong>BENEFICIAR:</strong> {client?.name}, CIF/CUI {client?.cif}, cu sediul în {client?.address}, în calitate de Beneficiar.
        </p>
      </div>

      <div style={{ marginBottom: "20px", fontSize: "14px", borderBottom: "1px solid #000", paddingBottom: "8px", fontWeight: "800", textTransform: "uppercase" }}>
        1. Obiectul Recepției
      </div>
      <div style={{ marginBottom: "40px", fontSize: "14px", lineHeight: "1.6" }}>
        Furnizorul a predat, iar Beneficiarul a recepționat următoarele livrabile/servicii aferente etapei: <strong>{invoice.category || "General"}</strong>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #000" }}>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Descriere</th>
              <th style={{ textAlign: "right", padding: "8px 0" }}>Valoare</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "12px 0" }}>{item.description}</td>
                <td style={{ textAlign: "right", padding: "12px 0", fontFamily: "var(--font-mono)" }}>
                  {item.total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: "12px 0", fontWeight: "800" }}>TOTAL</td>
              <td style={{ textAlign: "right", padding: "12px 0", fontWeight: "900", fontFamily: "var(--font-mono)" }}>
                {total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginBottom: "20px", fontSize: "14px", borderBottom: "1px solid #000", paddingBottom: "8px", fontWeight: "800", textTransform: "uppercase" }}>
        2. Constatări
      </div>
      <div style={{ marginBottom: "40px", fontSize: "14px", lineHeight: "1.6" }}>
        <p>Beneficiarul confirmă că serviciile menționate mai sus au fost prestate în totalitate, conform cerințelor stabilite în contract, fiind în stare corespunzătoare de utilizare.</p>
        <p style={{ marginTop: "12px" }}>Prin semnarea prezentului document, Beneficiarul acceptă livrabilele și se obligă la plata sumei de <strong>{total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON</strong> conform termenelor contractuale.</p>
      </div>

      {invoice.notes && (
        <>
          <div style={{ marginBottom: "20px", fontSize: "14px", borderBottom: "1px solid #000", paddingBottom: "8px", fontWeight: "800", textTransform: "uppercase" }}>
            3. Mențiuni Adiționale
          </div>
          <p style={{ marginBottom: "40px", fontSize: "14px", lineHeight: "1.6" }}>{invoice.notes}</p>
        </>
      )}

      {/* ── Signatures ── */}
      <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "100px", padding: "60px 0" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "#999", marginBottom: "40px" }}>Am predat (Furnizor)</div>
          <div style={{ borderBottom: "1px solid #000", height: "40px" }}></div>
          <div style={{ fontSize: "13px", marginTop: "8px", fontWeight: "700" }}>{settings.my_name}</div>
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "#999", marginBottom: "40px" }}>Am recepționat (Beneficiar)</div>
          <div style={{ borderBottom: "1px solid #000", height: "40px" }}></div>
          <div style={{ fontSize: "13px", marginTop: "8px", fontWeight: "700" }}>{client?.name}</div>
        </div>
      </div>
    </div>
  );
}
