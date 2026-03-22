import { getDb } from "@/lib/db";
import { MONTH_LABELS } from "@/lib/constants";

export interface MonthlyData {
  month: string;
  monthLabel: string;
  venituri: number;
  cheltuieli: number;
}

export interface ClientRevenue {
  client_name: string;
  total: number;
}

export interface CategoryExpense {
  category: string;
  total: number;
}

export interface AnnualData {
  totalVenituri: number;
  totalCheltuieli: number;
  monthlyData: MonthlyData[];
  topClients: ClientRevenue[];
  categoryBreakdown: CategoryExpense[];
  invoiceCount: number;
  expenseCount: number;
}

export async function fetchAnnualData(year: number): Promise<AnnualData> {
  const db = await getDb();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  // Totals
  const [invSum] = await db.select<{ total: number }[]>(
    "SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE status = 'paid' AND date >= ? AND date <= ?",
    [start, end]
  );
  const [invCount] = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM invoices WHERE status = 'paid' AND date >= ? AND date <= ?",
    [start, end]
  );

  let totalCheltuieli = 0;
  let expenseCount = 0;
  try {
    const [expSum] = await db.select<{ total: number }[]>(
      "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date >= ? AND date <= ?",
      [start, end]
    );
    const [expCount] = await db.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM expenses WHERE date >= ? AND date <= ?",
      [start, end]
    );
    totalCheltuieli = expSum.total;
    expenseCount = expCount.count;
  } catch { /* expenses table might not exist */ }

  // Monthly data — invoices
  const invMonthly = await db.select<{ month: string; total: number }[]>(
    "SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(total),0) as total FROM invoices WHERE status = 'paid' AND date >= ? AND date <= ? GROUP BY strftime('%Y-%m', date) ORDER BY month",
    [start, end]
  );
  const invByMonth = new Map(invMonthly.map(r => [r.month, r.total]));

  // Monthly data — expenses
  let expByMonth = new Map<string, number>();
  try {
    const expMonthly = await db.select<{ month: string; total: number }[]>(
      "SELECT strftime('%Y-%m', date) as month, COALESCE(SUM(amount),0) as total FROM expenses WHERE date >= ? AND date <= ? GROUP BY strftime('%Y-%m', date) ORDER BY month",
      [start, end]
    );
    expByMonth = new Map(expMonthly.map(r => [r.month, r.total]));
  } catch { /* ignore */ }

  // Build 12 months
  const monthlyData: MonthlyData[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const mm = String(m).padStart(2, "0");
    monthlyData.push({
      month: key,
      monthLabel: MONTH_LABELS[mm] || `Luna ${m}`,
      venituri: invByMonth.get(key) || 0,
      cheltuieli: expByMonth.get(key) || 0,
    });
  }

  // Top clients
  const topClients = await db.select<ClientRevenue[]>(
    "SELECT c.name as client_name, SUM(i.total) as total FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.status = 'paid' AND i.date >= ? AND i.date <= ? GROUP BY i.client_id ORDER BY total DESC LIMIT 10",
    [start, end]
  );

  // Category breakdown
  let categoryBreakdown: CategoryExpense[] = [];
  try {
    categoryBreakdown = await db.select<CategoryExpense[]>(
      "SELECT category, COALESCE(SUM(amount),0) as total FROM expenses WHERE date >= ? AND date <= ? GROUP BY category ORDER BY total DESC",
      [start, end]
    );
  } catch { /* ignore */ }

  return {
    totalVenituri: invSum.total,
    totalCheltuieli,
    monthlyData,
    topClients,
    categoryBreakdown,
    invoiceCount: invCount.count,
    expenseCount,
  };
}
