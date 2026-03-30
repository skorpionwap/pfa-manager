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

  // ── Chat Sessions (panoul general Gemini) ────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Nouă conversație',
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
  // Curățăm duplicatele și artefactele trecute total ambigue din baza de date
  try {
    // 1. Înlăturăm automat orice duplicat (păstrăm doar entry-ul cu ID cel mai mic)
    await db.execute(`
      DELETE FROM service_catalog
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM service_catalog
        GROUP BY category, name
      )
    `);

    // 2. Ștergem artefactele învechite (curățenie extremă)
    await db.execute(`DELETE FROM service_catalog WHERE name LIKE '%Site de prezentare%'`);
    await db.execute(`DELETE FROM service_catalog WHERE name LIKE '%Pagina de%'`);
    await db.execute(`DELETE FROM service_catalog WHERE name LIKE '%Landing Page%'`);
  } catch(e) {}

  const MASTER_SERVICES = [
    { cat: 'Aspect & Identitate Vizuală', name: 'Wireframe-uri & structură pagini', desc: 'Structura clară a site-ului, ca un "schelet" logic al paginilor.', feats: ['Wireframe-uri pentru paginile principale', 'Amplasarea elementelor (header, conținut, footer)', 'Flux de navigare între pagini', '2 runde de revizuiri'], price: 300, unit: 'proiect', rec: 0, order: 1 },
    { cat: 'Aspect & Identitate Vizuală', name: 'Design UI/UX complet', desc: 'Transform structura în design vizual profesional direct implementabil.', feats: ['Design personalizat pe brandul tău', 'Paletă de culori și tipografie', 'Variante desktop + mobil (responsive)', 'Ghid de stil (culori, fonturi, componente)'], price: 1200, unit: 'proiect', rec: 0, order: 2 },
    { cat: 'Aspect & Identitate Vizuală', name: 'Kit identitate vizuală digitală', desc: 'Elementele grafice de bază pentru prezența ta online.', feats: ['3 propuneri de logo (variante inițiale)', 'Paleta de culori și fonturi recomandate', 'Variante logo (principal, secundar, favicon)', 'Ghid rapid de utilizare'], price: 800, unit: 'proiect', rec: 0, order: 3 },
    
    { cat: 'Construirea Site-ului', name: 'Landing Page (Pagină Unică Promovare)', desc: 'O singură pagină optimizată exclusiv pentru a capta lead-uri sau a promova un produs/serviciu.', feats: ['Design modern One-Page', 'Structură secvențială (Secțiuni tip Hero, Despre, Servicii, Testimoniale)', 'Formular de contact/captare simplificat', 'Elemente orientate pur pe Rată de Conversie (CTA-uri repetate)'], price: 1000, unit: 'proiect', rec: 0, order: 10 },
    { cat: 'Construirea Site-ului', name: 'Site de Prezentare Standard (Până la 5 pagini)', desc: 'Site perfect structurat pentru afaceri și PFA-uri, cu pagini ierarhice (informații, servicii, detalii de contact).', feats: ['Homepage + până la 4 pagini interne (ex: Despre Noi, Portofoliu, Contact)', 'Design responsive 100%', 'Formular complex și integrare Google Maps', 'Arhitectură de Informații clară și navigație logică', 'Viteză optimizată de încărcare'], price: 2000, unit: 'proiect', rec: 0, order: 11 },
    { cat: 'Construirea Site-ului', name: 'Site de Prezentare Extins (Până la 15 pagini)', desc: 'Platformă completă de prezentare pentru o companie care oferă multiple categorii de servicii.', feats: ['Toate funcționalitățile pachetului Standard', 'Până la 15 pagini personalizate (inclusiv galerii foto multiple)', 'Sistem/Pagina de Noutăți (Blog integrat minimalist)', 'Formulare multiple sau secțiuni cu funcții custom'], price: 3500, unit: 'proiect', rec: 0, order: 12 },
    { cat: 'Construirea Site-ului', name: 'Magazin online (E-commerce)', desc: 'Platformă completă de vânzări online gata de lansat.', feats: ['Catalog produse cu categorii și filtre de căutare avansate', 'Sistem Coș și Proces de preluare comenzi centralizat', 'Checkout standard și validare auto', 'Integrare curierat / metode plată'], price: 6000, unit: 'proiect', rec: 0, order: 13 },
    { cat: 'Construirea Site-ului', name: 'Aplicație web personalizată', desc: 'Software web custom dezvoltat integral de la zero conform brief-ului funcțional unic.', feats: ['Bază de date scalabilă dedicată', 'Sistem login avansat și panou administrativ vizual', 'Pachete logice și fluxuri customizate strict pentru clienți sau angajații afacerii'], price: 10000, unit: 'proiect', rec: 0, order: 14 },

    { cat: 'Funcționalități & Integrări', name: 'SEO Inițial (Pentru site-uri noi)', desc: 'Toate setările tehnice Google necesare la momentul lansării site-ului.', feats: ['Configurare Meta Title/Description', 'Generare Sitemap XML dinamic', 'Setare și verificare cont Google Search Console & Analytics 4'], price: 600, unit: 'proiect', rec: 0, order: 20 },
    { cat: 'Funcționalități & Integrări', name: 'Sistem plăți cu cardul securizat', desc: 'Gestiune tranzacții și încasări automate card.', feats: ['Integrare modul (Domeniu local: ex Stripe / Netopia)', 'Teste detaliate integrării în mediu Sandbox', 'Panou de status tranzacții plătit/refuzat'], price: 1200, unit: 'proiect', rec: 0, order: 21 },
    { cat: 'Funcționalități & Integrări', name: 'Implementare Panou Control CMS', desc: 'Pentru ca tu/clientul să puteți edita singuri textele și fotografiile.', feats: ['Configurare soluție CMS OpenSource sau Headless', 'Editabil pentru blocuri statice text și imagini', 'Taining video înregistrat inclus pentru proprietar'], price: 1500, unit: 'proiect', rec: 0, order: 22 },

    { cat: 'Mentenanță Lunară & Suport', name: 'Găzduire & mentenanță tehnică', desc: 'Abonament fundamental: Asigurăm stabilitatea site-ului tău lunar.', feats: ['Server rapid localizat în EU (SSD NVMe)', 'Prelungire SSL și setup tehnic asigurat neîntrerupt', 'Mecanism Backup lunar auto'], price: 200, unit: 'lună', rec: 1, order: 50 },
    { cat: 'Mentenanță Lunară & Suport', name: 'Actualizări conținut tip asistență', desc: 'Abonament operativ: Te ajutăm constant cu adăugări și actualizări mici.', feats: ['Aprox. 5 ore/lună dedicate rezervate special modificărilor tale', 'Adăugări de noi texte pre-scrise sau produse/conținut foto', 'Timp Răspuns suport prioritar (max 4-8 ore active)'], price: 500, unit: 'lună', rec: 1, order: 51 },
    { cat: 'Mentenanță Lunară & Suport', name: 'Optimizare SEO organică (Abonament)', desc: 'Serviciul pentru creșterea prezenței în Top 10 Google pas cu pas.', feats: ['Investigare tehnică lunară de cuvinte cheie / poziții', 'Sugestii și asistență redacțională pt Articole sau link-uri calitative externe', 'Raportare lunară grafică SEO a progresului'], price: 1000, unit: 'lună', rec: 1, order: 52 },
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

  await db.execute(`DELETE FROM service_catalog WHERE name LIKE '%Site de prezentare (1-15 pagini)%' OR name LIKE '%1-5 pagini%'`);
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

// ── Chat Sessions (CRUD) ─────────────────────────────────────────────────────

export interface ChatSession {
  id: number;
  title: string;
  messages: string; // JSON string
  created_at: string;
  updated_at: string;
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const db = await getDb();
  return db.select<ChatSession[]>(
    "SELECT * FROM chat_sessions ORDER BY updated_at DESC"
  );
}

export async function getChatSession(id: number): Promise<ChatSession | null> {
  const db = await getDb();
  const rows = await db.select<ChatSession[]>(
    "SELECT * FROM chat_sessions WHERE id=?", [id]
  );
  return rows[0] ?? null;
}

export async function createChatSession(title?: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    "INSERT INTO chat_sessions(title, messages) VALUES(?, '[]')",
    [title ?? "Nouă conversație"]
  );
  const id = result.lastInsertId;
  if (id === undefined || id === null) {
    throw new Error("Failed to create chat session - no ID returned");
  }
  return typeof id === "bigint" ? Number(id) : id;
}

export async function updateChatSession(id: number, messages: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE chat_sessions SET messages=?, updated_at=datetime('now') WHERE id=?",
    [messages, id]
  );
}

export async function renameChatSession(id: number, title: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE chat_sessions SET title=?, updated_at=datetime('now') WHERE id=?",
    [title, id]
  );
}

export async function deleteChatSession(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM chat_sessions WHERE id=?", [id]);
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
