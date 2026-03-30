import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Quote } from "@/types";

type Status = Quote["status"];

const STATUS_LABELS: Record<Status, string> = {
  draft: "Ciornă",
  sent: "Trimisă",
  accepted: "Acceptată",
  rejected: "Refuzată",
  expired: "Expirată",
};

const STATUS_BADGE: Record<Status, React.CSSProperties> = {
  draft:    { background: "var(--bg-3)", color: "var(--tx-3)", border: "1px solid var(--border)" },
  sent:     { background: "var(--blue-dim)", color: "var(--blue)", border: "1px solid var(--blue-dim)" },
  accepted: { background: "var(--green-dim, #14532d22)", color: "var(--green, #22c55e)", border: "1px solid transparent" },
  rejected: { background: "var(--red-dim, #7f1d1d22)", color: "var(--red, #ef4444)", border: "1px solid transparent" },
  expired:  { background: "var(--bg-2)", color: "var(--tx-4)", border: "1px solid var(--border)" },
};

interface StatusDropdownProps {
  value: Status;
  onChange: (s: Status) => void;
}

export default function StatusDropdown({ value, onChange }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) window.addEventListener("mousedown", clickOutside);
    return () => window.removeEventListener("mousedown", clickOutside);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        style={{
          ...STATUS_BADGE[value],
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 99,
          fontSize: 11, fontWeight: 600,
        }}
        onClick={() => setOpen(!open)}
      >
        {STATUS_LABELS[value]} <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
          background: "var(--bg-2)", border: "1px solid var(--border-md)",
          borderRadius: "var(--r-md)", padding: 4, minWidth: 120,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
            <button
              key={s}
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "flex-start", padding: "6px 10px", fontSize: 12 }}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
