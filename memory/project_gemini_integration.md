---
name: Gemini AI Integration
description: Gemini AI integrated for contract PDF analysis in pfa-manager
type: project
---

Gemini AI (gemini-2.0-flash) integrated into pfa-manager using Approach A (Tauri Rust backend).

**Architecture:** Frontend React → Tauri invoke → Rust command `analyze_contract_pdf` → Gemini REST API

**Key files added/modified:**
- `src-tauri/src/lib.rs` — Rust command, reqwest HTTP client, base64 PDF encoding
- `src-tauri/Cargo.toml` — added: reqwest (rustls-tls), base64, tauri-plugin-dialog
- `src-tauri/capabilities/default.json` — added dialog:default, dialog:allow-open
- `src/lib/gemini.ts` — TypeScript helper: pickAndAnalyzeContract(), ContractAnalysis type
- `src/pages/Contracte.tsx` — "Analizează PDF client" button, analysis modal with risk display, importAnalysis()
- `src/pages/Setari.tsx` — "Integrare AI" card with gemini_api_key password field
- `src/types/index.ts` — added "pending" to Contract.status union type

**API key storage:** gemini_api_key stored in SQLite settings table (existing key-value system)

**User flow:** Click "Analizează PDF client" → file picker (PDF only) → Gemini analyzes → modal shows extracted data + risk clauses → "Creează contract (spre aprobare)" → contract form pre-filled with status=pending

**Contract statuses now:** activ | expirat | reziliat | pending (displayed as "spre aprobare")

**Why:** User operates as DDA (no invoices, only contracts). Gemini helps identify unfavorable clauses in client-provided contracts.
