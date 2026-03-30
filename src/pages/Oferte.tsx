import { useEffect, useState, useRef } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Plus, X, Trash2, FileText,
  Printer, Eye, Zap, FileSignature
} from "lucide-react";
import {
  getDb, peekQuoteNumber, bumpQuoteCounter,
  peekInvoiceNumber
} from "@/lib/db";
import { useToast } from "@/components/Toast";
import type { 
  Client, Quote, QuoteItem, ServiceCatalogItem, 
  OperatingMode, Settings 
} from "@/types";
import { useNavigate } from "react-router-dom";
import StatusDropdown from "@/components/StatusDropdown";
import QuoteTipizat from "@/components/QuoteTipizat";
import FieldLabel from "@/components/FieldLabel";
import ItemsTable from "@/components/ItemsTable";
import OfertaGeminiPanel from "@/components/OfertaGeminiPanel";

// Status options
type Status = Quote["status"];
const STATUS_LABELS: Record<Status, string> = {
  draft: "Ciornă", 
  sent: "Trimisă", 
  accepted: "Acceptată", 
  rejected: "Refuzată", 
  expired: "Expirată"
};

const PROJECT_TYPES = [
  "Pagina mea online (Landing Page)",
  "Site de prezentare",
  "Magazin online",
  "Aplicație web personalizată",
  "Aplicație pe telefon",
  "Site instalabil (PWA)",
  "Altele"
];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};
const addMonths = (d: string, n: number) => {
  const dt = new Date(d); dt.setMonth(dt.getMonth() + n);
  return dt.toISOString().slice(0, 10);
};

const emptyItem = (): QuoteItem => ({ description: "", quantity: 1, unit: "buc", unit_price: 0, total: 0 });

export default function Oferte() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [operatingMode, setOperatingMode] = useState<OperatingMode>("dda");
  const [showPrint, setShowPrint] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Form state
  const [clientId, setClientId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[1]);
  const [pageCount, setPageCount] = useState(1);
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);
  
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscriptionItems, setSubscriptionItems] = useState<QuoteItem[]>([]);
  const [subscriptionMonths, setSubscriptionMonths] = useState(12);
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(addMonths(today(), 1));
  
  const [discountPercent, setDiscountPercent] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(30);
  const [validUntil, setValidUntil] = useState(addDays(today(), 30));
  const [status, setStatus] = useState<Status>("draft");
  const [notes, setNotes] = useState("");
  
  const [geminiPanelOpen, setGeminiPanelOpen] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Listen for notes applied from the Gemini panel (rendered in Layout)
  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent).detail;
      setNotes(prev => prev ? prev + "\n\n" + text : text);
    };
    // Close panel if form is closed externally
    const closeHandler = (e: Event) => {
      const { open } = (e as CustomEvent).detail;
      if (!open) setGeminiPanelOpen(false);
    };
    window.addEventListener("oferta-gemini-note", handler);
    window.addEventListener("oferta-gemini", closeHandler);
    return () => {
      window.removeEventListener("oferta-gemini-note", handler);
      window.removeEventListener("oferta-gemini", closeHandler);
    };
  }, []);

  // Close panel when form is closed
  const closeForm = () => {
    setShowForm(false);
    if (geminiPanelOpen) {
      setGeminiPanelOpen(false);
      window.dispatchEvent(new CustomEvent("oferta-gemini", { detail: { open: false } }));
    }
  };

  useEffect(() => {
    if (!showPrint) return;
    window.print();
    setShowPrint(false);
  }, [showPrint]);

  const load = async () => {
    const db = await getDb();
    
    // Load Quotes
    const rows = await db.select<(Quote & { client_name: string })[]>(`
      SELECT q.*, c.name as client_name
      FROM quotes q LEFT JOIN clients c ON c.id = q.client_id
      ORDER BY q.created_at DESC
    `);
    setQuotes(rows.map(r => ({
      ...r,
      items: JSON.parse((r.items as any) || "[]"),
      subscription_items: JSON.parse((r.subscription_items as any) || "[]")
    })));
    
    // Load clients & catalog
    setClients(await db.select<Client[]>("SELECT * FROM clients ORDER BY name ASC"));
    setCatalog(await db.select<ServiceCatalogItem[]>("SELECT * FROM service_catalog ORDER BY sort_order ASC, name ASC"));

    // Load settings
    const settingRows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
    const sm: Record<string, any> = {};
    settingRows.forEach(r => (sm[r.key] = r.value));
    setSettings(sm);
    setOperatingMode((sm.operating_mode as OperatingMode) || "dda");
  };

  useEffect(() => { load(); }, []);

  const openNew = async () => {
    setEditing(null);
    setClientId("");
    setTitle("");
    setProjectType(PROJECT_TYPES[1]);
    setPageCount(1);
    setItems([emptyItem()]);
    
    setHasSubscription(false);
    setSubscriptionItems([]);
    setSubscriptionMonths(12);
    setSubscriptionStartDate(addMonths(today(), 1));
    
    setDiscountPercent(0);
    setDeliveryDays(30);
    setValidUntil(addDays(today(), 30));
    setStatus("draft");
    setNotes("");
    
    setShowForm(true);
  };

  const openEdit = (q: Quote) => {
    setEditing(q);
    setClientId(q.client_id);
    setTitle(q.title);
    setProjectType(q.project_type);
    setPageCount(q.page_count);
    setItems(q.items.length ? q.items : [emptyItem()]);
    
    setHasSubscription(!!q.has_subscription);
    setSubscriptionItems(q.subscription_items || []);
    setSubscriptionMonths(q.subscription_months || 12);
    setSubscriptionStartDate(q.subscription_start_date || addMonths(today(), 1));
    
    setDiscountPercent(q.discount_percent || 0);
    setDeliveryDays(q.delivery_days || 30);
    setValidUntil(q.valid_until || addDays(today(), 30));
    setStatus(q.status);
    setNotes(q.notes || "");
    
    setShowForm(true);
  };

  // Calculations
  const calcSubtotal = () => items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
  const calcDiscount = (subtotal: number) => (subtotal * discountPercent) / 100;
  const calcTotal = () => calcSubtotal() - calcDiscount(calcSubtotal());
  const calcSubPrice = () => subscriptionItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  const save = async () => {
    if (!clientId) {
      toast("Selectează un client", "error");
      return;
    }
    
    const db = await getDb();
    const st = calcSubtotal();
    const discAmt = calcDiscount(st);
    const tot = calcTotal();
    const subP = calcSubPrice();

    if (editing) {
      await db.execute(`
        UPDATE quotes SET 
          client_id=?, title=?, project_type=?, page_count=?, items=?, 
          subscription_items=?, subscription_price=?, subscription_months=?, subscription_start_date=?, has_subscription=?,
          subtotal=?, discount_percent=?, discount_amount=?, total=?, 
          delivery_days=?, valid_until=?, status=?, notes=?
        WHERE id=?`,
        [
          clientId, title, projectType, pageCount, JSON.stringify(items),
          JSON.stringify(subscriptionItems), subP, subscriptionMonths, subscriptionStartDate, hasSubscription ? 1 : 0,
          st, discountPercent, discAmt, tot,
          deliveryDays, validUntil, status, notes,
          editing.id
        ]
      );
    } else {
      const number = await peekQuoteNumber();
      await db.execute(`
        INSERT INTO quotes(
          number, client_id, title, project_type, page_count, items,
          subscription_items, subscription_price, subscription_months, subscription_start_date, has_subscription,
          subtotal, discount_percent, discount_amount, total,
          delivery_days, valid_until, status, notes
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          number, clientId, title, projectType, pageCount, JSON.stringify(items),
          JSON.stringify(subscriptionItems), subP, subscriptionMonths, subscriptionStartDate, hasSubscription ? 1 : 0,
          st, discountPercent, discAmt, tot,
          deliveryDays, validUntil, status, notes
        ]
      );
      await bumpQuoteCounter();
    }
    
    setShowForm(false);
    load();
    toast(editing ? "Ofertă actualizată" : "Ofertă creată", "success");
  };

  const remove = (id: number) => {
    setConfirmModal({
      message: "Ștergi oferta? Această acțiune nu poate fi anulată.",
      onConfirm: async () => {
        setConfirmModal(null);
        const db = await getDb();
        await db.execute("DELETE FROM quotes WHERE id=?", [id]);
        load();
        toast("Ofertă ștearsă", "info");
      },
    });
  };

  const changeStatus = async (id: number, s: Status) => {
    const db = await getDb();
    await db.execute("UPDATE quotes SET status=? WHERE id=?", [s, id]);
    load();
    toast(`Status actualizat: ${STATUS_LABELS[s]}`, "info");
    
    if (s === "accepted") {
      setConfirmModal({
        message: "Oferta a fost acceptată. Dorești să generezi contractul acum?",
        onConfirm: () => {
          setConfirmModal(null);
          const q = quotes.find(quote => quote.id === id);
          if (q) {
            sessionStorage.setItem("quote_to_contract", JSON.stringify(q));
            navigate("/contracte");
          }
        }
      });
    }
  };

  const handlePrint = () => setShowPrint(true);
  const getClient = (q: Quote) => clients.find(c => c.id === q.client_id);

  const addServiceFromCatalog = (serviceId: number, isSub: boolean) => {
    const svc = catalog.find(c => c.id === serviceId);
    if (!svc) return;
    
    const newItem: QuoteItem = {
      service_id: svc.id,
      description: svc.name,
      quantity: 1,
      unit: svc.unit,
      unit_price: svc.default_price,
      total: svc.default_price
    };
    
    if (isSub) {
      setSubscriptionItems(prev => [...prev, newItem]);
      if (!hasSubscription) setHasSubscription(true);
    } else {
      setItems(prev => {
        const last = prev[prev.length - 1];
        if (prev.length === 1 && !last.description && !last.unit_price) {
          return [newItem];
        }
        return [...prev, newItem];
      });
    }
  };

  const updateItem = (list: "items" | "sub", i: number, field: keyof QuoteItem, val: string | number) => {
    const setter = list === "items" ? setItems : setSubscriptionItems;
    setter(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      next[i].total = Number(next[i].quantity) * Number(next[i].unit_price);
      return next;
    });
  };

  const removeItem = (list: "items" | "sub", i: number) => {
    const setter = list === "items" ? setItems : setSubscriptionItems;
    setter(prev => prev.filter((_, j) => j !== i));
  };

  const buildQuoteContext = () => {
    const client = clients.find(c => c.id === clientId);
    const serviceList = items.filter(it => it.description).map(it => `  - ${it.description}: ${it.total} RON`).join("\n") || "  (niciun serviciu adăugat încă)";
    const subList = hasSubscription && subscriptionItems.length
      ? subscriptionItems.filter(it => it.description).map(it => `  - ${it.description}: ${it.unit_price} RON/lună`).join("\n")
      : null;

    return `Ești un consultant de vânzări și strateg digital specializat pe piața din România.
Ajuți un freelancer să optimizeze o ofertă comercială.

OFERTĂ CURENTĂ:
- Client: ${client?.name || "nespecificat"}
- Titlu proiect: ${title || "nespecificat"}
- Tip proiect: ${projectType}
- Pagini estimate: ${pageCount}
- Termen livrare: ${deliveryDays} zile
- Valabilitate ofertă: ${validUntil}

SERVICII ONE-TIME:
${serviceList}
- Subtotal: ${calcSubtotal()} RON
${discountPercent > 0 ? `- Discount: ${discountPercent}% (−${calcDiscount(calcSubtotal())} RON)` : ""}
- TOTAL PROIECT: ${calcTotal()} RON
${subList ? `\nABONAMENT LUNAR:\n${subList}\n- Total lunar: ${calcSubPrice()} RON/lună\n- Perioadă minimă: ${subscriptionMonths} luni\n- Start: ${subscriptionStartDate}` : "- Fără plan de abonament"}
${notes ? `\nNOTE CURENTE:\n${notes}` : ""}

Răspunde concis și practic în română.`;
  };

  const convertToFinancialDoc = async (q: Quote) => {
    const db = await getDb();
    const number = await peekInvoiceNumber();
    const client = getClient(q);
    
    if (!client) return;

    const financialData = {
      number,
      client_id: q.client_id,
      contract_id: null,
      date: today(),
      due_date: addDays(today(), 14),
      items: JSON.stringify(q.items),
      total: q.total,
      status: "draft" as any,
      category: operatingMode === "dda" ? "PVR Ofertă" : "Factură Ofertă",
      is_signed: operatingMode === "dda" ? 1 : 0,
      notes: `Generat din oferta ${q.number}`,
      source: "mine" as any
    };

    try {
      await db.execute(`
        INSERT INTO invoices(number, client_id, date, due_date, items, total, status, category, is_signed, notes, source)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [
          financialData.number, financialData.client_id, financialData.date, financialData.due_date, 
          financialData.items, financialData.total, financialData.status, financialData.category, 
          financialData.is_signed, financialData.notes, financialData.source
        ]
      );
      toast(operatingMode === "dda" ? "PVR generat în Venituri" : "Factură generată", "success");
      navigate("/facturi");
    } catch (e) {
      toast("Eroare la generare document", "error");
    }
  };

  return (
    <div style={{ padding: "36px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Oferte</h1>
          <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 5 }}>
            Propune proiecte noi și gestionează relația cu clienții
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate("/setari")}>
            Catalog Servicii
          </button>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={14} strokeWidth={2.5} /> Ofertă nouă
          </button>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Număr</th>
              <th>Client</th>
              <th>Proiect</th>
              <th style={{ textAlign: "right" }}>Valoare</th>
              <th style={{ textAlign: "right" }}>Abonament</th>
              <th>Status</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px 0", color: "var(--tx-4)" }}>
                <FileText size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                Nu ai creat nicio ofertă încă
              </td></tr>
            ) : quotes.map(q => (
              <tr key={q.id}>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{q.number}</td>
                <td style={{ color: "var(--tx-1)", fontWeight: 500 }}>{q.client_name || "—"}</td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{q.title || "Proiect fără titlu"}</span>
                    <span style={{ fontSize: 11, color: "var(--tx-3)" }}>{q.project_type}</span>
                  </div>
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>
                  {q.total.toLocaleString("ro-RO")} lei
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--tx-2)" }}>
                  {q.has_subscription ? `${q.subscription_price.toLocaleString("ro-RO")} lei/lună` : "—"}
                </td>
                <td>
                  <StatusDropdown value={q.status} onChange={(s: Status) => changeStatus(q.id, s)} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} onClick={() => setPreviewQuote(q)}>
                      <Eye size={12} />
                    </button>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} onClick={() => openEdit(q)}>
                      <FileSignature size={12} />
                    </button>
                    <button className="btn btn-danger-ghost" style={{ padding: "5px 8px" }} onClick={() => remove(q.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Formular Ofertă */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="modal" style={{ width: 850, maxWidth: "95vw" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{editing ? `Editează oferta ${editing.number}` : "Creează Ofertă Nouă"}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    const next = !geminiPanelOpen;
                    setGeminiPanelOpen(next);
                    window.dispatchEvent(new CustomEvent("oferta-gemini", {
                      detail: { open: next, context: buildQuoteContext() },
                    }));
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                    borderRadius: "var(--r-md)",
                    border: geminiPanelOpen ? "1px solid var(--ac)" : "1px solid var(--border)",
                    background: geminiPanelOpen ? "var(--ac-dim)" : "var(--bg-2)",
                    color: geminiPanelOpen ? "var(--ac)" : "var(--tx-2)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <Zap size={14} fill="currentColor" />
                  Asistent AI
                </button>
                <button onClick={closeForm} className="btn btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
              </div>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, maxHeight: "70vh", overflowY: "auto" }}>
              
              {/* Header Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <FieldLabel>Client</FieldLabel>
                  <select className="field" value={clientId} onChange={e => setClientId(Number(e.target.value) || "")}>
                    <option value="">Selectează client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <FieldLabel>Titlu Proiect (Nume prietenos)</FieldLabel>
                  <input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Soluție Prezență Online Profesională" />
                </div>
                <div>
                  <FieldLabel>Tip Proiect</FieldLabel>
                  <select className="field" value={projectType} onChange={e => setProjectType(e.target.value)}>
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Nr. Pagini estimat</FieldLabel>
                  <input className="field" type="number" value={pageCount} onChange={e => setPageCount(Number(e.target.value))} />
                </div>
                <div>
                  <FieldLabel>Valabilitate (până la)</FieldLabel>
                  <input className="field" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </div>
              </div>

              {/* Servicii One-Time */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--tx-3)" }}>1. Servicii Construcție Site / Aplicație</h4>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select className="field" style={{ width: 220, fontSize: 12, padding: "4px 8px" }} onChange={e => {
                      if (e.target.value) {
                        addServiceFromCatalog(Number(e.target.value), false);
                        e.target.value = "";
                      }
                    }}>
                      <option value="">+ Din Catalog...</option>
                      {catalog.filter(c => !c.is_recurring).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.default_price} lei)</option>
                      ))}
                    </select>
                    <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setItems(p => [...p, emptyItem()])}>
                      Linie custom
                    </button>
                  </div>
                </div>
                <ItemsTable items={items} listName="items" updateItem={updateItem} removeItem={removeItem} />
                
                {/* Total / Discount */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--tx-2)" }}>
                      <span>Subtotal project-based:</span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{calcSubtotal().toLocaleString()} lei</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--tx-2)" }}>Discount global (%):</span>
                      <input className="field" type="number" style={{ width: 60, textAlign: "right" }} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} />
                    </div>
                    <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
                      <span>Total Proiect:</span>
                      <span style={{ color: "var(--ac)" }}>{calcTotal().toLocaleString()} lei</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Abonamente */}
              <div style={{ background: "var(--bg-1)", padding: 20, borderRadius: "var(--r-lg)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={hasSubscription} onChange={e => setHasSubscription(e.target.checked)} style={{ width: 16, height: 16 }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Include plan de mentenanță / abonament lunar</span>
                  </label>
                  {hasSubscription && (
                    <select className="field" style={{ width: 220, fontSize: 12, padding: "4px 8px" }} onChange={e => {
                      if (e.target.value) {
                        addServiceFromCatalog(Number(e.target.value), true);
                        e.target.value = "";
                      }
                    }}>
                      <option value="">+ Din Catalog Mentenanță...</option>
                      {catalog.filter(c => c.is_recurring).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.default_price} lei)</option>
                      ))}
                    </select>
                  )}
                </div>

                {hasSubscription && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <FieldLabel>Perioadă minimă contractată (luni)</FieldLabel>
                        <input className="field" type="number" min={1} value={subscriptionMonths} onChange={e => setSubscriptionMonths(Number(e.target.value))} />
                      </div>
                      <div>
                        <FieldLabel>Data estimată de start abonament</FieldLabel>
                        <input className="field" type="date" value={subscriptionStartDate} onChange={e => setSubscriptionStartDate(e.target.value)} />
                      </div>
                    </div>
                    <ItemsTable items={subscriptionItems} listName="sub" updateItem={updateItem} removeItem={removeItem} />
                    <div style={{ textAlign: "right", fontSize: 14, fontWeight: 600 }}>
                      Total lunar: <span style={{ color: "var(--blue)" }}>{calcSubPrice().toLocaleString()} lei / lună</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <FieldLabel>Note, Garanții și Condiții parteneriat</FieldLabel>
                <textarea className="field" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Scrie aici notele tale sau cere ajutorul Gemini..." style={{ resize: "vertical" }} />
              </div>

            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-ghost" onClick={closeForm}>Anulează</button>
              <button className="btn btn-primary" onClick={save}>
                {editing ? "Salvează Modificări" : "Creează Ofertă"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Ofertă */}
      {previewQuote && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPreviewQuote(null)}>
          <div className="modal" style={{ width: 800, maxHeight: "95vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{previewQuote.number} · {previewQuote.client_name}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {previewQuote.status === "accepted" && (
                  <button className="btn btn-primary" style={{ background: "var(--green)", border: "none" }} onClick={() => convertToFinancialDoc(previewQuote)}>
                    Generează {operatingMode === "dda" ? "PVR" : "Factură"}
                  </button>
                )}
                <button className="btn btn-ghost" onClick={handlePrint}><Printer size={16} /></button>
                <button onClick={() => setPreviewQuote(null)} className="btn btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
              </div>
            </div>
            
            <div ref={printRef} className="print-frame" style={{ flex: 1, overflowY: "auto", background: "white", padding: 60 }}>
              <QuoteTipizat quote={previewQuote} client={getClient(previewQuote)} settings={settings as any} />
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

    </div>
  );
}
