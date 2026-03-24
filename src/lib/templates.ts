// ─────────────────────────────────────────────────────────────────────────────
// Template-uri contracte — GENERICE, fără conținut specific proiectului.
//
// Variabile auto-completate (din setări + formular):
//   {{AUTOR_NUME}} {{AUTOR_CNP}} {{AUTOR_ADRESA}} {{AUTOR_EMAIL}}
//   {{AUTOR_IBAN}} {{AUTOR_BANCA}}
//   {{CESIONAR_NUME}} {{CESIONAR_DETALII}}
//   {{CONTRACT_NR}} {{DATA}} {{VALOARE}}
//   {{TRANSE_TABLE}}     ← tabel HTML generat din configurarea tranșelor
//   {{TERMEN_PLATA}}     ← nr. zile termen plată
//   {{PREAVIZ}}          ← nr. zile preaviz reziliere
//   {{EXCLUSIVITATE}}    ← "exclusiv" sau "neexclusiv"
//   {{RESPONSABIL_TAXE}} ← clauza fiscală DDA/PFA
//
// Variabile rămase ca {{PLACEHOLDER}} vizibil în editor (completate manual):
//   {{DESCRIERE_OPERA}}       ← titlul / scopul / obiectul proiectului
//   {{VALOARE_ABONAMENT}}     ← tariful lunar (cesiune_abonament)
//   {{LUNA_START_ABONAMENT}}  ← condiția de start abonament (cesiune_abonament)
// ─────────────────────────────────────────────────────────────────────────────

const W = `font-family:'Georgia','Times New Roman',serif;color:#1a1a1a;line-height:1.7;max-width:780px;margin:0 auto;font-size:14px;`;
const HDR = `text-align:center;margin-bottom:36px;padding-bottom:16px;border-bottom:3px double #333;`;
const H1  = `font-size:17px;font-weight:800;text-transform:uppercase;margin:0 0 4px;font-family:'Inter',sans-serif;letter-spacing:0.03em;`;
const SUB = `font-size:13px;color:#555;margin:2px 0 0;`;
const H2  = `font-size:12px;font-weight:700;border-bottom:2px solid #bbb;padding-bottom:5px;margin:0 0 11px;text-transform:uppercase;font-family:'Inter',sans-serif;letter-spacing:0.06em;`;
const SEC = `margin-bottom:24px;`;
const P   = `margin:7px 0;padding-left:14px;`;
const SIG = `display:flex;justify-content:space-between;margin-top:56px;padding-top:20px;border-top:2px solid #333;`;

export const TEMPLATE_HTML: Record<string, string> = {

  // ── 1. Cesiune drepturi autor (proiect unic) ─────────────────────────────
  cesiune: `
<div style="${W}">
  <div style="${HDR}">
    <h1 style="${H1}">Contract de Cesiune a Drepturilor Patrimoniale de Autor</h1>
    <p style="${SUB}">Nr. <strong>{{CONTRACT_NR}}</strong> &nbsp;·&nbsp; Data: <strong>{{DATA}}</strong></p>
  </div>

  <section style="${SEC}">
    <h2 style="${H2}">I. Părțile Contractante</h2>
    <p style="${P}"><strong>1. Cedentul (Autorul):</strong> <strong>{{AUTOR_NUME}}</strong>, domiciliat în {{AUTOR_ADRESA}}, CNP/CIF <strong>{{AUTOR_CNP}}</strong>, email: {{AUTOR_EMAIL}}, denumit în continuare <em>„CEDENTUL"</em>.</p>
    <p style="margin:8px 0;font-weight:600;text-align:center;color:#555;">și</p>
    <p style="${P}"><strong>2. Cesionarul (Beneficiarul):</strong> <strong>{{CESIONAR_NUME}}</strong>, {{CESIONAR_DETALII}}, denumit în continuare <em>„CESIONARUL"</em>.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">II. Obiectul Contractului</h2>
    <p style="${P}">2.1. Obiectul contractului îl constituie cesiunea drepturilor patrimoniale de autor, în mod <strong>{{EXCLUSIVITATE}}</strong>, asupra operei de creație intelectuală: <strong>{{DESCRIERE_OPERA}}</strong>.</p>
    <p style="${P}">2.2. Opera cuprinde toate elementele de creație intelectuală realizate în cadrul prezentului contract, inclusiv dar fără a se limita la: cod sursă, structuri de date, interfețe vizuale și documentație tehnică.</p>
    <p style="${P}">2.3. <strong>Drepturi morale:</strong> Cedentul își rezervă dreptul de a menționa opera în portofoliul personal, fără a dezvălui informații confidențiale ale Cesionarului.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">III. Remunerația și Modalitatea de Plată</h2>
    <p style="${P}">3.1. Cesionarul va plăti Cedentului suma totală brută de <strong>{{VALOARE}} RON</strong>, conform tranșelor de mai jos:</p>
    {{TRANSE_TABLE}}
    <p style="${P}">3.2. Plata se efectuează prin transfer bancar: <strong>{{AUTOR_IBAN}}</strong>, deschis la {{AUTOR_BANCA}}, în termen de <strong>{{TERMEN_PLATA}} zile</strong> de la scadența fiecărei tranșe.</p>
    <p style="${P}">3.3. <strong>Regim fiscal:</strong> {{RESPONSABIL_TAXE}}.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">IV. Proprietate Intelectuală și Confidențialitate</h2>
    <p style="${P}">4.1. Drepturile patrimoniale se transferă la data semnării Procesului-Verbal de Recepție și a achitării integrale a remunerației.</p>
    <p style="${P}">4.2. <strong>Confidențialitate:</strong> Cedentul se obligă să nu divulge terților informații tehnice sau comerciale ale Cesionarului, pe durata contractului și 3 ani după încetarea acestuia.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">V. Durata și Rezilierea</h2>
    <p style="${P}">5.1. Contractul intră în vigoare la data semnării și este valabil până la finalizarea, recepționarea operei și achitarea integrală a remunerației.</p>
    <p style="${P}">5.2. Oricare parte poate rezilia contractul cu minimum <strong>{{PREAVIZ}} zile</strong> calendaristice preaviz scris. Cedentul va factura proporțional munca efectuată până la data notificării.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">VI. Dispoziții Finale</h2>
    <p style="${P}">6.1. Contractul este guvernat de Legea nr. 8/1996 privind dreptul de autor și drepturile conexe.</p>
    <p style="${P}">6.2. Orice modificare se face prin act adițional semnat de ambele părți. Redactat în 2 exemplare originale.</p>
  </section>

  <div style="${SIG}">
    <div style="width:45%;">
      <p style="font-weight:700;margin-bottom:46px;text-transform:uppercase;font-size:12px;">Cedent (Autor)</p>
      <div style="border-bottom:1px solid #000;width:220px;margin-bottom:7px;"></div>
      <p style="font-size:13px;color:#333;">{{AUTOR_NUME}}</p>
    </div>
    <div style="width:45%;text-align:right;">
      <p style="font-weight:700;margin-bottom:46px;text-transform:uppercase;font-size:12px;">Cesionar (Beneficiar)</p>
      <div style="border-bottom:1px solid #000;width:220px;margin-left:auto;margin-bottom:7px;"></div>
      <p style="font-size:13px;color:#333;">{{CESIONAR_NUME}}</p>
    </div>
  </div>
</div>
`,

  // ── 2. Cesiune + Abonament (Faza I creare + Faza II adaptare continuă) ───
  cesiune_abonament: `
<div style="${W}">
  <div style="${HDR}">
    <h1 style="${H1}">Contract de Cesiune a Drepturilor Patrimoniale de Autor</h1>
    <p style="${SUB}">cu clauze de adaptare continuă a operei (Faza I + Faza II)</p>
    <p style="${SUB}">Nr. <strong>{{CONTRACT_NR}}</strong> &nbsp;·&nbsp; Data: <strong>{{DATA}}</strong></p>
  </div>

  <section style="${SEC}">
    <h2 style="${H2}">I. Părțile Contractante</h2>
    <p style="${P}"><strong>1. Cedentul (Autorul):</strong> <strong>{{AUTOR_NUME}}</strong>, domiciliat în {{AUTOR_ADRESA}}, CNP/CIF <strong>{{AUTOR_CNP}}</strong>, email: {{AUTOR_EMAIL}}, denumit în continuare <em>„CEDENTUL"</em>.</p>
    <p style="margin:8px 0;font-weight:600;text-align:center;color:#555;">și</p>
    <p style="${P}"><strong>2. Cesionarul (Beneficiarul):</strong> <strong>{{CESIONAR_NUME}}</strong>, {{CESIONAR_DETALII}}, denumit în continuare <em>„CESIONARUL"</em>.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">II. Obiectul Contractului</h2>
    <p style="${P}">Contractul se derulează în două faze distincte:</p>
    <p style="${P}"><strong>Faza I — Crearea operei:</strong> Cedentul se obligă să realizeze și să predea opera de creație intelectuală: <strong>{{DESCRIERE_OPERA}}</strong>.</p>
    <p style="${P}"><strong>Faza II — Adaptarea continuă a operei (abonament):</strong> Cedentul va presta lunar servicii de creație intelectuală constând în <em>actualizarea și adaptarea continuă a operei de creație intelectuală în vederea optimizării și îmbunătățirii continue a acesteia</em>.</p>
    <p style="${P}">2.3. Cedentul transmite Cesionarului, în mod <strong>{{EXCLUSIVITATE}}</strong>, drepturile patrimoniale de autor, cu reținerea drepturilor morale și a dreptului de referință în portofoliu profesional.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">III. Remunerația și Modalitatea de Plată</h2>
    <p style="${P}"><strong>Faza I — Remunerație pentru crearea operei:</strong> Valoarea totală brută este de <strong>{{VALOARE}} RON</strong>, achitată conform tranșelor de mai jos:</p>
    {{TRANSE_TABLE}}
    <p style="${P}"><strong>Faza II — Remunerație lunară:</strong> O remunerație de <strong>{{VALOARE_ABONAMENT}} RON</strong> (brut)/lună, facturată la data de 1 a fiecărei luni, începând cu <strong>{{LUNA_START_ABONAMENT}}</strong>.</p>
    <p style="${P}">Plata se efectuează prin transfer bancar: <strong>{{AUTOR_IBAN}}</strong>, deschis la {{AUTOR_BANCA}}, în termen de <strong>{{TERMEN_PLATA}} zile</strong> de la emiterea facturii.</p>
    <p style="${P}"><strong>Regim fiscal:</strong> {{RESPONSABIL_TAXE}}.</p>
    <p style="${P}">În caz de neplată mai mult de 15 zile de la scadență, Cedentul poate suspenda prestațiile din Faza II fără preaviz.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">IV. Proprietate Intelectuală și Confidențialitate</h2>
    <p style="${P}">4.1. Drepturile patrimoniale aferente Fazei I se transferă la semnarea PVR și plata integrală. Drepturile aferente Fazei II se transferă lunar, la achitarea remunerației corespunzătoare.</p>
    <p style="${P}">4.2. <strong>Confidențialitate:</strong> Cedentul se obligă să nu divulge terților informații tehnice sau comerciale ale Cesionarului, pe durata contractului și 3 ani după încetarea acestuia.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">V. Durata și Rezilierea</h2>
    <p style="${P}">5.1. Contractul intră în vigoare la data semnării și este valabil pe durată nedeterminată.</p>
    <p style="${P}">5.2. Faza I se încheie la semnarea Procesului-Verbal de Recepție finală și plata integrală a remunerației aferente.</p>
    <p style="${P}">5.3. Faza II (abonamentul) poate fi reziliată de oricare parte cu minimum <strong>{{PREAVIZ}} zile</strong> calendaristice preaviz scris. Serviciile și plățile continuă pe durata preavizului.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">VI. Dispoziții Finale</h2>
    <p style="${P}">6.1. Contractul este guvernat de Legea nr. 8/1996 privind dreptul de autor și drepturile conexe și Codul Fiscal.</p>
    <p style="${P}">6.2. Orice modificare se face prin act adițional semnat de ambele părți. Redactat în 2 exemplare originale.</p>
  </section>

  <div style="${SIG}">
    <div style="width:45%;">
      <p style="font-weight:700;margin-bottom:46px;text-transform:uppercase;font-size:12px;">Cedent (Autor)</p>
      <div style="border-bottom:1px solid #000;width:220px;margin-bottom:7px;"></div>
      <p style="font-size:13px;color:#333;">{{AUTOR_NUME}}</p>
    </div>
    <div style="width:45%;text-align:right;">
      <p style="font-weight:700;margin-bottom:46px;text-transform:uppercase;font-size:12px;">Cesionar (Beneficiar)</p>
      <div style="border-bottom:1px solid #000;width:220px;margin-left:auto;margin-bottom:7px;"></div>
      <p style="font-size:13px;color:#333;">{{CESIONAR_NUME}}</p>
    </div>
  </div>
</div>
`,

  // ── 3. Prestări Servicii ─────────────────────────────────────────────────
  prestari: `
<div style="${W}">
  <div style="${HDR}">
    <h1 style="${H1}">Contract de Prestări Servicii</h1>
    <p style="${SUB}">Nr. <strong>{{CONTRACT_NR}}</strong> &nbsp;·&nbsp; Data: <strong>{{DATA}}</strong></p>
  </div>

  <section style="${SEC}">
    <h2 style="${H2}">I. Părțile Contractante</h2>
    <p style="${P}"><strong>1. Prestatorul:</strong> <strong>{{AUTOR_NUME}}</strong>, cu sediul/domiciliul în {{AUTOR_ADRESA}}, CIF/CNP <strong>{{AUTOR_CNP}}</strong>, email: {{AUTOR_EMAIL}}, denumit în continuare <em>„PRESTATORUL"</em>.</p>
    <p style="margin:8px 0;font-weight:600;text-align:center;color:#555;">și</p>
    <p style="${P}"><strong>2. Beneficiarul:</strong> <strong>{{CESIONAR_NUME}}</strong>, {{CESIONAR_DETALII}}, denumit în continuare <em>„BENEFICIARUL"</em>.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">II. Obiectul și Livrabilele</h2>
    <p style="${P}">2.1. Prestatorul se obligă să presteze: <strong>{{DESCRIERE_OPERA}}</strong>.</p>
    <p style="${P}">2.2. Livrabilele vor fi transmise conform specificațiilor agreate de comun acord și consemnate în Procesul-Verbal de Recepție.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">III. Prețul și Condițiile de Plată</h2>
    <p style="${P}">3.1. Valoarea totală a serviciilor este de <strong>{{VALOARE}} RON</strong>, achitată conform tranșelor de mai jos:</p>
    {{TRANSE_TABLE}}
    <p style="${P}">3.2. Plata se efectuează prin transfer bancar: <strong>{{AUTOR_IBAN}}</strong>, deschis la {{AUTOR_BANCA}}, în termen de <strong>{{TERMEN_PLATA}} zile</strong> de la emiterea facturii.</p>
    <p style="${P}">3.3. <strong>Regim fiscal:</strong> {{RESPONSABIL_TAXE}}.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">IV. Proprietatea Intelectuală</h2>
    <p style="${P}">4.1. La finalizarea și plata integrală, drepturile patrimoniale de autor asupra livrabilelor se transferă în mod <strong>{{EXCLUSIVITATE}}</strong> Beneficiarului.</p>
    <p style="${P}">4.2. Prestatorul poate include referința la proiect în portofoliul personal, fără a dezvălui date confidențiale.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">V. Confidențialitate</h2>
    <p style="${P}">5.1. Prestatorul se obligă să nu divulge terților informații despre activitatea sau datele Beneficiarului, pe durata contractului și 3 ani după încetarea acestuia.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">VI. Durata și Rezilierea</h2>
    <p style="${P}">6.1. Contractul intră în vigoare la data semnării și este valabil până la finalizarea livrabilelor și achitarea integrală.</p>
    <p style="${P}">6.2. Oricare parte poate rezilia cu minimum <strong>{{PREAVIZ}} zile</strong> calendaristice preaviz scris. Prestatorul va factura proporțional munca efectuată.</p>
  </section>

  <section style="${SEC}">
    <h2 style="${H2}">VII. Dispoziții Finale</h2>
    <p style="${P}">7.1. Orice modificare se face prin act adițional semnat de ambele părți. Redactat în 2 exemplare originale.</p>
  </section>

  <div style="${SIG}">
    <div style="width:45%;">
      <p style="font-weight:700;margin-bottom:46px;text-transform:uppercase;font-size:12px;">Prestator</p>
      <div style="border-bottom:1px solid #000;width:220px;margin-bottom:7px;"></div>
      <p style="font-size:13px;color:#333;">{{AUTOR_NUME}}</p>
    </div>
    <div style="width:45%;text-align:right;">
      <p style="font-weight:700;margin-bottom:46px;text-transform:uppercase;font-size:12px;">Beneficiar</p>
      <div style="border-bottom:1px solid #000;width:220px;margin-left:auto;margin-bottom:7px;"></div>
      <p style="font-size:13px;color:#333;">{{CESIONAR_NUME}}</p>
    </div>
  </div>
</div>
`,
};

// ── Generează tabelul HTML al tranșelor ─────────────────────────────────────
export function generateTranseTable(
  amount: number,
  transe: { label: string; procent: number }[],
): string {
  const totalProcent = transe.reduce((s, t) => s + t.procent, 0);
  const rows = transe
    .map((t, i) => {
      const val = amount > 0 ? (amount * t.procent) / 100 : 0;
      const valStr = amount > 0
        ? val.toLocaleString("ro-RO", { minimumFractionDigits: 2 }) + " RON"
        : "— RON";
      return `<tr style="border-bottom:1px solid #e0e0e0;">
        <td style="padding:7px 10px;font-size:13px;">${i + 1}. ${t.label}</td>
        <td style="text-align:right;padding:7px 10px;font-size:13px;font-weight:700;">${valStr} (${t.procent}%)</td>
      </tr>`;
    })
    .join("");

  const warning =
    totalProcent !== 100
      ? `<tr><td colspan="2" style="font-size:11px;color:#dc2626;padding:4px 10px;">⚠ Total tranșe: ${totalProcent}% — suma trebuie să fie 100%</td></tr>`
      : "";

  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px;">
    <thead>
      <tr style="border-bottom:2px solid #999;">
        <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:'Inter',sans-serif;">Condiție de plată / Tranșă</th>
        <th style="text-align:right;padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:'Inter',sans-serif;">Valoare</th>
      </tr>
    </thead>
    <tbody>${rows}${warning}</tbody>
  </table>`;
}

// ── Substituie variabilele {{VAR}} în HTML ───────────────────────────────────
export function substituteVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
