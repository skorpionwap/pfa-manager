export const TEMPLATE_HTML = {
  cesiune: `
<div style="font-family: 'Inter', sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="font-size: 24px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">Contract de Cesiune a Drepturilor Patrimoniale de Autor</h1>
    <p style="color: #666; font-size: 14px;">Nr. <strong>{{CONTRACT_NR}}</strong> &nbsp;·&nbsp; Data: <strong>{{DATA}}</strong></p>
  </div>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">I. Părțile Contractante</h2>
    <p><strong>1. Cedentul (Autorul):</strong> <strong>{{AUTOR_NUME}}</strong>, domiciliat în {{AUTOR_ADRESA}}, CNP/CIF <strong>{{AUTOR_CNP}}</strong>, email: {{AUTOR_EMAIL}}, denumit în continuare „CEDENTUL”.</p>
    <p style="margin: 10px 0; font-weight: 600; text-align: center;">și</p>
    <p><strong>2. Cesionarul (Beneficiarul):</strong> <strong>{{CESIONAR_NUME}}</strong>, {{CESIONAR_DETALII}}, denumit în continuare „CESIONARUL”.</p>
  </section>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">II. Obiectul Contractului</h2>
    <p>2.1. Cedentul transmite Cesionarului, în mod exclusiv și nelimitat, drepturile patrimoniale de autor asupra Operei software: <strong>{{DESCRIERE_SCURTA}}</strong>.</p>
    <p>2.2. Opera include, fără a se limita la: cod sursă (source code), executabile (object code), structuri de baze de date, interfețe grafice (UI/UX) și documentația tehnică aferentă.</p>
  </section>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">III. Remunerația și Modalitatea de Plată</h2>
    <p>3.1. Pentru cesiunea drepturilor prevăzute în prezentul contract, Cesionarul va plăti Cedentului suma de <strong>{{VALOARE}} RON</strong> (sumă brută).</p>
    <p>3.2. Plata se va efectua prin transfer bancar în contul Cedentului: <strong>{{AUTOR_IBAN}}</strong>, deschis la {{AUTOR_BANCA}}.</p>
    <p>3.3. <strong>Regim Fiscal:</strong> {{RESPONSABIL_TAXE}}.</p>
  </section>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">IV. Proprietate Intelectuală și Confidențialitate</h2>
    <p>4.1. <strong>Transfer Direct:</strong> Drepturile patrimoniale se transferă definitiv la momentul predării Operei către Cesionar.</p>
    <p>4.2. <strong>Confidențialitate:</strong> Ambele părți se obligă să păstreze confidențialitatea informațiilor tehnice și comerciale partajate pe parcursul colaborării.</p>
  </section>

  <div style="display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee;">
    <div style="width: 45%;">
      <p style="font-weight: 700; margin-bottom: 40px;">CEDENT (AUTOR)</p>
      <div style="border-bottom: 1px solid #000; width: 200px; margin-bottom: 8px;"></div>
      <p style="font-size: 12px;">{{AUTOR_NUME}}</p>
    </div>
    <div style="width: 45%; text-align: right;">
      <p style="font-weight: 700; margin-bottom: 40px;">CESIONAR (BENEFICIAR)</p>
      <div style="border-bottom: 1px solid #000; width: 200px; margin-left: auto; margin-bottom: 8px;"></div>
      <p style="font-size: 12px;">{{CESIONAR_NUME}}</p>
    </div>
  </div>
</div>
`,

  prestari: `
<div style="font-family: 'Inter', sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="font-size: 24px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">Contract de Prestări Servicii IT</h1>
    <p style="color: #666; font-size: 14px;">Nr. <strong>{{CONTRACT_NR}}</strong> &nbsp;·&nbsp; Data: <strong>{{DATA}}</strong></p>
  </div>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">I. Părțile Contractante</h2>
    <p><strong>1. Prestatorul:</strong> <strong>{{AUTOR_NUME}}</strong>, PFA/II, sediu în {{AUTOR_ADRESA}}, CIF <strong>{{AUTOR_CNP}}</strong>, denumit în continuare „PRESTATORUL”.</p>
    <p style="margin: 10px 0; font-weight: 600; text-align: center;">și</p>
    <p><strong>2. Beneficiarul:</strong> <strong>{{CESIONAR_NUME}}</strong>, {{CESIONAR_DETALII}}, denumit în continuare „BENEFICIARUL”.</p>
  </section>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">II. Obiectul și Livrabilele</h2>
    <p>2.1. Prestatorul se obligă să presteze servicii de: <strong>{{DESCRIERE_SCURTA}}</strong>.</p>
    <p>2.2. Livrabilele vor fi transmise electronic, prin sisteme de versionare cod (Git) sau arhive securizate.</p>
  </section>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">III. Clauze de Confidențialitate (NDA)</h2>
    <p>3.1. Prestatorul se obligă să nu divulge informații referitoare la arhitectura sistemelor, datele utilizatorilor sau strategiile comerciale ale Beneficiarului.</p>
  </section>

  <section style="margin-bottom: 24px;">
    <h2 style="font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase;">IV. Preț și Condiții de Plată</h2>
    <p>4.1. Valoarea serviciilor este de <strong>{{VALOARE}} RON</strong>.</p>
    <p>4.2. Plata se efectuează în baza facturii fiscale emise de Prestator, în termen de 15 zile calendaristice.</p>
    <p>4.3. Cont IBAN: <strong>{{AUTOR_IBAN}}</strong>, deschis la {{AUTOR_BANCA}}.</p>
  </section>

  <div style="display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee;">
    <div style="width: 45%;">
      <p style="font-weight: 700; margin-bottom: 40px;">PRESTATOR</p>
      <div style="border-bottom: 1px solid #000; width: 200px; margin-bottom: 8px;"></div>
      <p style="font-size: 12px;">{{AUTOR_NUME}}</p>
    </div>
    <div style="width: 45%; text-align: right;">
      <p style="font-weight: 700; margin-bottom: 40px;">BENEFICIAR</p>
      <div style="border-bottom: 1px solid #000; width: 200px; margin-left: auto; margin-bottom: 8px;"></div>
      <p style="font-size: 12px;">{{CESIONAR_NUME}}</p>
    </div>
  </div>
</div>
`
};

export function substituteVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
