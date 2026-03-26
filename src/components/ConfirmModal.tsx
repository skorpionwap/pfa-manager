import { Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--bg-card)", border: "1px solid var(--bd)",
          borderRadius: 12, padding: "24px 28px", minWidth: 320, maxWidth: 420,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex", flexDirection: "column", gap: 20,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            background: "rgba(239,68,68,0.15)", borderRadius: 8,
            padding: 8, display: "flex", color: "#ef4444",
          }}>
            <Trash2 size={18} />
          </span>
          <span style={{ color: "var(--tx-1)", fontWeight: 600, fontSize: 15 }}>
            Confirmare ștergere
          </span>
        </div>

        <p style={{
          color: "var(--tx-2)", margin: 0, fontSize: 14, lineHeight: 1.6,
          whiteSpace: "pre-line",
        }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onCancel}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <X size={14} /> Anulează
          </button>
          <button
            onClick={onConfirm}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#ef4444", color: "#fff", border: "none",
              borderRadius: 6, padding: "6px 14px", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
            }}
          >
            <Trash2 size={14} /> Șterge
          </button>
        </div>
      </div>
    </div>
  );
}
