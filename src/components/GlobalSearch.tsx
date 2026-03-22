import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, FileText, FileSignature, X } from "lucide-react";
import { getDb, isTauri } from "@/lib/db";

interface SearchResult {
  id: number;
  label: string;
  sub: string;
  route: string;
}

interface SearchGroup {
  title: string;
  icon: typeof Users;
  items: SearchResult[];
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Flatten items for keyboard navigation
  const flatItems = results.flatMap(g => g.items);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !isTauri()) { setResults([]); return; }
    setLoading(true);
    try {
      const db = await getDb();
      const like = `%${q}%`;

      const clients = await db.select<{ id: number; name: string; cif: string; email: string }[]>(
        "SELECT id, name, cif, email FROM clients WHERE name LIKE ? OR cif LIKE ? OR email LIKE ? LIMIT 5",
        [like, like, like],
      );
      const invoices = await db.select<{ id: number; number: string; total: number; status: string }[]>(
        "SELECT id, number, total, status FROM invoices WHERE number LIKE ? LIMIT 5",
        [like, like],
      );
      const contracts = await db.select<{ id: number; description: string; client_name: string }[]>(
        `SELECT c.id, c.description, cl.name as client_name
         FROM contracts c LEFT JOIN clients cl ON cl.id = c.client_id
         WHERE c.description LIKE ? OR cl.name LIKE ? LIMIT 5`,
        [like, like],
      );

      const groups: SearchGroup[] = [];

      if (clients.length) groups.push({
        title: "Clienți",
        icon: Users,
        items: clients.map(c => ({
          id: c.id,
          label: c.name,
          sub: [c.cif, c.email].filter(Boolean).join(" · ") || "—",
          route: "/clienti",
        })),
      });
      if (invoices.length) groups.push({
        title: "Facturi",
        icon: FileText,
        items: invoices.map(i => ({
          id: i.id,
          label: `Factura ${i.number}`,
          sub: `${i.total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON · ${i.status}`,
          route: "/facturi",
        })),
      });
      if (contracts.length) groups.push({
        title: "Contracte",
        icon: FileSignature,
        items: contracts.map(c => ({
          id: c.id,
          label: c.description || "Contract",
          sub: c.client_name || "—",
          route: "/contracte",
        })),
      });

      setResults(groups);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, open, doSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      const item = flatItems[activeIndex];
      navigate(item.route);
      setOpen(false);
    }
  };

  const go = (route: string) => { navigate(route); setOpen(false); };

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div className="search-overlay" onClick={() => setOpen(false)}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="search-input-wrap">
          <Search size={16} color="var(--tx-3)" />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Caută clienți, facturi, contracte..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="search-kbd">Esc</kbd>
        </div>

        {/* Results */}
        <div className="search-results">
          {!query.trim() && (
            <div className="search-empty">
              <p>Tastează pentru a căuta</p>
              <p style={{ color: "var(--tx-4)", fontSize: 11, marginTop: 4 }}>
                Clienți, facturi, contracte — totul e căutabil
              </p>
            </div>
          )}
          {query.trim() && loading && (
            <div className="search-empty"><p style={{ color: "var(--tx-3)" }}>Se caută...</p></div>
          )}
          {query.trim() && !loading && !results.length && (
            <div className="search-empty"><p style={{ color: "var(--tx-3)" }}>Niciun rezultat pentru "{query}"</p></div>
          )}
          {results.map(group => (
            <div key={group.title} className="search-group">
              <div className="search-group-title">
                <group.icon size={12} />
                {group.title}
              </div>
              {group.items.map(item => {
                runningIndex++;
                const idx = runningIndex;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`${group.title}-${item.id}`}
                    className={`search-result-item ${isActive ? "active" : ""}`}
                    onClick={() => go(item.route)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <div>
                      <div className="search-result-label">{item.label}</div>
                      <div className="search-result-sub">{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="search-footer">
          <span><kbd>↑↓</kbd> navigare</span>
          <span><kbd>↵</kbd> deschide</span>
          <span><kbd>Esc</kbd> închide</span>
        </div>
      </div>
    </div>
  );
}
