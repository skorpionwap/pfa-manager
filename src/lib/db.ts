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
      date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '[]',
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );
  `);

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

  // Default settings
  await db.execute(`
    INSERT OR IGNORE INTO settings(key, value) VALUES
      ('operating_mode', 'dda'),
      ('invoice_series', 'FA'),
      ('invoice_counter', '1')
  `);
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
