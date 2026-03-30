import type { ReactNode } from "react";

export default function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--tx-3)", fontWeight: 600,
      textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.02em"
    }}>
      {children}
    </div>
  );
}
