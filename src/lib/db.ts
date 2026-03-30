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
      created_at TEXT DEFAULT (datetime('now'))
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
  const catalogCount = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM service_catalog');
  if (catalogCount[0]?.cnt === 0) {
    const seedServices = [
      // Aspect & Identitate Vizuală
      ['Aspect & Identitate Vizuală', 'Schițe inițiale & structura paginilor', 'Wireframe-uri pentru toate paginile principale ale site-ului', 300, 'proiect', 0, 1],
      ['Aspect & Identitate Vizuală', 'Design complet al interfeței', 'Design UI/UX profesional adaptat brandului tău', 1200, 'proiect', 0, 2],
      ['Aspect & Identitate Vizuală', 'Prototip interactiv (clickabil)', 'Simulare completă a site-ului înainte de dezvoltare', 500, 'proiect', 0, 3],
      ['Aspect & Identitate Vizuală', 'Kit identitate vizuală digitală', 'Logo, culori, fonturi și elemente grafice pentru online', 800, 'proiect', 0, 4],
      // Construirea Site-ului
      ['Construirea Site-ului / Aplicației', 'Pagina ta de prezentare online (1-5 pagini)', 'Site de tip landing page cu până la 5 secțiuni', 1500, 'proiect', 0, 10],
      ['Construirea Site-ului / Aplicației', 'Site complet de prezentare (5-15 pagini)', 'Site multi-pagină cu navigare, contact și blog', 3500, 'proiect', 0, 11],
      ['Construirea Site-ului / Aplicației', 'Magazin online (E-commerce)', 'Platformă de vânzări online cu coș și plăți', 6000, 'proiect', 0, 12],
      ['Construirea Site-ului / Aplicației', 'Aplicație web personalizată', 'Aplicație cu funcționalități avansate și bază de date', 8000, 'proiect', 0, 13],
      // Funcționalități
      ['Funcționalități & Integrări', 'Sistem comenzi & plăți online', 'Integrare Stripe / PayU / mobilPay pentru plăți card', 1200, 'buc', 0, 20],
      ['Funcționalități & Integrări', 'Panou de administrare conținut', 'Sistem prin care poți edita textele și imaginile singur', 1500, 'buc', 0, 21],
      ['Funcționalități & Integrări', 'Sistem conturi utilizatori & autentificare', 'Login, înregistrare, roluri și permisiuni', 1000, 'buc', 0, 22],
      // Mobile & PWA
      ['Aplicație pe Telefon & PWA', 'Aplicație Android instalabilă', 'Aplicație nativă pentru Android din site-ul tău (Capacitor)', 2000, 'proiect', 0, 30],
      ['Aplicație pe Telefon & PWA', 'Site instalabil pe telefon (PWA)', 'Site-ul tău funcționează ca o aplicație pe orice telefon', 800, 'proiect', 0, 31],
      ['Aplicație pe Telefon & PWA', 'Notificări push pe telefon', 'Trimite notificări utilizatorilor direct pe telefon', 600, 'buc', 0, 32],
      // SEO
      ['Vizibilitate pe Google (SEO)', 'Analiză & raport SEO tehnic', 'Audit complet al site-ului pentru Google, cu raport detaliat', 400, 'buc', 0, 40],
      ['Vizibilitate pe Google (SEO)', 'Optimizare viteză & performanță', 'Site rapid = poziții mai bune în Google', 600, 'buc', 0, 41],
      ['Vizibilitate pe Google (SEO)', 'Configurare indexare & sitemap XML', 'Asigurăm că Google indexează corect toate paginile tale', 300, 'buc', 0, 42],
      // Mentenanță
      ['Mentenanță Lunară & Suport', 'Găzduire & mentenanță lunară', 'Hosting, backup zilnic, monitorizare 24/7', 150, 'lună', 1, 50],
      ['Mentenanță Lunară & Suport', 'Actualizări de conținut & securitate', 'Actualizăm textele, imaginile și menținem site-ul securizat', 250, 'lună', 1, 51],
      ['Mentenanță Lunară & Suport', 'Optimizare SEO lunară', 'Raport lunar, ajustări cuvinte cheie, conținut proaspăt', 350, 'lună', 1, 52],
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
