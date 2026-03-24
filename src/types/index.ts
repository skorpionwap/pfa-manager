export interface Client {
  id: number;
  name: string;
  cif: string;
  address: string;
  email: string;
  phone: string;
  contact_person: string;
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
  notes: string;
  created_at: string;
}

export interface Contract {
  id: number;
  client_id: number | null;
  client_name?: string;
  type: "cesiune" | "prestari";
  number: string;
  date: string;
  description: string;
  amount: number;
  status: "activ" | "expirat" | "reziliat" | "pending";
  notes: string;
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
  my_address: string;
  my_bank: string;
  my_iban: string;
  my_email: string;
  my_phone: string;
  invoice_series: string;
  invoice_counter: number;
  operating_mode: OperatingMode;
  pfa_mode: PfaMode;
  pfa_norma_valoare: number;
}
