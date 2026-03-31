export interface Client {
  id: number;
  name: string;
  cif: string;
  reg_com?: string; // e.g. J40/123/2020
  address: string;
  email: string;
  phone: string;
  contact_person: string;
  bank?: string;
  iban?: string;
  legal_representative?: string; // e.g. Ion Popescu
  representative_function?: string; // e.g. Administrator
  is_archived?: boolean;
  created_at: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: number;
  number: string;
  client_id: number;
  contract_id?: number | null; // Added for DDA linking
  client_name?: string;
  date: string;
  due_date: string;
  items: InvoiceItem[];
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  category?: string; // Added for DDA: Tranșă, Abonament, etc.
  is_signed?: boolean; // Added for DDA: PVR signature status
  source?: "mine" | "client";
  file_path?: string;
  notes: string;
  created_at: string;
}

export interface Contract {
  id: number;
  client_id: number | null;
  client_name?: string;
  type: "cesiune" | "cesiune_abonament" | "prestari";
  number: string;
  date: string;
  description: string;
  amount: number;
  status: "activ" | "expirat" | "reziliat" | "pending";
  quote_id?: number | null;
  source?: "mine" | "client";
  file_path?: string;
  notes: string;
  chat_history?: string;
  created_at: string;
}

export type OperatingMode = "dda" | "pfa";
export type PfaMode = "real" | "norma";

export interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
}

export interface Settings {
  my_name: string;
  my_cif: string;
  my_reg_com?: string;
  my_address: string;
  my_bank: string;
  my_iban: string;
  my_email: string;
  my_phone: string;
  my_function?: string;
  invoice_series: string;
  invoice_counter: number;
  operating_mode: OperatingMode;
  pfa_mode: PfaMode;
  pfa_norma_valoare: number;
}

export interface ServiceCatalogItem {
  id: number;
  category: string;
  name: string;
  description: string;
  features?: string; // JSON string array or newline separated
  default_price: number;
  unit: string;
  is_recurring: boolean;
  sort_order: number;
  created_at: string;
}

export interface QuoteItem {
  service_id?: number;
  description: string;
  features?: string[]; // Structured deliverables
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: number;
  number: string;
  client_id: number;
  client_name?: string;
  title: string;
  project_type: string;
  page_count: number;
  items: QuoteItem[];
  subscription_items: QuoteItem[];
  subscription_price: number;
  subscription_months: number;
  subscription_start_date: string;
  has_subscription: boolean;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  delivery_days: number;
  valid_until: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  converted_to_id?: number | null;
  terms?: string;
  notes: string;
  chat_history?: string;
  created_at: string;
}
