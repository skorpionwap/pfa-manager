import { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, X, Sparkles, ClipboardList, DollarSign, FileText } from "lucide-react";
import { askFiscalQuestion } from "@/lib/gemini";

interface Message {
  role: "user" | "ai";
  text: string;
}

interface OfertaGeminiPanelProps {
  open: boolean;
  onClose: () => void;
  quoteContext: string;
  initialHistory?: Message[];
  onApplyToNotes: (text: string) => void;
}

const QUICK_ACTIONS = [
  { icon: Sparkles,      label: "Analizează oferta",           prompt: "Analizează oferta curentă și spune-mi cum o pot face mai atractivă pentru client." },
  { icon: ClipboardList, label: "Sugerează servicii extra",     prompt: "Ce servicii suplimentare ar putea adăuga valoare acestei oferte și ar fi relevante pentru tipul de proiect?" },
  { icon: DollarSign,    label: "Estimare prețuri piață",       prompt: "Prețurile din ofertă sunt competitive pe piața din România pentru acest tip de proiect? Dă-mi o opinie sinceră." },
  { icon: FileText,      label: "Generează condiții standard",  prompt: "Formulează o secțiune de Note și Condiții generale pentru această ofertă — profesionistă, prietenoasă, 4-5 rânduri." },
];

export default function OfertaGeminiPanel({ open, onClose, quoteContext, initialHistory, onApplyToNotes }: OfertaGeminiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Handle open / load history
  useEffect(() => {
    if (open) {
      if (initialHistory && initialHistory.length > 0) {
        setMessages(initialHistory);
      } else if (messages.length === 0) {
        if (quoteContext.includes("TOTAL PROIECT: 0 RON") || quoteContext.includes("(niciun serviciu adăugat încă)")) {
          setMessages([{ role: "ai", text: "Salut! 👋 Sunt asistentul tău inteligent din Libero.\n\nPovestește-mi despre nevoile clientului tău (ex: *„Vrea un site de prezentare pentru o clinică stomatologică și abonament de mentenanță”*) și voi structura automat o ofertă completă pe baza catalogului de servicii!"}]);
        } else {
          runPrompt("Fă o analiză scurtă a ofertei curente și spune-mi 2-3 puncte forte și ce s-ar putea îmbunătăți.");
        }
      }
    } else {
      setMessages([]); // Reset on close so next time it loads fresh
    }
  }, [open]);

  // Dispatch history updates back to parent
  useEffect(() => {
    if (open && messages.length > 0) {
      window.dispatchEvent(new CustomEvent("oferta-gemini-history-change", { detail: { messages } }));
    }
  }, [messages, open]);

  const runPrompt = async (question: string) => {
    if (loading) return;
    setMessages(prev => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const answer = await askFiscalQuestion(question, quoteContext);
      setMessages(prev => [...prev, { role: "ai", text: answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "ai", text: `Eroare: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = () => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    runPrompt(q);
  };

  if (!open) return null;

  return (
    <div style={{
      width: 400, flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "var(--bg-1)", borderLeft: "1px solid var(--border)",
      height: "100vh",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "var(--ac-dim)",
            border: "1px solid var(--ac-glow)", display: "flex", alignItems: "center",
            justifyContent: "center", color: "var(--ac)",
          }}>
            <Bot size={17} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Asistent Ofertă</div>
            <div style={{ fontSize: 10, color: "var(--tx-3)" }}>Context ofertă curentă</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--tx-3)", padding: 6, borderRadius: "var(--r-md)", cursor: "pointer", display: "flex" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Quick actions */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx-4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
          Acțiuni rapide
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => runPrompt(prompt)}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 99,
                border: "1px solid var(--border)", background: "var(--bg-2)",
                color: "var(--tx-2)", fontSize: 11, fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s",
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => {
          const hasConfig = m.role === "ai" && m.text.includes("<config>");
          let cleanText = m.text;
          let configMatch = null;
          
          if (hasConfig) {
            configMatch = m.text.match(/<config>([\s\S]*?)<\/config>/);
            cleanText = m.text.replace(/<config>[\s\S]*?<\/config>/g, "").trim();
          }

          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
              {cleanText && (
                <div style={{
                  maxWidth: "90%",
                  padding: "10px 14px", borderRadius: 14, fontSize: 12, lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  ...(m.role === "user"
                    ? { background: "var(--ac)", color: "#fff", borderBottomRightRadius: 3 }
                    : { background: "var(--bg-2)", color: "var(--tx-1)", border: "1px solid var(--border)", borderBottomLeftRadius: 3 }),
                }}>
                  {cleanText}
                </div>
              )}
              
              {m.role === "ai" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, width: "100%" }}>
                  {/* Buton simplu pt adăugare note */}
                  {!hasConfig && (
                    <button
                      onClick={() => onApplyToNotes(cleanText)}
                      style={{
                        fontSize: 10, fontWeight: 600, color: "var(--tx-3)",
                        background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                        display: "flex", alignItems: "center", gap: 4, alignSelf: "flex-start"
                      }}
                    >
                      ↓ Adaugă la note
                    </button>
                  )}
                  
                  {/* Card premium cu actiune vizibila clar pentru aplicare Ofertă */}
                  {hasConfig && configMatch && configMatch[1] && (
                    <div style={{ 
                      background: "var(--ac-dim)", border: "1px solid var(--ac-glow)", 
                      borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10,
                      maxWidth: "95%", alignSelf: "flex-start", marginTop: 4
                     }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--ac)" }}>
                        <Sparkles size={14} /> Ofertă structurată cu succes!
                      </div>
                      <div style={{ fontSize: 11, color: "var(--tx-2)", lineHeight: 1.4 }}>
                        Inteligența Artificială a compus serviciile, abonamentul și costurile pe baza discuției.
                        Apasă pe butonul de mai jos pentru a transfera datele în formularul de Ofertă.
                      </div>
                      <button
                        onClick={() => {
                          try {
                            const config = JSON.parse(configMatch![1]);
                            window.dispatchEvent(new CustomEvent("oferta-gemini-note", { detail: { config } }));
                          } catch(e) {
                            console.error("Failed to parse AI config", e);
                          }
                        }}
                        className="btn btn-primary"
                        style={{ width: "100%", padding: "10px 0", justifyContent: "center", fontSize: 13, fontWeight: 700, gap: 6 }}
                      >
                        🚀 Transferă datele în Ofertă
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 3,
              background: "var(--bg-2)", border: "1px solid var(--border)",
              fontSize: 12, color: "var(--tx-3)",
            }}>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              Se analizează...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <div style={{ position: "relative" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Pune o întrebare despre această ofertă..."
            rows={1}
            style={{
              width: "100%", minHeight: 40, background: "var(--bg-base)",
              border: "1px solid var(--border)", borderRadius: 14,
              padding: "10px 40px 10px 14px", fontSize: 12, color: "var(--tx-1)",
              fontFamily: "inherit", outline: "none", resize: "none",
              overflowY: "auto", boxSizing: "border-box",
            }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "40px";
              t.style.height = Math.min(t.scrollHeight, 100) + "px";
            }}
            onFocus={e => (e.target.style.borderColor = "var(--ac)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              position: "absolute", right: 4, top: 4, width: 32, height: 32,
              borderRadius: "50%", background: "var(--ac)", border: "none", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              opacity: loading || !input.trim() ? 0.4 : 1, transition: "opacity 0.15s",
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
          </button>
        </div>
        <div style={{ marginTop: 6, textAlign: "center", fontSize: 9, color: "var(--tx-4)" }}>
          Enter trimite · Shift+Enter rând nou
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
