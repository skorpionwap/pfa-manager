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
      notes TEXT DEFAULT '', chat_history TEXT DEFAULT '[]',
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
  try { await db.execute("ALTER TABLE contracts ADD COLUMN chat_history TEXT DEFAULT '[]'"); } catch(e) {}
  try { await db.execute("ALTER TABLE invoices ADD COLUMN source TEXT DEFAULT 'mine'"); } catch(e) {}
  try { await db.execute("ALTER TABLE invoices ADD COLUMN file_path TEXT DEFAULT ''"); } catch(e) {}
  try { await db.execute("ALTER TABLE quotes ADD COLUMN chat_history TEXT DEFAULT '[]'"); } catch(e) {}

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
      chat_history TEXT DEFAULT '[]',
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
      description TEXT DEFAULT '', chat_history TEXT DEFAULT '[]',
      features TEXT DEFAULT '[]',
      default_price REAL DEFAULT 0,
      unit TEXT DEFAULT 'buc',
      is_recurring INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(category, name)
    );
  `);

  // Simple migration for existing catalogs
  try { await db.execute("ALTER TABLE service_catalog ADD COLUMN features TEXT DEFAULT '[]'"); } catch(e) {}

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
      notes TEXT DEFAULT '', chat_history TEXT DEFAULT '[]',
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

  // ── Sincronizare Catalog Servicii Ofertare ──────────────────────────────────
  // Curățăm duplicatele existente (dacă există) înainte de processare
  await db.execute(`
    DELETE FROM service_catalog
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM service_catalog
      GROUP BY category, name
    )
  `);

  const MASTER_SERVICES = [
    { cat: 'Aspect & Identitate Vizuală', name: 'Wireframe-uri & structură pagini', desc: 'Structura clară a site-ului, ca un "schelet" logic al paginilor.', feats: ['Wireframe-uri pentru paginile principale', 'Amplasarea elementelor (header, conținut, footer)', 'Flux de navigare între pagini', '2 runde de revizuiri'], price: 300, unit: 'proiect', rec: 0, order: 1 },
    { cat: 'Aspect & Identitate Vizuală', name: 'Design UI/UX complet', desc: 'Transform structura în design vizual profesional direct implementabil.', feats: ['Design personalizat pe brandul tău', 'Paletă de culori și tipografie', 'Variante desktop + mobil (responsive)', 'Ghid de stil (culori, fonturi, componente)'], price: 1200, unit: 'proiect', rec: 0, order: 2 },
    { cat: 'Aspect & Identitate Vizuală', name: 'Kit identitate vizuală digitală', desc: 'Elementele grafice de bază pentru prezența ta online.', feats: ['3 propuneri de logo (variante inițiale)', 'Paleta de culori și fonturi recomandate', 'Variante logo (principal, secundar, favicon)', 'Ghid rapid de utilizare'], price: 800, unit: 'proiect', rec: 0, order: 3 },
    
    { cat: 'Construirea Site-ului', name: 'Pagina de prezentare (Landing Page)', desc: 'O singură pagină optimizată pentru a promova un produs sau serviciu cu focus pe rată de conversie.', feats: ['Design modern tip Landing Page dintr-o singură pagină lungă', 'Până la 5 secțiuni (Ex: Hero, Despre, Servicii, Testimoniale, Contact)', 'Formular de contact integrat', 'Optimizare completă pentru CTA (Call To Action)'], price: 1000, unit: 'proiect', rec: 0, order: 10 },
    { cat: 'Construirea Site-ului', name: 'Site de prezentare (1-5 pagini)', desc: 'Site perfect pentru afaceri la început de drum, cu pagini interne și informații esențiale.', feats: ['Homepage + 4 pagini interne (Ex: Despre, Portofoliu, Servicii, Contact)', 'Design responsive perfect adaptabil pe orice ecran', 'Formular de contact și integrare hartă Google Maps', 'Viteză de încărcare optimizată'], price: 2000, unit: 'proiect', rec: 0, order: 11 },
    { cat: 'Construirea Site-ului', name: 'Site de prezentare Complex (6-15 pagini)', desc: 'O platformă robustă, cu multiple secțiuni, pentru o companie dezvoltată.', feats: ['Până la 15 pagini construite și populate', 'Design complex cu elemente grafice avansate', 'Sistem de blog / noutăți', 'Integrare link-uri social media și abonare la newsletter'], price: 3500, unit: 'proiect', rec: 0, order: 12 },
    { cat: 'Construirea Site-ului', name: 'Magazin online (E-commerce)', desc: 'Platformă completă de vânzări online.', feats: ['Catalog produse cu categorii structurate și filtre avansate', 'Pagini detaliate pentru produse (imagini cu zoom, variații mărime/culoare)', 'Sistem complet de coș și checkout cu validare auto', 'Integrare procesator de plăți, facturare și metode de curierat'], price: 6000, unit: 'proiect', rec: 0, order: 13 },
    { cat: 'Construirea Site-ului', name: 'Aplicație web personalizată', desc: 'Software web custom dezvoltat de la zero, conform cerințelor funcționale unice.', feats: ['Arhitectură de baze de date custom, scalabilă', 'Sistem avansat de utilizatori cu roluri și permisiuni ierarhice', 'Dashboard cu rapoarte, statistici și grafice detaliate', 'Fluxuri logice de procesare a datelor personalizate'], price: 10000, unit: 'proiect', rec: 0, order: 14 },

    { cat: 'Funcționalități & Integrări', name: 'SEO Inițial (Pentru site-uri noi)', desc: 'Toate implementările tehnice necesare de la bun început la lansarea unui site pentru a asigura indexarea corectă.', feats: ['Optimizare On-Page (Titluri, Descrieri) pt toate paginile', 'Generare și submitere Sitemap XML pentru crawlere', 'Configurare Google Search Console & Google Analytics 4', 'Structură semantică HTML (taguri H1-H6) definită corect', 'Optimizarea vitezei de bază (Minificare cod, Lazy Loading imagini, Caching eficent)'], price: 600, unit: 'proiect', rec: 0, order: 20 },
    { cat: 'Funcționalități & Integrări', name: 'Sistem comenzi & plăți online', desc: 'Configurare terminal de plăți (POS virtual) securizat pe site-ul tău.', feats: ['Integrare procesator românesc (ex: Stripe / PayU / Netopia)', 'Testare sistem plăți complet în Mediu Sandbox de dezvoltare', 'Configurare facturare fiscală automată la reușita plății', 'Interfață backend cu status istoric plăți (plătit, refuzat, etc)'], price: 1200, unit: 'proiect', rec: 0, order: 21 },
    { cat: 'Funcționalități & Integrări', name: 'Panou de administrare conținut (CMS)', desc: 'Schimbi rapid si usor textele si imaginile de pe site fara ajutorul unui programator.', feats: ['Instalare și parametrizare sistem modern de management (CMS)', 'Dezvoltare blocuri de conținut editabile (Text, Imagine, Galerie) personalizate', 'Gestiune facilă centralizată de fișiere media (fotografii, PDF-uri)', 'Sesiune video de asistență / training pentru învățarea utilizării sistemului'], price: 1500, unit: 'proiect', rec: 0, order: 22 },

    { cat: 'Mentenanță Lunară & Suport', name: 'Găzduire & mentenanță tehnică', desc: 'Asigurăm disponibilitatea 99.9% și securitatea tehnică a site-ului tău lună de lună.', feats: ['Găzduire web pe un server rapid și localizat în Europa (SSD NVMe)', 'Certificat SSL automat reînnoit pentru canal securizat', 'Sistem de Backup automat lunar sau săptămânal testat', 'Alerte Uptime și monitorizare ping la 5 minute', 'Update-uri majore de securitate și pachete software'], price: 200, unit: 'lună', rec: 1, order: 50 },
    { cat: 'Mentenanță Lunară & Suport', name: 'Actualizări conținut & suport extins', desc: 'Suntem dispuși să lucrăm constant cu tine. Ajustări lunare și asistență promptă.', feats: ['Aprox. 5 ore de lucru incluse pe lună rezervate pentru modificări', 'Ajustări elemente de design / introducere conținut și articole', 'Asistență tehnică prioritară (Răspuns rapid 4-8 ore) pe canal de email/telefon'], price: 500, unit: 'lună', rec: 1, order: 51 },
    { cat: 'Mentenanță Lunară & Suport', name: 'Optimizare SEO lunară continuă', desc: 'Investiție lunară care crește vizibilitatea, autoritatea și atrage organic trafic relevant.', feats: ['Monitorizare evoluție clasament cuvinte cheie prin tool dedicat', 'Concept și adaptare pentru 1-2 articole/pagini cu focus pe ranking', 'Generare linkbuilding organic (atragere backlink-uri în publicații)', 'Optimizări tehnice recurente, A/B Testing pe titluri pagini', 'Emitere raport detaliat vizual de performanță (PDF) lunar'], price: 1000, unit: 'lună', rec: 1, order: 52 },
  ];

  for (const svc of MASTER_SERVICES) {
    // Încercăm să aducem la zi itemul vizat fix după nume
    const existing = await db.select<{id: number}[]>('SELECT id FROM service_catalog WHERE name = ?', [svc.name]);
    if (existing.length > 0) {
      // Actualizăm descrierea, caracteristicile (features), pentru corectitudine
      await db.execute(
        'UPDATE service_catalog SET category=?, description=?, features=?, sort_order=? WHERE name=?',
        [svc.cat, svc.desc, JSON.stringify(svc.feats), svc.order, svc.name]
      );
    } else {
      // Altfel, îl introducem pe curat
      await db.execute(
        'INSERT INTO service_catalog(category,name,description,features,default_price,unit,is_recurring,sort_order) VALUES(?,?,?,?,?,?,?,?)',
        [svc.cat, svc.name, svc.desc, JSON.stringify(svc.feats), svc.price, svc.unit, svc.rec, svc.order]
      );
    }
  }

  // Renamed retro-compatibility fixes for user data consistency
  await db.execute(`UPDATE service_catalog SET name = 'Site de prezentare Complex (6-15 pagini)' WHERE name = 'Site de prezentare (1-15 pagini)'`);
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
