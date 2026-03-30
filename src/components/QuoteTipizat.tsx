import type { Quote, Client, Settings } from "@/types";

interface QuoteTipizatProps {
  quote: Quote;
  client?: Client;
  settings: Settings;
}

export default function QuoteTipizat({ quote, client, settings }: QuoteTipizatProps) {
  const an1 = quote.total + (quote.has_subscription ? quote.subscription_price * 12 : 0);

  return (
    <div style={{ color: "black", fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 60 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "-0.04em" }}>
            Ofertă Comercială
          </h1>
          <p style={{ color: "#666", fontSize: 12, margin: "4px 0 0" }}>
            Nr. înregistrare: <strong>{quote.number}</strong> / Data: {quote.created_at.slice(0, 10)}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase" }}>Valabilitate ofertă</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{quote.valid_until || "—"}</div>
        </div>
      </div>

      {/* Parties */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, marginBottom: 60 }}>
        <div>
          <h4 style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 6 }}>
            De la (Prestator)
          </h4>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{settings.my_name}</div>
          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
            CIF: {settings.my_cif}<br />
            {settings.my_address}<br />
            {settings.my_email} · {settings.my_phone}
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 6 }}>
            Pregătit pentru (Beneficiar)
          </h4>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{client?.name}</div>
          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
            {client?.address || "—"}<br />
            CIF: {client?.cif || "—"}
          </div>
        </div>
      </div>

      {/* Project Overview */}
      <div style={{ background: "#f8f9fa", padding: 24, borderRadius: 8, marginBottom: 40, borderLeft: "4px solid #000" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{quote.title || "Proiect Digital"}</h2>
        <p style={{ margin: "4px 0 0", color: "#666" }}>
          Pachet: {quote.project_type} / {quote.page_count} pagini estimate / Termen livrare: {quote.delivery_days} zile
        </p>
      </div>

      {/* Services Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
        <thead>
          <tr style={{ background: "#000", color: "white" }}>
            <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, textTransform: "uppercase" }}>
              Descriere Servicii Dezvoltare
            </th>
            <th style={{ width: 100, textAlign: "right", padding: "12px 16px", fontSize: 11, textTransform: "uppercase" }}>
              Total (RON)
            </th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "16px", fontSize: 14 }}>
                <div style={{ fontWeight: 600 }}>{it.description}</div>
              </td>
              <td style={{ padding: "16px", textAlign: "right", fontWeight: 700 }}>
                {it.total.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 60 }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#666" }}>
            <span>Subtotal proiect:</span>
            <span>{quote.subtotal.toLocaleString()} RON</span>
          </div>
          {quote.discount_percent > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#00a651" }}>
              <span>Discount ({quote.discount_percent}%):</span>
              <span>-{quote.discount_amount.toLocaleString()} RON</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "2px solid #000", fontWeight: 800, fontSize: 18, marginTop: 4 }}>
            <span>TOTAL PROIECT:</span>
            <span>{quote.total.toLocaleString()} RON</span>
          </div>
          <p style={{ fontSize: 10, color: "#999", textAlign: "right", margin: "4px 0 0" }}>
            Scutit de TVA conform art. 310 Cod Fiscal
          </p>
        </div>
      </div>

      {/* Subscription */}
      {quote.has_subscription && (
        <div style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #eee", paddingBottom: 8, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, textTransform: "uppercase" }}>
              2. Mentenanță și Suport (Abonament Lunar)
            </h3>
            <span style={{ fontSize: 11, color: "#666" }}>
              Începând cu: <strong>{quote.subscription_start_date}</strong>
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {quote.subscription_items.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px dashed #eee" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{it.description}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>
                    {it.total.toLocaleString()} RON / lună
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#fcfcfc" }}>
                <td style={{ padding: "16px", fontWeight: 800 }}>TOTAL ABONAMENT LUNAR</td>
                <td style={{ padding: "16px", textAlign: "right", fontWeight: 800, fontSize: 16 }}>
                  {quote.subscription_price.toLocaleString()} RON / lună
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
            Angajament minim contractat: {quote.subscription_months} luni.
          </p>
        </div>
      )}

      {/* Year 1 Summary */}
      <div style={{ padding: "20px 30px", border: "3px solid #000", borderRadius: 8, background: "#fcfcfc", marginBottom: 60, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase" }}>
            Total investiție estimată per Anul 1
          </div>
          <div style={{ fontSize: 12, color: "#999" }}>
            (Dezvoltare + {quote.subscription_months} luni mentenanță)
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 900 }}>{an1.toLocaleString()} RON</div>
      </div>

      {/* Notes */}
      {quote.notes && (
        <div style={{ marginBottom: 60 }}>
          <h4 style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Note și Condiții Contractuale
          </h4>
          <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#444" }}>{quote.notes}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 100 }}>
        <div style={{ width: 220 }}>
          <div style={{ borderTop: "1px solid #000", marginTop: 40, paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{settings.my_name}</div>
            <div style={{ fontSize: 10, color: "#999" }}>Prestator</div>
          </div>
        </div>
        <div style={{ width: 220 }}>
          <div style={{ borderTop: "1px solid #000", marginTop: 40, paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{client?.name}</div>
            <div style={{ fontSize: 10, color: "#999" }}>Beneficiar (Semnătură accept)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
