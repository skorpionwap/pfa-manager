import { useEffect, useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Check, UserCircle2 } from "lucide-react";
import { getDb } from "@/lib/db";
import type { Client } from "@/types";

const empty = (): Omit<Client, "id" | "created_at"> => ({
  name: "", cif: "", address: "", email: "", phone: "", contact_person: "",
});

const FIELDS = [
  { key: "name",           label: "Nume / Denumire *", placeholder: "SC Exemplu SRL",        span: 2 },
  { key: "cif",            label: "CIF / CNP",          placeholder: "RO12345678",             span: 1 },
  { key: "contact_person", label: "Persoană contact",   placeholder: "Ion Popescu",            span: 1 },
  { key: "email",          label: "Email",               placeholder: "contact@firma.ro",       span: 1 },
  { key: "phone",          label: "Telefon",             placeholder: "0722 000 000",           span: 1 },
  { key: "address",        label: "Adresă",              placeholder: "Str. Exemplu nr. 1, București", span: 2 },
] as const;

export default function Clienti() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [search, setSearch]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Client | null>(null);
  const [form, setForm]         = useState(empty());
  const searchRef               = useRef<HTMLInputElement>(null);

  const load = async () => {
    const db = await getDb();
    setClients(await db.select<Client[]>("SELECT * FROM clients ORDER BY name ASC"));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty()); setShowForm(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, cif: c.cif, address: c.address, email: c.email, phone: c.phone, contact_person: c.contact_person });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const db = await getDb();
    if (editing) {
      await db.execute(
        "UPDATE clients SET name=?,cif=?,address=?,email=?,phone=?,contact_person=? WHERE id=?",
        [form.name, form.cif, form.address, form.email, form.phone, form.contact_person, editing.id]
      );
    } else {
      await db.execute(
        "INSERT INTO clients(name,cif,address,email,phone,contact_person) VALUES(?,?,?,?,?,?)",
        [form.name, form.cif, form.address, form.email, form.phone, form.contact_person]
      );
    }
    setShowForm(false);
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Ștergi clientul?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM clients WHERE id=?", [id]);
    load();
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cif.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: "36px 40px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Clienți</h1>
          <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 5 }}>
            {clients.length} {clients.length === 1 ? "client înregistrat" : "clienți înregistrați"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={14} strokeWidth={2.5} /> Client nou
        </button>
      </div>

      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 16, maxWidth: 400 }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--tx-3)", pointerEvents: "none" }} />
        <input
          ref={searchRef}
          className="field"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută după nume, CIF, email..."
          style={{ paddingLeft: 32 }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Nume</th>
              <th>CIF</th>
              <th>Contact</th>
              <th>Email</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "60px 0", color: "var(--tx-4)" }}>
                  <UserCircle2 size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                  {search ? `Niciun rezultat pentru „${search}"` : "Niciun client adăugat încă"}
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ paddingRight: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "var(--r-md)",
                    background: "var(--bg-3)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 600, color: "var(--ac)",
                    fontFamily: "var(--font-head)",
                  }}>
                    {c.name ? initials(c.name) : "?"}
                  </div>
                </td>
                <td style={{ color: "var(--tx-1)", fontWeight: 500 }}>{c.name}</td>
                <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--tx-3)" }}>{c.cif || "—"}</span></td>
                <td style={{ color: "var(--tx-3)" }}>{c.contact_person || "—"}</td>
                <td style={{ color: "var(--tx-3)" }}>{c.email || "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" style={{ padding: "5px 8px" }} onClick={() => openEdit(c)}>
                      <Pencil size={12} />
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

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            {/* Modal header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 15, color: "var(--tx-1)" }}>
                  {editing ? "Editează client" : "Client nou"}
                </h3>
                <p style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 2 }}>
                  {editing ? `Actualizezi datele pentru ${editing.name}` : "Adaugă un client nou în registru"}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "6px", color: "var(--tx-3)", display: "flex", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Fields */}
            <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {FIELDS.map(({ key, label, placeholder, span }) => (
                <div key={key} style={{ gridColumn: `span ${span}` }}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--tx-3)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                    {label}
                  </label>
                  <input
                    className="field"
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    onKeyDown={e => e.key === "Enter" && key === "address" && save()}
                  />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ padding: "16px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Anulează</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name.trim()}>
                <Check size={13} strokeWidth={2.5} />
                {editing ? "Salvează" : "Adaugă client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
