# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

**pfa-manager** is a Tauri desktop app for Romanian freelancers managing invoices, contracts, expenses, and fiscal taxes. It supports two legal operating modes:

- **DDA** – Drepturi de Autor (copyright authors): 40% forfeit deduction applied automatically
- **PFA** – Persoană Fizică Autorizată: real or normed expense deductions

The mode affects fiscal calculations, invoice/expense UI, contract templates, and report content throughout the app.

## Commands

```bash
pnpm tauri dev        # Run desktop app in development (starts Vite + Rust backend)
pnpm tauri build      # Build production executable
pnpm dev              # Start Vite dev server only (no desktop window)
pnpm build            # Build frontend only (tsc + vite build)
```

There is no test suite configured.

## Architecture

**Stack:** React 19 + TypeScript + Vite → Tauri 2 (Rust backend) → SQLite (`pfa.db`)

The Rust backend (`src-tauri/src/lib.rs`) only handles Gemini API calls (HTTP via `reqwest`). All other logic lives in the frontend.

```
User Action → Page Component → db.ts → SQLite via tauri-plugin-sql
                    ↓
          Gemini analysis → Rust invoke → Gemini API
```

**Path alias:** `@/*` maps to `src/*`

## Key Directories

- `src/pages/` – One file per feature area (Dashboard, Facturi, Contracte, Cheltuieli, Fiscal, Raport, Declaratie, Setari, Clienti). These are large self-contained components (~20–40KB each).
- `src/lib/` – Pure business logic: `db.ts` (SQLite access layer), `fiscal.ts` (tax calculations), `gemini.ts` (AI integration), `templates.ts` (HTML contract templates), `raport.ts` (report data), `themes.ts`, `constants.ts`.
- `src/components/` – Shared UI: `Layout.tsx` (sidebar nav), `ThemeProvider.tsx`, `GeminiSidebar.tsx` (Ctrl+G AI panel), `Toast.tsx`, `GlobalSearch.tsx`.
- `src/types/index.ts` – All shared TypeScript interfaces (Client, Invoice, Contract, Expense, Settings).
- `src-tauri/src/lib.rs` – Rust: Tauri commands for Gemini file upload and model listing.

## Database

SQLite at `sqlite:pfa.db`. Schema initialized in `db.ts` → `initSchema()`. Tables: `clients`, `invoices`, `contracts`, `expenses`, `settings`.

**Migration approach:** `ALTER TABLE ... ADD COLUMN` wrapped in `try/catch` — no formal migration tool. Foreign key enforcement is ON. Settings are stored as key-value pairs (e.g., `operating_mode`, `invoice_series`, `gemini_api_key`).

When adding new columns, follow the existing pattern: add the column in `initSchema()` inside a try-catch block to handle existing databases gracefully.

## State Management

No global state library. State is React `useState` per page. Settings changes emit a custom DOM event:

```ts
window.dispatchEvent(new CustomEvent('settings-changed'));
```

Components that need to react to settings changes listen for this event in `useEffect`.

## Fiscal Calculations

`src/lib/fiscal.ts` contains all tax logic. Year-specific values (minimum wage `SM`, CASS/CAS rates) are stored in the `settings` table and can be overridden per year in the Setari page. Key constants: `SM` (salariu minim), CASS 10%, CAS 24.75%, income tax 10%.

## AI Integration (Gemini)

- API key stored in Settings (`gemini_api_key`), default model `gemini-2.0-flash`
- Frontend calls `window.__TAURI__.invoke('analyze_with_gemini', ...)` for file analysis
- `src/lib/gemini.ts` – Receipt OCR extraction, contract risk analysis, annual narrative generation, legislation monitoring
- Rust command defined in `src-tauri/src/lib.rs`

## Contract Templates

`src/lib/templates.ts` has three HTML templates: `cesiune`, `cesiune_abonament`, `prestari`. Templates use `{{PLACEHOLDER}}` syntax filled from settings and the contract form. The Lexical editor renders the resulting HTML for final editing before saving.

## Theming

Multiple themes (Ubuntu Dark, Ubuntu Light, etc.) stored in `src/lib/themes.ts`. Applying a theme updates the `data-theme` attribute on `<html>`. CSS uses custom properties (`--ac`, `--bg-base`, etc.) defined per theme.
