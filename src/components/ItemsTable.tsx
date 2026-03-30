import { X } from "lucide-react";
import type { QuoteItem } from "@/types";

interface ItemsTableProps {
  items: QuoteItem[];
  listName: "items" | "sub";
  updateItem: (list: "items" | "sub", i: number, field: keyof QuoteItem, val: string | number) => void;
  removeItem: (list: "items" | "sub", i: number) => void;
}

export default function ItemsTable({ items, listName, updateItem, removeItem }: ItemsTableProps) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--tx-3)" }}>Serviciu / Descriere</th>
            <th style={{ width: 60, textAlign: "center", padding: "10px 8px", color: "var(--tx-3)" }}>Cant.</th>
            <th style={{ width: 80, textAlign: "center", padding: "10px 8px", color: "var(--tx-3)" }}>Unitare</th>
            <th style={{ width: 100, textAlign: "right", padding: "10px 12px", color: "var(--tx-3)" }}>Preț unitar</th>
            <th style={{ width: 100, textAlign: "right", padding: "10px 12px", color: "var(--tx-3)" }}>Total</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: 4 }}>
                <input
                  className="field"
                  style={{ border: "none", background: "transparent", padding: "6px 8px" }}
                  value={it.description}
                  placeholder="Descriere serviciu..."
                  onChange={e => updateItem(listName, i, "description", e.target.value)}
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="field"
                  style={{ border: "none", background: "transparent", textAlign: "center", padding: "6px 4px" }}
                  type="number"
                  value={it.quantity}
                  onChange={e => updateItem(listName, i, "quantity", Number(e.target.value))}
                />
              </td>
              <td style={{ padding: 4 }}>
                <select
                  className="field"
                  style={{ border: "none", background: "transparent", padding: "6px 4px" }}
                  value={it.unit}
                  onChange={e => updateItem(listName, i, "unit", e.target.value)}
                >
                  <option value="buc">buc</option>
                  <option value="ore">ore</option>
                  <option value="luni">luni</option>
                  <option value="pag">pag</option>
                </select>
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="field"
                  style={{ border: "none", background: "transparent", textAlign: "right", padding: "6px 8px", fontFamily: "var(--font-mono)" }}
                  type="number"
                  value={it.unit_price}
                  onChange={e => updateItem(listName, i, "unit_price", Number(e.target.value))}
                />
              </td>
              <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--tx-1)", fontSize: 13 }}>
                {it.total.toLocaleString()} lei
              </td>
              <td style={{ padding: 4, textAlign: "center" }}>
                <button className="btn btn-ghost" style={{ padding: 4, color: "var(--tx-4)" }} onClick={() => removeItem(listName, i)}>
                  <X size={12} />
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 20, color: "var(--tx-4)", fontStyle: "italic" }}>
                Nu ai adăugat servicii
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
