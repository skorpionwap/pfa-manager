import { useEffect, useState, useRef } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Plus, X, Trash2, FileText,
  Printer, Eye, Zap, FileSignature, ListPlus, Bot
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

  const [activeTab, setActiveTab] = useState<"oferte" | "catalog">("oferte");
  const [editingSvc, setEditingSvc] = useState<Partial<ServiceCatalogItem> | null>(null);
  const [viewingSvc, setViewingSvc] = useState<ServiceCatalogItem | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Listen for notes or full config applied from the Gemini panel (rendered in Layout)
  useEffect(() => {
    const handler = (e: Event) => {
      const { text, config } = (e as CustomEvent).detail;
      if (config) {
        // AI Wizard Config Application
        if (config.title) setTitle(config.title);
        if (config.project_type) setProjectType(config.project_type);
        if (config.page_count) setPageCount(config.page_count);
        if (config.delivery_days) setDeliveryDays(config.delivery_days);
        if (config.items) {
          setItems(config.items.map((it: any) => ({
            ...emptyItem(),
            ...it,
            total: (it.quantity || 1) * (it.unit_price || 0)
          })));
        }
        if (config.has_subscription !== undefined) {
          setHasSubscription(config.has_subscription);
          if (config.subscription_items) {
            setSubscriptionItems(config.subscription_items.map((it: any) => ({
              ...emptyItem(),
              ...it,
              total: (it.quantity || 1) * (it.unit_price || 0)
            })));
          }
          if (config.subscription_months) setSubscriptionMonths(config.subscription_months);
        }
        if (config.notes) setNotes(prev => prev ? prev + "\n\n" + config.notes : config.notes);
        toast("Configurație AI aplicată!", "success");
      } else if (text) {
        setNotes(prev => prev ? prev + "\n\n" + text : text);
      }
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
  }, [clients]); // Add dependencies if needed for toast or state setters

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

  const handleSaveCatalogItem = async () => {
    if (!editingSvc?.name) return;
    const db = await getDb();
    try {
      if (editingSvc.id) {
        await db.execute(
          "UPDATE service_catalog SET category=?, name=?, description=?, features=?, default_price=?, unit=?, is_recurring=?, sort_order=? WHERE id=?",
          [editingSvc.category, editingSvc.name, editingSvc.description || "", editingSvc.features || "[]", editingSvc.default_price || 0, editingSvc.unit || "buc", editingSvc.is_recurring ? 1 : 0, editingSvc.sort_order || 0, editingSvc.id]
        );
      } else {
        await db.execute(
          "INSERT INTO service_catalog (category, name, description, features, default_price, unit, is_recurring, sort_order) VALUES (?,?,?,?,?,?,?,?)",
          [editingSvc.category || "General", editingSvc.name, editingSvc.description || "", editingSvc.features || "[]", editingSvc.default_price || 0, editingSvc.unit || "buc", editingSvc.is_recurring ? 1 : 0, editingSvc.sort_order || 0]
        );
      }
      setEditingSvc(null);
      const rows = await db.select<ServiceCatalogItem[]>("SELECT * FROM service_catalog ORDER BY sort_order ASC");
      setCatalog(rows);
      toast("Catalog actualizat");
    } catch (e) {
      toast("Eroare la salvare item catalog", "error");
    }
  };

  const handleDeleteCatalogItem = async (id: number) => {
    if (!confirm("Ești sigur că ștergi acest serviciu din catalog?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM service_catalog WHERE id=?", [id]);
    setCatalog(prev => prev.filter(i => i.id !== id));
    toast("Serviciu șters");
  };

  const addServiceFromCatalog = (serviceId: number, isSub: boolean) => {
    const svc = catalog.find(c => c.id === serviceId);
    if (!svc) return;

    let features: string[] = [];
    try {
      features = JSON.parse(svc.features || "[]");
    } catch(e) {}

    const newItem: QuoteItem = {
      service_id: svc.id,
      description: svc.description || svc.name,
      features,
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

  const updateItem = (list: "items" | "sub", i: number, field: keyof QuoteItem, val: any) => {
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

Dacă utilizatorul îți cere să generezi oferta, poți răspunde cu un bloc JSON valid între tag-uri <config>...</config> care să conțină:
{
  "title": "...",
  "project_type": "...",
  "page_count": 5,
  "delivery_days": 30,
  "items": [{"description": "...", "quantity": 1, "unit": "buc", "unit_price": 1000, "features": ["...", "..."]}],
  "has_subscription": true,
  "subscription_items": [...],
  "subscription_months": 12,
  "notes": "..."
}

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
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={14} strokeWidth={2.5} /> Ofertă nouă
          </button>
        </div>
      </div>

      {/* Tab Control */}
      <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", padding: 4, width: "fit-content" }}>
        <button
          onClick={() => setActiveTab("oferte")}
          className={activeTab === "oferte" ? "btn-tab active" : "btn-tab"}
        >
          <FileText size={15} /> Oferte
        </button>
        <button
          onClick={() => setActiveTab("catalog")}
          className={activeTab === "catalog" ? "btn-tab active" : "btn-tab"}
        >
          <ListPlus size={15} /> Catalog Servicii
        </button>
      </div>

      {/* Oferte List Tab */}
      {activeTab === "oferte" && (
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
      )}

      {/* Catalog Servicii Tab */}
      {activeTab === "catalog" && (
        <div className="card" style={{ overflow: "hidden", border: "1px solid var(--border-md)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "var(--blue-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ListPlus size={13} color="var(--blue)" />
              </div>
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 13, color: "var(--tx-1)" }}>
                Catalog Servicii (Oferte)
              </span>
            </div>
            <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEditingSvc({ name: "", category: "General", default_price: 0, unit: "buc", is_recurring: false })}>
              <Plus size={12} /> Adaugă serviciu
            </button>
          </div>

          <div style={{ padding: "0" }}>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-base)", display: "grid", gridTemplateColumns: "2fr 100px 80px 100px", gap: 12, fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase" }}>
              <span>Nume Serviciu / Categorie</span>
              <span style={{ textAlign: "right" }}>Preț (lei)</span>
              <span style={{ textAlign: "center" }}>Tip</span>
              <span style={{ textAlign: "center" }}>Acțiuni</span>
            </div>
            {catalog.map(item => (
              <div key={item.id} className="catalog-row" style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "2fr 100px 80px 100px", gap: 12, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: "var(--tx-4)" }}>{item.category}</span>
                  <button 
                    className="btn btn-ghost" 
                    style={{ padding: "2px 6px", fontSize: 10, width: "fit-content", marginTop: 4 }}
                    onClick={() => setViewingSvc(item)}
                  >
                    <Eye size={10} /> Vezi detalii
                  </button>
                </div>
                <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>
                  {item.default_price.toLocaleString()} lei
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: item.is_recurring ? "var(--blue-dim)" : "var(--bg-3)", color: item.is_recurring ? "var(--blue)" : "var(--tx-3)" }}>
                    {item.is_recurring ? "RECURENT" : "PROIECT"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setEditingSvc(item)} title="Editează">
                    <Bot size={12} />
                  </button>
                  <button className="btn btn-danger-ghost" style={{ padding: 4 }} onClick={() => handleDeleteCatalogItem(item.id)} title="Șterge">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {catalog.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--tx-4)", fontSize: 12 }}>
                Nu ai servicii în catalog. Folosește butonul de sus pentru a adăuga.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Vezi Detalii Serviciu */}
      {viewingSvc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewingSvc(null)}>
          <div className="modal" style={{ width: 600, maxWidth: "95vw" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--tx-1)" }}>{viewingSvc.name}</h3>
                <span style={{ fontSize: 11, color: "var(--tx-4)" }}>{viewingSvc.category}</span>
              </div>
              <button className="btn btn-ghost" onClick={() => setViewingSvc(null)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase", marginBottom: 8 }}>Descriere</div>
                <div style={{ fontSize: 13, color: "var(--tx-1)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {viewingSvc.description}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
                <div style={{ padding: 12, background: "var(--bg-1)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase" }}>Preț</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--tx-1)", fontFamily: "var(--font-mono)" }}>
                    {viewingSvc.default_price.toLocaleString()} lei
                  </div>
                </div>
                <div style={{ padding: 12, background: "var(--bg-1)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase" }}>Unitate</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx-1)" }}>
                    {viewingSvc.unit}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setViewingSvc(null)}>Închide</button>
              <button className="btn btn-primary" onClick={() => { setViewingSvc(null); setEditingSvc(viewingSvc); }}>Editează</button>
            </div>
          </div>
        </div>
      )}

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

            <div style={{ padding: "12px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={closeForm}>Anulează</button>
              <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={save}>
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

      {/* Modal Editare Serviciu */}
      {editingSvc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingSvc(null)}>
          <div className="modal" style={{ width: 450 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{editingSvc.id ? "Editează Serviciu" : "Serviciu Nou"}</h3>
              <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => setEditingSvc(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, marginBottom: 6 }}>Nume Serviciu</div>
                <input className="field" value={editingSvc.name || ""} onChange={e => setEditingSvc({ ...editingSvc, name: e.target.value })} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, marginBottom: 6 }}>Descriere (ce include serviciul)</div>
                <textarea 
                  className="field" 
                  rows={4} 
                  value={editingSvc.description || ""} 
                  onChange={e => setEditingSvc({ ...editingSvc, description: e.target.value })}
                  placeholder="Ex: Transform structura în design vizual profesional."
                  style={{ resize: "vertical" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>Livrabile și funcționalități (unul pe rând)</span>
                  <span style={{ color: "var(--ac)", fontWeight: 700 }}>STRUCTURAT</span>
                </div>
                <textarea 
                  className="field" 
                  rows={5} 
                  value={(() => {
                    try {
                      const f = JSON.parse(editingSvc.features || "[]");
                      return Array.isArray(f) ? f.join("\n") : "";
                    } catch(e) { return ""; }
                  })()} 
                  onChange={e => setEditingSvc({ ...editingSvc, features: JSON.stringify(e.target.value.split("\n").filter(x => x.trim())) })}
                  placeholder="• Wireframe-uri pagini&#10;• Design UI final Figma&#10;• Ghid de stil culori/fonturi"
                  style={{ resize: "vertical", fontSize: 12 }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, marginBottom: 6 }}>Categorie</div>
                  <input className="field" value={editingSvc.category || ""} onChange={e => setEditingSvc({ ...editingSvc, category: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, marginBottom: 6 }}>Ordine sortare</div>
                  <input className="field" type="number" value={editingSvc.sort_order || 0} onChange={e => setEditingSvc({ ...editingSvc, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, marginBottom: 6 }}>Preț default (lei)</div>
                  <input className="field" type="number" value={editingSvc.default_price || 0} onChange={e => setEditingSvc({ ...editingSvc, default_price: Number(e.target.value) })} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, marginBottom: 6 }}>Unitate</div>
                  <input className="field" value={editingSvc.unit || "buc"} onChange={e => setEditingSvc({ ...editingSvc, unit: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={!!editingSvc.is_recurring} onChange={e => setEditingSvc({ ...editingSvc, is_recurring: e.target.checked })} />
                  Acest serviciu este recurent (pentru Abonament)
                </label>
              </div>
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setEditingSvc(null)}>Anulează</button>
              <button className="btn btn-primary" onClick={handleSaveCatalogItem}>Salvează</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
