import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, Search, Receipt, Filter } from "lucide-react";
import { getDb } from "@/lib/db";
import { useToast } from "@/components/Toast";
import { CATEGORIES, CATEGORY_BADGE, getCategoryLabel } from "@/lib/constants";
import type { Expense } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const emptyForm = (): Omit<Expense, "id" | "created_at"> => ({
  date: today(),
  description: "",
  amount: 0,
  category: "altele",
});

export default function Cheltuieli() {
  const { toast } = useToast();
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Expense | null>(null);
  const [form, setForm]             = useState(emptyForm());

  const load = async () => {
    const db = await getDb();
    const rows = await db.select<Expense[]>("SELECT * FROM expenses ORDER BY date DESC, created_at DESC");
    setExpenses(rows);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({ date: e.date, description: e.description, amount: e.amount, category: e.category });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.description.trim() || form.amount <= 0) return;
    const db = await getDb();
    if (editing) {
      await db.execute(
        "UPDATE expenses SET date=?, description=?, amount=?, category=? WHERE id=?",
        [form.date, form.description, form.amount, form.category, editing.id]
      );
    } else {
      await db.execute(
        "INSERT INTO expenses(date, description, amount, category) VALUES(?,?,?,?)",
        [form.date, form.description, form.amount, form.category]
      );
    }
    setShowForm(false);
    load();
    toast(editing ? "Cheltuială actualizată" : "Cheltuială adăugată", "success");
  };

  const remove = async (id: number) => {
    if (!confirm("Ștergi această cheltuială?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM expenses WHERE id=?", [id]);
    load();
    toast("Cheltuială ștearsă", "info");
  };

  // Filtered & aggregated
  const filtered = expenses.filter(e => {
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && e.category !== filterCat) return false;
    if (filterMonth && !e.date.startsWith(filterMonth)) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  // Monthly totals for current year
  const year = new Date().getFullYear();
  const monthlyTotals = expenses
    .filter(e => e.date.startsWith(String(year)))
    .reduce<Record<string, number>>((acc, e) => {
      const m = e.date.slice(0, 7);
      acc[m] = (acc[m] || 0) + e.amount;
      return acc;
    }, {});

  const yearTotal = Object.values(monthlyTotals).reduce((s, v) => s + v, 0);

  // Category breakdown
  const categoryBreakdown = filtered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  return (
    <div style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Cheltuieli</h1>
          <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 5 }}>
            {expenses.length} {expenses.length === 1 ? "cheltuială înregistrată" : "cheltuieli înregistrate"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={14} strokeWidth={2.5} /> Cheltuială nouă
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            Total filtrat
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--red)" }}>
            {totalFiltered.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>
            {filtered.length} {filtered.length === 1 ? "înregistrare" : "înregistrări"} afișate
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            Total anul {year}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--tx-1)" }}>
            {yearTotal.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
          </div>
          <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>
            {Object.keys(monthlyTotals).length} luni cu cheltuieli
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--tx-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
            Categorii (filtrat)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {Object.entries(categoryBreakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([cat, val]) => (
                <span key={cat} style={{ fontSize: 11 }}>
                  <span className={CATEGORY_BADGE[cat] || "badge badge-muted"}>
                    {getCategoryLabel(cat)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--tx-3)", marginLeft: 4 }}>
                    {val.toLocaleString("ro-RO", { minimumFractionDigits: 0 })}
                  </span>
                </span>
              ))}
            {Object.keys(categoryBreakdown).length === 0 && (
              <span style={{ fontSize: 12, color: "var(--tx-4)" }}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--tx-3)", pointerEvents: "none" }} />
          <input
            className="field"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută după descriere..."
            style={{ paddingLeft: 32 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} style={{ color: "var(--tx-3)" }} />
          <select className="field" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">Toate categoriile</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <input
          className="field"
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={{ minWidth: 170 }}
          title="Filtrare pe lună"
        />

        {(search || filterCat || filterMonth) && (
          <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}
            onClick={() => { setSearch(""); setFilterCat(""); setFilterMonth(""); }}>
            Resetează filtre
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Dată</th>
              <th>Descriere</th>
              <th>Categorie</th>
              <th style={{ textAlign: "right" }}>Sumă</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "60px 0", color: "var(--tx-4)" }}>
                  <Receipt size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                  {search || filterCat || filterMonth
                    ? "Nicio cheltuială găsită pentru filtrele selectate"
                    : "Nicio cheltuială adăugată încă"}
                </td>
              </tr>
            ) : filtered.map(e => (
              <tr key={e.id}>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tx-3)", whiteSpace: "nowrap" }}>
                  {e.date}
                </td>
                <td style={{ color: "var(--tx-1)", fontWeight: 500 }}>{e.description}</td>
                <td>
                  <span className={CATEGORY_BADGE[e.category] || "badge badge-muted"}>
                    {getCategoryLabel(e.category)}
                  </span>
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--red)" }}>
                  -{e.amount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} onClick={() => openEdit(e)}>
                      <Pencil size={12} />
                    </button>
                    <button className="btn btn-danger-ghost" style={{ padding: "5px 8px" }} onClick={() => remove(e.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 460 }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>
                  {editing ? "Editează cheltuială" : "Cheltuială nouă"}
                </h3>
                <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 2 }}>
                  {editing
                    ? `Actualizezi: ${editing.description}`
                    : "Adaugă o cheltuială deductibilă (PFA — sistem real)"}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 6, color: "var(--tx-3)", display: "flex", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Fields */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="field-label">Dată *</label>
                  <input className="field" type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Categorie *</label>
                  <select className="field" value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Descriere *</label>
                <input className="field" value={form.description} placeholder="ex: Laptop de lucru, licență JetBrains..."
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && save()} />
              </div>

              <div>
                <label className="field-label">Sumă (RON) *</label>
                <input className="field" type="number" value={form.amount} min={0} step={0.01}
                  placeholder="0.00"
                  onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 14 }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Anulează</button>
              <button className="btn btn-primary" onClick={save}
                disabled={!form.description.trim() || form.amount <= 0}>
                <Check size={13} strokeWidth={2.5} />
                {editing ? "Salvează" : "Adaugă cheltuială"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
