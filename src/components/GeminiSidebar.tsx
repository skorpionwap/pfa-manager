import { useState, useEffect, useRef } from "react";
import { Bot, Send, Loader2, X, MessageSquare, Info } from "lucide-react";
import { getDb, getSetting, isTauri } from "@/lib/db";
import { askFiscalQuestion } from "@/lib/gemini";

interface Message {
  role: "user" | "ai";
  text: string;
}

export default function GeminiSidebar({ 
  open, 
  onClose, 
}: { 
  open: boolean; 
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const buildGlobalContext = async () => {
    if (!isTauri()) return "Ești într-un mod limitat (Web Demo). Recomandările sunt generale.";
    
    try {
      const db = await getDb();
      const mode = await getSetting("operating_mode");
      const an = new Date().getFullYear();
      
      const invoices = await db.select<{ total: number; count: number }[]>(
        "SELECT SUM(total) as total, COUNT(*) as count FROM invoices WHERE status = 'paid' AND date LIKE ?", [`${an}%`]
      );
      const expenses = await db.select<{ total: number; count: number }[]>(
        "SELECT SUM(amount) as total, COUNT(*) as count FROM expenses WHERE date LIKE ?", [`${an}%`]
      );
      const clients = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM clients");

      return `Ești un asistent inteligent integrat în aplicația "PFA Manager" a utilizatorului. 
Utilizatorul operează în mod ${mode === 'dda' ? 'Drepturi de Autor (DDA)' : 'PFA'}.
Statistici curente pe anul ${an}:
- Venituri încasate: ${invoices[0]?.total?.toLocaleString("ro-RO") || 0} RON (${invoices[0]?.count || 0} facturi)
- Cheltuieli înregistrate: ${expenses[0]?.total?.toLocaleString("ro-RO") || 0} RON (${expenses[0]?.count || 0} înregistrări)
- Număr total clienți: ${clients[0]?.count || 0}

Poți oferi sfaturi despre optimizare fiscală, cum să gestioneze facturile, clienții sau cheltuielile în cadrul aplicației.
Răspunde concis, prietenos și util în limba română.`;
    } catch (e) {
      console.error(e);
      return "Eroare la preluarea contextului local.";
    }
  };

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const context = await buildGlobalContext();
      const answer = await askFiscalQuestion(q, context);
      setMessages(prev => [...prev, { role: "ai", text: answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "ai", text: `Eroare: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <aside className="gemini-sidebar">
      <div className="gemini-header">
        <div className="gemini-header-title">
          <div className="gemini-icon-box">
            <Bot size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Asistent Gemini</div>
            <div style={{ fontSize: 10, color: "var(--tx-3)" }}>
              AI Activ
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="gemini-close-btn" onClick={onClose} title="Închide">
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="gemini-content" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="gemini-empty">
            <div className="gemini-empty-icon">
              <MessageSquare size={28} />
            </div>
            <h3>Cu ce te pot ajuta azi?</h3>
            <p>Îmi poți pune orice întrebare despre situația ta financiară, facturi sau optimizări fiscale.</p>
            
            <div className="gemini-suggestions">
              <button onClick={() => setInput("Cum stau cu taxele pe anul ăsta?")}>Cum stau cu taxele pe anul ăsta?</button>
              <button onClick={() => setInput("Cum pot deduce mai multe cheltuieli?")}>Cum deduc mai multe cheltuieli?</button>
              <button onClick={() => setInput("Analizează-mi profitabilitatea.")}>Analizează profitabilitatea.</button>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`gemini-msg ${m.role}`}>
            <div className="gemini-msg-bubble">
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="gemini-msg ai loading">
            <div className="gemini-msg-bubble">
              <Loader2 size={16} className="spin" />
              Se gândește...
            </div>
          </div>
        )}
      </div>

      <div className="gemini-footer">
        <div style={{ position: "relative" }}>
          <textarea 
            className="gemini-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Întreabă orice..."
            rows={1}
            style={{ resize: "none", overflowY: "auto" }}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "42px";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button 
            className="gemini-send-btn" 
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Send size={15} />}
          </button>
        </div>
        <div className="gemini-footer-note">
          <Info size={10} /> Verifică informațiile critice.
        </div>
      </div>

      <style>{`
        .gemini-sidebar {
          width: 500px; height: 100vh;
          background: var(--bg-1); border-left: 1px solid var(--border);
          display: flex; flex-direction: column; 
          flex-shrink: 0;
          position: relative;
          z-index: 1001;
        }
        
        .gemini-header {
          padding: 14px 18px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          background: var(--bg-2);
        }
        .gemini-header-title { display: flex; align-items: center; gap: 10px; }
        .gemini-icon-box {
          width: 32px; height: 32px; border-radius: 8px; background: var(--ac-dim);
          border: 1px solid var(--ac-glow); display: flex; align-items: center;
          justify-content: center; color: var(--ac);
        }
        .gemini-close-btn {
          background: transparent; border: none; color: var(--tx-3);
          padding: 6px; border-radius: var(--r-md); transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .gemini-close-btn:hover { background: var(--bg-3); color: var(--tx-1); }

        .gemini-content {
          flex: 1; overflow-y: auto; padding: 18px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .gemini-empty {
          margin-top: 32px; text-align: center; padding: 0 16px;
        }
        .gemini-empty-icon {
          width: 56px; height: 56px; border-radius: 16px; background: var(--bg-2);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
          color: var(--tx-4); border: 1px solid var(--border);
        }
        .gemini-empty h3 { font-size: 16px; margin-bottom: 8px; color: var(--tx-1); }
        .gemini-empty p { font-size: 12px; color: var(--tx-3); line-height: 1.5; }
        
        .gemini-suggestions { margin-top: 20px; display: flex; flex-direction: column; gap: 6px; }
        .gemini-suggestions button {
          background: var(--bg-2); border: 1px solid var(--border);
          padding: 8px 12px; border-radius: var(--r-md); text-align: left;
          font-size: 12px; color: var(--tx-2); transition: all 0.15s;
        }
        .gemini-suggestions button:hover { background: var(--bg-hover); border-color: var(--border-md); color: var(--tx-1); }

        .gemini-msg { display: flex; flex-direction: column; max-width: 90%; }
        .gemini-msg.user { align-self: flex-end; }
        .gemini-msg.ai { align-self: flex-start; }
        
        .gemini-msg-bubble {
          padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.6;
          white-space: pre-wrap;
        }
        .gemini-msg.user .gemini-msg-bubble { background: var(--ac); color: #fff; border-bottom-right-radius: 2px; }
        .gemini-msg.ai .gemini-msg-bubble { background: var(--bg-2); color: var(--tx-1); border: 1px solid var(--border); border-bottom-left-radius: 2px; }
        
        .gemini-msg.loading .gemini-msg-bubble { display: flex; align-items: center; gap: 8px; color: var(--tx-3); }
        .spin { animation: spin 1s linear infinite; }

        .gemini-footer {
          padding: 14px 18px; border-top: 1px solid var(--border);
          background: var(--bg-2);
        }
        .gemini-input {
          width: 100%; min-height: 42px; background: var(--bg-base);
          border: 1px solid var(--border); border-radius: 16px;
          padding: 10px 42px 10px 14px; font-size: 13px; color: var(--tx-1);
          font-family: inherit; outline: none; transition: border-color 0.2s;
        }
        .gemini-input:focus { border-color: var(--ac); }
        .gemini-send-btn {
          position: absolute; right: 4px; top: 4px; width: 34px; height: 34px;
          border-radius: 50%; background: var(--ac); border: none; color: #fff;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .gemini-send-btn:hover { background: var(--ac-hover); }
        .gemini-send-btn:disabled { background: var(--bg-3); color: var(--tx-4); }

        .gemini-footer-note {
          margin-top: 8px; text-align: center; font-size: 9px; color: var(--tx-4);
          display: flex; align-items: center; justify-content: center; gap: 4px;
        }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  );
}
