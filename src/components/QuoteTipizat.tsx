import type { Quote, Client, Settings } from "@/types";

interface QuoteTipizatProps {
  quote: Quote;
  client?: Client;
  settings: Settings;
}

const DEFAULT_TERMS = [
  { title: "Facturare și Plată", text: "Se va emite o factură de avans (ex: 30-50%) la semnarea contractului, restul urmând a fi facturat conform tranșelor agreate la predarea proiectului." },
  { title: "Termen de valabilitate", text: "Condițiile financiare din prezenta ofertă sunt valabile până la data de {valid_until}." },
  { title: "Drepturi de autor", text: "Drepturile patrimoniale de autor asupra codului și design-ului se vor transfera exclusiv Beneficiarului după achitarea integrală a proiectului, conform Legii 8/1996." },
  { title: "Acceptanță", text: "Semnarea acestei oferte ține loc de acceptare de principiu și declanșează redactarea contractului final." },
];

function parseTerms(raw: string, validUntil: string): { title: string; text: string }[] {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed = lines.map(line => {
    const m = line.match(/^\[(.+?)\]\s*(.+)/);
    if (!m) return null;
    return { title: m[1], text: m[2].replace(/\{valid_until\}/g, validUntil || "scadență") };
  }).filter((x): x is { title: string; text: string } => x !== null);
  return parsed.length > 0 ? parsed : DEFAULT_TERMS.map(t => ({ ...t, text: t.text.replace(/\{valid_until\}/g, validUntil || "scadență") }));
}

export default function QuoteTipizat({ quote, client, settings }: QuoteTipizatProps) {
  const validItems = (quote.items || []).filter(it => it.description && it.total > 0);
  const validSubItems = (quote.subscription_items || []).filter(it => it.description && it.total > 0);
  const hasSubscription = !!quote.has_subscription && validSubItems.length > 0;
  const an1 = quote.total + (hasSubscription ? quote.subscription_price * 12 : 0);
  const terms = quote.terms
    ? parseTerms(quote.terms, quote.valid_until || "")
    : DEFAULT_TERMS.map(t => ({ ...t, text: t.text.replace(/\{valid_until\}/g, quote.valid_until || "scadență") }));

  return (
    <div style={{ color: "#111", fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: 1.5, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
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
      <div style={{ background: "#f8f9fa", padding: "20px 24px", borderRadius: 12, marginBottom: 40, borderLeft: "4px solid var(--ac)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111" }}>{quote.title || "Proiect Digital"}</h2>
          <p style={{ margin: "6px 0 0", color: "#666", fontSize: 13, fontWeight: 500 }}>
            Pachet specific: <strong style={{ color: "#333" }}>{quote.project_type}</strong> / Pagini estimate: {quote.page_count}
          </p>
        </div>
        <div style={{ textAlign: "right", background: "#fff", padding: "8px 16px", borderRadius: 8, border: "1px solid #eee" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, color: "#999", marginBottom: 2 }}>Termen Livrare</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ac)" }}>{quote.delivery_days} zile lucrătoare</div>
        </div>
      </div>

      {/* Services Table - only if there are valid items */}
      {validItems.length > 0 && (
      <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid #eee", marginBottom: 30 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8f9fa", color: "#555", borderBottom: "1px solid #eaeaea" }}>
            <th style={{ textAlign: "left", padding: "14px 20px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800 }}>
              Pachet / Servicii Dezvoltare
            </th>
            <th style={{ width: 120, textAlign: "right", padding: "14px 20px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800 }}>
              Total (RON)
            </th>
          </tr>
        </thead>
        <tbody>
          {validItems.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "20px", fontSize: 14 }}>
                <div style={{ fontWeight: 700, whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#111" }}>{it.description}</div>
                {it.features && it.features.length > 0 && (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                    {it.features.map((feat, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>{feat}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td style={{ padding: "20px", textAlign: "right", fontWeight: 800, verticalAlign: "top", color: "#111", fontSize: 14 }}>
                {it.total.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      )}

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 60 }}>
        <div style={{ width: 280 }}>
          {quote.discount_percent > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#666" }}>
                <span>Subtotal proiect:</span>
                <span>{quote.subtotal.toLocaleString()} RON</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "var(--ac)" }}>
                <span>Discount aplicat ({quote.discount_percent}%):</span>
                <span style={{ fontWeight: 700 }}>-{quote.discount_amount.toLocaleString()} RON</span>
              </div>
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderTop: "2px solid #111", fontWeight: 800, fontSize: 18, marginTop: 4, alignItems: "center" }}>
            <span>TOTAL PROIECT</span>
            <span style={{ fontSize: 24 }}>{quote.total.toLocaleString()} <span style={{ fontSize: 14, color: "#666" }}>RON</span></span>
          </div>
          <p style={{ fontSize: 10, color: "#999", textAlign: "right", margin: "0" }}>
            Scutit de TVA conform art. 310 Cod Fiscal
          </p>
        </div>
      </div>

      {/* Subscription */}
      {hasSubscription && (
        <div style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #eaeaea", paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111" }}>
                2. Mentenanță și Suport Continuu
              </h3>
              <div style={{ fontSize: 11, color: "var(--ac)", fontWeight: 700, textTransform: "uppercase", marginTop: 4, letterSpacing: "0.05em" }}>Abonament Lunar Recomandat</div>
            </div>
            <span style={{ fontSize: 12, color: "#666", fontWeight: 500, background: "#f8f9fa", padding: "4px 10px", borderRadius: 6 }}>
              Începând cu data lansării: <strong style={{ color: "#111" }}>{quote.subscription_start_date}</strong>
            </span>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #eee", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {validSubItems.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "16px 20px", fontSize: 13 }}>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontWeight: 700, color: "#111" }}>{it.description}</div>
                    {it.features && it.features.length > 0 && (
                      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                        {it.features.map((feat, idx) => (
                          <li key={idx} style={{ marginBottom: 3 }}>{feat}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right", fontWeight: 700, verticalAlign: "top", color: "#111" }}>
                    {it.total.toLocaleString()} RON / lună
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#f8f9fa" }}>
                <td style={{ padding: "16px 20px", fontWeight: 800, color: "#111" }}>TOTAL ABONAMENT LUNAR</td>
                <td style={{ padding: "16px 20px", textAlign: "right", fontWeight: 800, fontSize: 16, color: "var(--ac)" }}>
                  {quote.subscription_price.toLocaleString()} RON / lună
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <p style={{ fontSize: 11, color: "#888", marginTop: 12, textAlign: "right" }}>
            * Angajament minim contractat pentru resurse: {quote.subscription_months} luni.
          </p>
        </div>
      )}

      {/* Year 1 Summary - only show if there's an active subscription */}
      {hasSubscription && an1 > 0 && (
      <div style={{ padding: "24px 30px", border: "1px solid #eaeaea", borderRadius: 16, background: "linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", marginBottom: 60, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#111", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total buget estimat per Anul 1
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4, fontWeight: 500 }}>
            (Dezvoltare{hasSubscription ? ` + ${quote.subscription_months} luni mentenanță garantată` : ""})
          </div>
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: "var(--ac)" }}>{an1.toLocaleString()} <span style={{ fontSize: 16, color: "#111" }}>RON</span></div>
      </div>
      )}

      {/* Commercial Terms */}
      <div style={{ marginBottom: 40, pageBreakInside: "avoid" }}>
        <h4 style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 6 }}>
          Termeni Comerciali și de Achiziție
        </h4>
        <div style={{ fontSize: 11, lineHeight: 1.6, color: "#555", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
          <div>
            {terms.filter((_, i) => i % 2 === 0).map((term, i) => (
              <p key={i} style={{ margin: "0 0 8px" }}><strong>{i * 2 + 1}. {term.title}:</strong> {term.text}</p>
            ))}
          </div>
          <div>
            {terms.filter((_, i) => i % 2 === 1).map((term, i) => (
              <p key={i} style={{ margin: "0 0 8px" }}><strong>{i * 2 + 2}. {term.title}:</strong> {term.text}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      {quote.notes && (
        <div style={{ marginBottom: 60, pageBreakInside: "avoid" }}>
          <h4 style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Note și Condiții Specifice
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
            <div style={{ fontSize: 10, color: "#999" }}>Prin {client?.legal_representative || "Reprezentant legal"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
