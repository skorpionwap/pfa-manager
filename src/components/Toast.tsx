import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 250);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 200,
        display: "flex", flexDirection: "column-reverse", gap: 8,
        pointerEvents: "none",
      }}>
        {toasts.map(t => {
          const icon = t.type === "success" ? <Check size={14} strokeWidth={2.5} />
            : t.type === "error" ? <AlertCircle size={14} />
            : <Info size={14} />;
          return (
            <div key={t.id} className={`toast toast-${t.type} ${t.exiting ? "exit" : ""}`}
              style={{ pointerEvents: "auto" }}>
              <span className="toast-icon">{icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button onClick={() => {
                setToasts(prev => prev.map(x => x.id === t.id ? { ...x, exiting: true } : x));
                setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 250);
              }}
                style={{
                  background: "none", border: "none", color: "var(--tx-4)", cursor: "pointer",
                  padding: 2, display: "flex", borderRadius: 4,
                }}>
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
