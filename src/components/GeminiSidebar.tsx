import { useState, useEffect, useRef } from "react";
import { Bot, Send, Loader2, X, MessageSquare, Info, Plus, Trash2, Edit2, Check, MessageSquareMore } from "lucide-react";
import { getDb, getSetting, isTauri, getChatSessions, getChatSession, createChatSession, updateChatSession, deleteChatSession, renameChatSession, type ChatSession } from "@/lib/db";
import { askFiscalQuestionChat, type ChatMessage } from "@/lib/gemini";

interface GeminiSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function GeminiSidebar({ open, onClose }: GeminiSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [sessionsVisible, setSessionsVisible] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll la mesaje noi
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Încarcă sesiunile la deschidere
  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open]);

  // Încarcă mesajele pentru sesiunea activă
  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const sess = await getChatSessions();
      setSessions(sess);
      // Dacă nu avem sesiune activă dar avem sesiuni, activează prima
      if (!activeSessionId && sess.length > 0) {
        setActiveSessionId(sess[0].id);
      }
    } catch (e) {
      console.error("Eroare la încărcarea sesiunilor:", e);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSessionMessages(id: number) {
    try {
      const session = await getChatSession(id);
      if (session) {
        const parsed = JSON.parse(session.messages);
        setMessages(parsed);
      }
    } catch (e) {
      console.error("Eroare la încărcarea mesajelor:", e);
      setMessages([]);
    }
  }

  async function createNewSession() {
    try {
      const id = await createChatSession();
      await loadSessions();
      setActiveSessionId(id);
    } catch (e) {
      console.error("Eroare la crearea sesiunii:", e);
    }
  }

  async function deleteSession(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Ștergi această conversație?")) return;
    try {
      await deleteChatSession(id);
      await loadSessions();
      if (activeSessionId === id) {
        setActiveSessionId(sessions.length > 1 ? sessions.find(s => s.id !== id)?.id ?? null : null);
      }
    } catch (e) {
      console.error("Eroare la ștergerea sesiunii:", e);
    }
  }

  async function saveMessages() {
    if (activeSessionId) {
      await updateChatSession(activeSessionId, JSON.stringify(messages));
      await loadSessions(); // Refresh pentru updated_at
    }
  }

  async function startEditingTitle(id: number, currentTitle: string) {
    setEditingTitle(id);
    setNewTitle(currentTitle);
  }

  async function saveTitle(id: number) {
    if (newTitle.trim()) {
      await renameChatSession(id, newTitle.trim());
      await loadSessions();
    }
    setEditingTitle(null);
    setNewTitle("");
  }

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

      return `Ești un asistent inteligent integrat în aplicația "Libero" a utilizatorului.
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

    const newUserMsg: ChatMessage = { role: "user", text: q };
    setMessages(prev => [...prev, newUserMsg]);
    setInput("");
    setLoading(true);

    try {
      const context = await buildGlobalContext();
      // Trimite mesajele curente (fără cel nou - va fi adăugat de frontend)
      const answer = await askFiscalQuestionChat(q, context, messages);
      const newAiMsg: ChatMessage = { role: "ai", text: answer };
      setMessages(prev => [...prev, newAiMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = { role: "ai", text: `Eroare: ${e instanceof Error ? e.message : String(e)}` };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Salvare automată după ce se termină de încărcat mesajele
  useEffect(() => {
    if (!loading && messages.length > 0) {
      saveMessages();
    }
  }, [messages, loading]);

  if (!open) return null;

  return (
    <div style={{ width: 450, display: "flex", background: "var(--bg-1)", borderLeft: "1px solid var(--border)", height: "100vh" }}>
      {/* Zona de chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--ac-dim)", border: "1px solid var(--ac-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ac)" }}>
              <Bot size={17} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Asistent Gemini</div>
              <div style={{ fontSize: 10, color: "var(--tx-3)" }}>{activeSessionId ? "Sesiune salvată" : "Fără sesiune selectată"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setSessionsVisible(!sessionsVisible)}
              style={{ background: "none", border: "1px solid var(--border)", color: "var(--tx-2)", padding: 6, borderRadius: "var(--r-md)", cursor: "pointer" }}
              title={sessionsVisible ? "Ascunde conversații" : "Arată conversații"}
            >
              <MessageSquareMore size={14} />
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tx-3)", padding: 6, borderRadius: "var(--r-md)", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Mesaje */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          {!activeSessionId ? (
            <div style={{ marginTop: 60, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--tx-4)", border: "1px solid var(--border)" }}>
                <MessageSquareMore size={28} />
              </div>
              <h3 style={{ fontSize: 16, margin: "0 0 8px", color: "var(--tx-1)" }}>Selectează o conversație</h3>
              <p style={{ fontSize: 12, color: "var(--tx-3)" }}>Sau creează una nouă cu butonul +</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ marginTop: 32, textAlign: "center", padding: "0 16px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--tx-4)", border: "1px solid var(--border)" }}>
                <MessageSquare size={28} />
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: "var(--tx-1)" }}>Cu ce te pot ajuta?</h3>
              <p style={{ fontSize: 12, color: "var(--tx-3)", marginBottom: 16 }}>Îmi poți pune orice întrebare despre situația ta financiară, facturi sau optimizări fiscale.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={() => setInput("Cum stau cu taxele pe anul ăsta?")} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "var(--r-md)", textAlign: "left", fontSize: 12, color: "var(--tx-2)", cursor: "pointer" }}>
                  Cum stau cu taxele pe anul ăsta?
                </button>
                <button onClick={() => setInput("Cum pot deduce mai multe cheltuieli?")} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "var(--r-md)", textAlign: "left", fontSize: 12, color: "var(--tx-2)", cursor: "pointer" }}>
                  Cum deduc mai multe cheltuieli?
                </button>
                <button onClick={() => setInput("Analizează-mi profitabilitatea.")} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "var(--r-md)", textAlign: "left", fontSize: 12, color: "var(--tx-2)", cursor: "pointer" }}>
                  Analizează profitabilitatea.
                </button>
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{
                  padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  ...(m.role === "user"
                    ? { background: "var(--ac)", color: "#fff", borderBottomRightRadius: 2 }
                    : { background: "var(--bg-2)", color: "var(--tx-1)", border: "1px solid var(--border)", borderBottomLeftRadius: 2 }),
                }}>
                  {m.text}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 2, background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: 12, color: "var(--tx-3)" }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                Se gândește...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
          <div style={{ position: "relative" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder={!activeSessionId ? "Selectează o conversație..." : "Întreabă orice..."}
              rows={1}
              disabled={!activeSessionId}
              style={{
                width: "100%", minHeight: 42, background: "var(--bg-base)",
                border: "1px solid var(--border)", borderRadius: 16,
                padding: "10px 42px 10px 14px", fontSize: 12, color: "var(--tx-1)",
                fontFamily: "inherit", outline: "none", resize: "none",
                opacity: !activeSessionId ? 0.5 : 1,
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "42px";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim() || !activeSessionId}
              style={{
                position: "absolute", right: 4, top: 4, width: 34, height: 34,
                borderRadius: "50%", background: "var(--ac)", border: "none", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: loading || !input.trim() || !activeSessionId ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() || !activeSessionId ? 0.4 : 1,
              }}
            >
              {loading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
            </button>
          </div>
          <div style={{ marginTop: 8, textAlign: "center", fontSize: 9, color: "var(--tx-4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Info size={10} /> Verifică informațiile critice.
          </div>
        </div>
      </div>

      {/* Sidebar cu sesiuni - în dreapta, collapsible */}
      {sessionsVisible && (
        <div style={{ width: 180, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg-2)" }}>
          {/* Header sesiuni */}
          <div style={{ padding: "14px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-1)" }}>Conversații</div>
              <button
                onClick={createNewSession}
                style={{ background: "var(--ac)", border: "none", color: "#fff", padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                title="Conversație nouă"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Lista sesiuni */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {sessionsLoading ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "var(--tx-3)" }}>Se încarcă...</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "var(--tx-3)" }}>
                Nicio conversație.<br />Apasă + pentru a crea una.
              </div>
            ) : (
              sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    marginBottom: 4,
                    cursor: "pointer",
                    background: activeSessionId === session.id ? "var(--ac-dim)" : "transparent",
                    border: activeSessionId === session.id ? "1px solid var(--ac-glow)" : "1px solid transparent",
                  }}
                >
                  {editingTitle === session.id ? (
                    <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveTitle(session.id)}
                        autoFocus
                        style={{ flex: 1, fontSize: 11, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-1)" }}
                      />
                      <button onClick={() => saveTitle(session.id)} style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", padding: 2 }}>
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ flex: 1, fontSize: 11, color: "var(--tx-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {session.title}
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        <button
                          onClick={e => { e.stopPropagation(); startEditingTitle(session.id, session.title); }}
                          style={{ background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer", padding: 2, opacity: activeSessionId === session.id ? 1 : 0.5 }}
                        >
                          <Edit2 size={10} />
                        </button>
                        <button
                          onClick={e => deleteSession(session.id, e)}
                          style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", padding: 2, opacity: activeSessionId === session.id ? 1 : 0.5 }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: "var(--tx-3)", marginTop: 4 }}>
                    {new Date(session.updated_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
