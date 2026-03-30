import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    if (!isTauri()) throw new Error("Not running inside Tauri");
    db = await Database.load("sqlite:pfa.db");
    await initSchema(db);
  }
  return db;
}

async function initSchema(db: Database) {
  // Enable FK enforcement — SQLite has it OFF by default
  await db.execute("PRAGMA foreign_keys = ON");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cif TEXT DEFAULT '',
      address TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      contact_person TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL,
      contract_id INTEGER,
      date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '[]',
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      category TEXT DEFAULT '',
      is_signed INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    );
  `);

  // Simple migration for existing databases
  try { await db.execute("ALTER TABLE invoices ADD COLUMN contract_id INTEGER"); } catch(e) {}
  try { await db.execute("ALTER TABLE invoices ADD COLUMN category TEXT DEFAULT ''"); } catch(e) {}
  try { await db.execute("ALTER TABLE invoices ADD COLUMN is_signed INTEGER DEFAULT 0"); } catch(e) {}
  try { await db.execute("ALTER TABLE contracts ADD COLUMN source TEXT DEFAULT 'mine'"); } catch(e) {}
  try { await db.execute("ALTER TABLE contracts ADD COLUMN file_path TEXT DEFAULT ''"); } catch(e) {}
  try { await db.execute("ALTER TABLE invoices ADD COLUMN source TEXT DEFAULT 'mine'"); } catch(e) {}
  try { await db.execute("ALTER TABLE invoices ADD COLUMN file_path TEXT DEFAULT ''"); } catch(e) {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      type TEXT NOT NULL DEFAULT 'cesiune',
      number TEXT DEFAULT '',
      date TEXT NOT NULL,
      description TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'activ',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT 'generic',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Catalog servicii reutilizabile ──────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS service_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'general',
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      default_price REAL DEFAULT 0,
      unit TEXT DEFAULT 'buc',
      is_recurring INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(category, name)
    );
  `);

  // ── Oferte ──────────────────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      project_type TEXT DEFAULT 'site_prezentare',
      page_count INTEGER DEFAULT 0,
      items TEXT NOT NULL DEFAULT '[]',
      subscription_items TEXT DEFAULT '[]',
      subscription_price REAL DEFAULT 0,
      subscription_months INTEGER DEFAULT 12,
      subscription_start_date TEXT DEFAULT '',
      has_subscription INTEGER DEFAULT 0,
      subtotal REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      delivery_days INTEGER DEFAULT 30,
      valid_until TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );
  `);

  // Default settings
  await db.execute(`
    INSERT OR IGNORE INTO settings(key, value) VALUES
      ('operating_mode', 'dda'),
      ('invoice_series', 'FA'),
      ('invoice_counter', '1'),
      ('quote_series', 'OF'),
      ('quote_counter', '1')
  `);

  // ── Seed catalog servicii (prima rulare) ─────────────────────────────────────
  // Curățăm duplicatele existente (dacă există) înainte de seed
  await db.execute(`
    DELETE FROM service_catalog 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM service_catalog 
      GROUP BY category, name
    )
  `);
  
  const catalogCount = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM service_catalog');
  if (catalogCount[0]?.cnt === 0) {
    const seedServices = [
      // ═══════════════════════════════════════════════════════════════════════
      // ASPECT & IDENTITATE VIZUALĂ
      // ═══════════════════════════════════════════════════════════════════════
      [
        'Aspect & Identitate Vizuală',
        'Wireframe-uri & structură pagini',
        'Primești structura clară a site-ului, ca un "schelet" al tuturor paginilor. Include:\n• Wireframe-uri pentru homepage și toate paginile principale\n• Amplasarea elementelor (header, conținut, sidebar, footer)\n• Fluxul de navigare între pagini\n• 2 runde de revizuiri până la varianta finală\nLivrabile: Fișiere PDF cu wireframe-uri pentru fiecare pagină + schiță flux navigare.',
        300, 'proiect', 0, 1
      ],
      [
        'Aspect & Identitate Vizuală',
        'Design UI/UX complet al interfeței',
        'Transform structura în design vizual profesional. Include:\n• Design pentru toate paginile site-ului (în funcție de pachetul ales)\n• Paleta de culori personalizată pe brandul tău\n• Tipografie (fonturi) aleasă pentru lizibilitate maximă\n• Elemente grafice (butoane, iconițe, carduri)\n• Varianta pentru desktop + mobil (responsive)\n• 3 runde de revizuiri incluse\nLivrabile: Fișiere Figma cu design-ul final + ghid de stil (culori, fonturi, componente).',
        1200, 'proiect', 0, 2
      ],
      [
        'Aspect & Identitate Vizuală',
        'Prototip interactiv (clickabil)',
        'Poți "naviga" prin site înainte să fie construit. Include:\n• Toate paginile conectate între ele prin link-uri\n• Simulare interacțiuni (click butoane, meniuri dropdown, formulare)\n• Experiența reală de navigare pe desktop și mobil\n• Util pentru testarea fluxului înainte de dezvoltare\nLivrabile: Link către prototipul online + instrucțiuni de testare.',
        500, 'proiect', 0, 3
      ],
      [
        'Aspect & Identitate Vizuală',
        'Kit identitate vizuală digitală',
        'Elementele grafice de bază pentru prezența ta online. Include:\n• 3 propuneri de logo (variante inițiale)\n• 2 runde de revizuiri pentru logo-ul ales\n• Paleta de culori (coduri HEX, RGB, CMYK)\n• Fonturi recomandate pentru site și materiale\n• Variante logo: principal, secundar, favicon\n• Ghid rapid de utilizare\nLivrabile: Fișiere logo (PNG transparent, SVG, AI) + ghid identitate (PDF).',
        800, 'proiect', 0, 4
      ],
      // ═══════════════════════════════════════════════════════════════════════
      // CONSTRUIREA SITE-ULUI / APLICAȚIEI
      // ═══════════════════════════════════════════════════════════════════════
      [
        'Construirea Site-ului / Aplicației',
        'Site de prezentare (1-15 pagini)',
        'Site complet pentru afacerea ta, optimizat pentru toate dispozitivele. Include:\n• 1-15 pagini (homepage + pagini interne, în funcție de nevoi)\n• Design responsive (arată perfect pe telefon, tabletă, desktop)\n• Formular de contact funcțional\n• Integrare Google Maps (dacă e cazul)\n• Link-uri către social media\n• Optimizare SEO de bază (titluri, descrieri, meta tag-uri)\n• Viteză încărcare optimizată\n• 2 runde de modificări după lansare\nLivrabile: Site funcțional pe domeniul tău + acces panou administrare + ghid utilizare.\nDurată estimată: 5-10 zile lucrătoare.',
        2500, 'proiect', 0, 10
      ],
      [
        'Construirea Site-ului / Aplicației',
        'Magazin online (E-commerce)',
        'Platformă completă de vânzări online. Include:\n• Catalog produse cu categorii și filtre\n• Pagina detaliată produs (imagini, descriere, recenzii)\n• Coș de cumpărături și checkout în 2 pași\n• Integrare procesator plăți (Stripe, PayU, mobilPay)\n• Generare automată facturi (opțional)\n• Panou administrare: adaugă/editează produse, vezi comenzi\n• Notificări email pentru comenzi noi\n• Integrare curier (Fan Courier, Sameday, etc.)\n• 1 oră de training pentru administrare\nLivrabile: Magazin online funcțional + documentație administrare + suport 7 zile.\nDurată estimată: 15-25 zile lucrătoare.',
        6000, 'proiect', 0, 12
      ],
      [
        'Construirea Site-ului / Aplicației',
        'Aplicație web personalizată',
        'Soluție software complexă, dezvoltată de la zero pentru nevoile tale. Include:\n• Analiză detaliată a cerințelor și fluxurilor de lucru\n• Arhitectură personalizată (bază de date, backend, frontend)\n• Funcționalități custom (rapoarte, automatizări, integrări API)\n• Panou administrare cu roluri și permisiuni\n• Testare completă (funcțională, performanță, securitate)\n• Documentație tehnică și ghid utilizator\n• 2 săptămâni suport post-lansare\nLivrabile: Aplicație web funcțională + cod sursă + documentație completă.\nDurată estimată: 4-8 săptămâni (în funcție de complexitate).',
        8000, 'proiect', 0, 13
      ],
      // ═══════════════════════════════════════════════════════════════════════
      // FUNCȚIONALITĂȚI & INTEGRĂRI
      // ═══════════════════════════════════════════════════════════════════════
      [
        'Funcționalități & Integrări',
        'Sistem comenzi & plăți online',
        'Permite clienților să plătească direct pe site. Include:\n• Integrare cu un procesator de plăți (Stripe, PayU, mobilPay, Netopia)\n• Suport pentru carduri Visa, Mastercard, Maestro\n• Pagină de checkout securizată (SSL)\n• Confirmare automată a plății\n• Istoric tranzacții în panoul de administrare\n• Suport pentru plata la livrare (opțional)\n• Testare completă în mediu sandbox și producție\nLivrabile: Sistem de plăți funcțional + cont merchant configurat + ghid utilizare.',
        1200, 'buc', 0, 20
      ],
      [
        'Funcționalități & Integrări',
        'Panou de administrare conținut (CMS)',
        'Editezi singur conținutul site-ului, fără cunoștințe tehnice. Include:\n• Interfață intuitivă, în limba română\n• Editare texte și imagini pe toate paginile\n• Adăugare/ștergere pagini noi\n• Upload și gestionare galerie foto\n• Programare postări blog (dacă e cazul)\n• Backup automat al conținutului\n• 1 oră de training inclus\nLivrabile: Acces panou CMS + video-tutorial personalizare + suport 30 zile.',
        1500, 'buc', 0, 21
      ],
      [
        'Funcționalități & Integrări',
        'Sistem conturi utilizatori & autentificare',
        'Utilizatorii își creează cont și se autentifică pe site. Include:\n• Formular înregistrare (email/parolă sau social login)\n• Formular login cu "am uitat parola"\n• Profil utilizator (date personale, istoric, preferințe)\n• Roluri și permisiuni (admin, editor, utilizator standard)\n• Resetare parolă prin email\n• Securizare conturi (hash parole, protecție brute-force)\n• Opțional: autentificare prin Google/Facebook\nLivrabile: Sistem de autentificare complet funcțional + documentație.',
        1000, 'buc', 0, 22
      ],
      // ═══════════════════════════════════════════════════════════════════════
      // APLICAȚIE PE TELEFON & PWA
      // ═══════════════════════════════════════════════════════════════════════
      [
        'Aplicație pe Telefon & PWA',
        'Aplicație Android & iOS (din site-ul tău)',
        'Transform site-ul într-o aplicație mobilă instalabilă. Include:\n• Conversia site-ului în aplicație nativă (Capacitor/Ionic)\n• Iconiță personalizată pe ecranul telefonului\n• Funcționare offline pentru conținut deja încărcat\n• Acces la funcții telefon (cameră, geolocație, notificări)\n• Publicare în Google Play Store (asistență inclusă)\n• Optimizare performanță pentru mobil\n• Testare pe dispozitive reale Android și iOS\nLivrabile: Fișiere APK (Android) și IPA (iOS) + ghid publicare în store-uri.',
        2000, 'proiect', 0, 30
      ],
      [
        'Aplicație pe Telefon & PWA',
        'Site instalabil ca aplicație (PWA)',
        'Site-ul tău se comportă ca o aplicație, fără descărcare din store. Include:\n• Instalare direct din browser (Chrome, Safari)\n• Funcționare offline sau cu internet slab\n• Actualizări automate (fără a merge în store)\n• Iconiță pe ecranul principal\n• Navigare fluidă, fără reîncărcări complete\n• Compatibil Android și iOS\n• Notificări push (necesită configurare separată)\nLivrabile: Site configurat ca PWA + fișier manifest + service worker.',
        800, 'proiect', 0, 31
      ],
      [
        'Aplicație pe Telefon & PWA',
        'Notificări push pe telefon',
        'Trimite mesaje direct pe telefonul utilizatorilor. Include:\n• Configurare serviciu push (Firebase Cloud Messaging)\n• Cerere permisiuni notificări (popup prietenos)\n• Segmentare utilizatori (opțional)\n• Programare notificări pentru mai târziu\n• Statistici: câți au deschis notificarea\n• Suport pentru notificări pe Android și iOS\n• Integrare cu panoul de administrare existent\nLivrabile: Sistem push funcțional + ghid trimitere notificări.',
        600, 'buc', 0, 32
      ],
      // ═══════════════════════════════════════════════════════════════════════
      // VIZIBILITATE PE GOOGLE (SEO)
      // ═══════════════════════════════════════════════════════════════════════
      [
        'Vizibilitate pe Google (SEO)',
        'Analiză & raport SEO tehnic',
        'Afli ce probleme are site-ul tău în ochii Google. Include:\n• Audit complet al structurii site-ului\n• Verificare indexare în Google Search Console\n• Analiză cuvinte cheie relevante pentru nișa ta\n• Identificare erori tehnice (link-uri stricate, imagini neoptimizate)\n• Verificare viteză încărcare (Desktop & Mobil)\n• Analiză concurență (top 3 competitori)\n• Raport detaliat cu priorități de acțiune\nLivrabile: Raport PDF 10-20 pagini + fișier Excel cu toate problemele + recomandări concrete.',
        400, 'buc', 0, 40
      ],
      [
        'Vizibilitate pe Google (SEO)',
        'Optimizare viteză & performanță',
        'Site rapid = poziții mai bune în Google + clienți mulțumiți. Include:\n• Analiză Google PageSpeed Insights (înainte și după)\n• Compresie și optimizare imagini (fără pierdere calitate)\n• Minificare cod CSS, JavaScript, HTML\n• Implementare lazy loading pentru imagini\n• Configurare cache browser\n• Optimizare interfață bază de date (dacă e cazul)\n• Testare performanță pe 3 dispozitive diferite\nLivrabile: Raport performanță înainte/după + site optimizat (scor 90+ PageSpeed).',
        600, 'buc', 0, 41
      ],
      [
        'Vizibilitate pe Google (SEO)',
        'Configurare indexare & sitemap XML',
        'Asigurăm că Google găsește și indexează toate paginile tale. Include:\n• Creare sitemap XML automat actualizat\n• Configurare robots.txt pentru crawlere\n• Înregistrare site în Google Search Console\n• Înregistrare în Google Analytics 4\n• Verificare și reparare erori de indexare\n• Adăugare structured data (schema.org) pentru servicii/produse\n• Monitorizare indexare timp de 7 zile\nLivrabile: Sitemap XML activ + conturi Search Console & Analytics configurate + raport indexare.',
        300, 'buc', 0, 42
      ],
      [
        'Vizibilitate pe Google (SEO)',
        'SEO Tehnic Avansat',
        'Optimizare tehnică profundă pentru performanță maximă în Google. Include:\n• Audit tehnic complet (crawl budget, canonical tags, redirect chains)\n• Optimizare structură URL și ierarhie site\n• Implementare schema.org avansat (JSON-LD)\n• Corectare erori crawl (404, 500, redirect-uri infinite)\n• Optimizare JavaScript pentru SEO (rendering, hydration)\n• Verificare și reparare probleme de indexare\n• Analiză log files (opțional, pentru site-uri mari)\n• Raport detaliat cu priorități și impact estimat\nLivrabile: Raport tehnic SEO + implementarea corecțiilor critice + documentație structură date.',
        800, 'buc', 0, 43
      ],
      [
        'Vizibilitate pe Google (SEO)',
        'AEO - Answer Engine Optimization',
        'Optimizare pentru motoare de răspuns (Google AI Overviews, ChatGPT, Perplexity). Include:\n• Analiză interogări tip întrebare ("cine", "ce", "cum", "de ce")\n• Reformulare conținut în format Q&A (întrebare-răspuns)\n• Implementare FAQ schema pe pagini cheie\n• Optimizare pentru featured snippets (poziția 0)\n• Structurare conținut cu răspunsuri concise (40-60 cuvinte)\n• Adăugare date structurate pentru liste și tabele\n• Monitorizare prezență în AI Overviews\nLivrabile: Raport AEO + pagini optimizate Q&A + ghid creare conținut AEO-friendly.',
        600, 'buc', 0, 44
      ],
      [
        'Vizibilitate pe Google (SEO)',
        'GEO - Generative Engine Optimization',
        'Optimizare pentru motoare generative AI (ChatGPT Search, Google SGE, Claude). Include:\n• Analiză vizibilitate brand în răspunsuri AI\n• Optimizare conținut pentru a fi citat de AI (autoritate, claritate, structură)\n• Creare pagini "hub" de autoritate în nișa ta\n• Implementare E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)\n• Adăugare surse și citate în conținut\n• Optimizare pentru "near me" și intenție locală\n• Monitorizare mențiuni brand în AI tools\n• Strategie de digital PR pentru vizibilitate AI\nLivrabile: Raport GEO + strategie conținut AI-friendly + 3 pagini hub optimizate.',
        900, 'buc', 0, 45
      ],
      // ═══════════════════════════════════════════════════════════════════════
      // MENTENANȚĂ LUNARĂ & SUPORT
      // ═══════════════════════════════════════════════════════════════════════
      [
        'Mentenanță Lunară & Suport',
        'Găzduire & mentenanță tehnică',
        'Site-ul tău găzduit și monitorizat 24/7. Include:\n• Hosting pe servere SSD în România (viteză maximă)\n• Domeniu inclus (.ro sau .com)\n• Certificat SSL (lăcățel verde în browser)\n• Backup zilnic automat (păstrat 30 zile)\n• Monitorizare uptime 24/7 (alerte dacă pică site-ul)\n• Actualizări de securitate la framework și plugin-uri\n• Suport tehnic prin email/ticket (răspuns în 24h)\n• Raport lunar: trafic, uptime, backup-uri efectuate\nLivrabile: Acces hosting + acces backup-uri + raport lunar.',
        150, 'lună', 1, 50
      ],
      [
        'Mentenanță Lunară & Suport',
        'Actualizări conținut & suport extins',
        'Te ajutăm cu modificările curente pe site. Include:\n• Până la 5 ore de lucru pe lună pentru actualizări\n• Modificare texte și imagini pe site\n• Adăugare articole blog (până la 4/lună)\n• Adăugare produse noi (pentru magazine online)\n• Ajustări minore de design (culori, bannere)\n• Suport prioritar prin WhatsApp/email\n• Timp de răspuns: 4 ore în zilele lucrătoare\n• Raport lunar cu orele consumate\nLivrabile: Actualizările efectuate + raport ore consumate.\nNot: Orele neutilizate nu se cumulează în luna următoare.',
        250, 'lună', 1, 51
      ],
      [
        'Mentenanță Lunară & Suport',
        'Optimizare SEO lunară continuă',
        'Îmbunătățești constant pozițiile în Google. Include:\n• Analiză lunară a pozițiilor pentru 10 cuvinte cheie\n• Optimizare on-page pentru 2-3 pagini existente\n• 1 articol blog optimizat SEO (800+ cuvinte)\n• Construire 2-3 backlink-uri de calitate\n• Actualizare meta titluri și descrieri\n• Monitorizare trafic organic (Google Analytics)\n• Raport lunar: evoluție poziții, trafic, acțiuni efectuate\n• Ședință lunară de 30 min pentru rezultate\nLivrabile: Raport SEO lunar + acțiunile efectuate + plan pentru luna următoare.',
        350, 'lună', 1, 52
      ],
    ];
    for (const [cat, name, desc, price, unit, recurring, order] of seedServices) {
      await db.execute(
        'INSERT OR IGNORE INTO service_catalog(category,name,description,default_price,unit,is_recurring,sort_order) VALUES(?,?,?,?,?,?,?)',
        [cat, name, desc, price, unit, recurring, order]
      );
    }
  }
}

export async function getSetting(key: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key=?", [key]
  );
  return rows[0]?.value ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, value]
  );
  // Trigger update event for reactivity
  window.dispatchEvent(new CustomEvent("settings-changed", { detail: { key, value } }));
}

export async function getFiscalOverrides(_an?: number): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings WHERE key LIKE 'fiscal_%'"
  );
  const all: Record<string, string> = {};
  rows.forEach(({ key, value }) => (all[key] = value));
  return all;
}

/** Parsează override-urile din DB într-un FiscalOverrides pentru calculeaza() */
export function parseFiscalOverrides(raw: Record<string, string>, an: number): {
  SM?: number; CASS?: number; CAS?: number; IMPOZIT?: number; FORFETAR?: number;
} {
  const o: Record<string, number | undefined> = {};
  const smKey = `fiscal_SM_${an}`;
  if (smKey in raw) o.SM = parseFloat(raw[smKey]);
  if ("fiscal_CASS" in raw) o.CASS = parseFloat(raw["fiscal_CASS"]) / 100;
  if ("fiscal_CAS" in raw) o.CAS = parseFloat(raw["fiscal_CAS"]) / 100;
  if ("fiscal_IMPOZIT" in raw) o.IMPOZIT = parseFloat(raw["fiscal_IMPOZIT"]) / 100;
  if ("fiscal_FORFETAR" in raw) o.FORFETAR = parseFloat(raw["fiscal_FORFETAR"]) / 100;
  return o;
}

/** Citește următorul număr de factură fără să incrementeze contorul. */
export async function peekInvoiceNumber(): Promise<string> {
  const series = (await getSetting("invoice_series")) || "FA";
  const counter = parseInt((await getSetting("invoice_counter")) || "1", 10);
  return `${series}-${String(counter).padStart(4, "0")}`;
}

/** Incrementează contorul — apelat DOAR după INSERT reușit. */
export async function bumpInvoiceCounter(): Promise<void> {
  const counter = parseInt((await getSetting("invoice_counter")) || "1", 10);
  await setSetting("invoice_counter", String(counter + 1));
}

/** Citește următorul număr de ofertă fără să incrementeze contorul. */
export async function peekQuoteNumber(): Promise<string> {
  const series = (await getSetting("quote_series")) || "OF";
  const counter = parseInt((await getSetting("quote_counter")) || "1", 10);
  return `${series}-${String(counter).padStart(4, "0")}`;
}

/** Incrementează contorul oferte — apelat DOAR după INSERT reușit. */
export async function bumpQuoteCounter(): Promise<void> {
  const counter = parseInt((await getSetting("quote_counter")) || "1", 10);
  await setSetting("quote_counter", String(counter + 1));
}
