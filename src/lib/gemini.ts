import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getSetting } from "./db";
import { getCategoryLabel } from "./constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContractRisk {
  nivel: "ridicat" | "mediu" | "scăzut";
  clauza: string;
  detaliu: string;
}

export interface ContractAnalysis {
  tip: "cesiune" | "prestari" | "altul";
  numar: string;
  data: string;
  valoare: number;
  parti: { 
    beneficiar: string; 
    beneficiar_cif?: string;
    beneficiar_reg_com?: string;
    beneficiar_iban?: string;
    beneficiar_banca?: string;
    beneficiar_reprezentant?: string;
    prestator: string; 
  };
  riscuri: ContractRisk[];
  rezumat: string;
}

export interface ExtractedReceipt {
  furnizor: string;
  data: string;
  suma: number;
  categorie: string;
  descriere: string;
}

export interface LegislationChange {
  camp: string;
  valoare_noua: number;
  explicatie: string;
}

export interface LegislationAnalysis {
  titlu: string;
  rezumat: string;
  modificari: LegislationChange[];
}

export interface NarrativeParams {
  an: number;
  mode: string;
  totalVenituri: number;
  totalCheltuieli: number;
  venitNet: number;
  totalTaxe: number;
  netEfectiv: number;
  rataRetentie: number;
  invoiceCount: number;
  expenseCount: number;
  topClients: { client_name: string; total: number }[];
  categoryBreakdown: { category: string; total: number }[];
  luniActive: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

export interface GeminiModelInfo {
  name: string;
  display_name: string;
}

async function getApiKey(): Promise<string> {
  const key = await getSetting("gemini_api_key");
  if (!key) throw new Error("Cheia API Gemini nu este configurată. Mergi la Setări → Integrare AI.");
  return key;
}

async function getModel(): Promise<string> {
  return (await getSetting("gemini_model")) || "gemini-2.0-flash";
}

export async function listGeminiModels(): Promise<GeminiModelInfo[]> {
  const apiKey = await getApiKey();
  return invoke<GeminiModelInfo[]>("list_gemini_models", { apiKey });
}

async function callGemini(prompt: string): Promise<string> {
  const [apiKey, model] = await Promise.all([getApiKey(), getModel()]);
  return invoke<string>("call_gemini", { apiKey, model, prompt });
}

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

async function callGeminiChat(messages: ChatMessage[]): Promise<string> {
  const [apiKey, model] = await Promise.all([getApiKey(), getModel()]);
  return invoke<string>("call_gemini_chat", { apiKey, model, messages });
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

// ── Faza 2: Contract analysis ─────────────────────────────────────────────────

const CONTRACT_ANALYSIS_PROMPT = `Ești un asistent juridic specializat în dreptul român. Analizează contractul atașat și returnează EXCLUSIV un obiect JSON valid cu structura de mai jos. Nu adăuga text suplimentar, markdown sau \`\`\`.

{
  "tip": "cesiune" sau "prestari" sau "altul",
  "numar": "numărul contractului sau string gol dacă nu există",
  "data": "YYYY-MM-DD sau string gol dacă nu există",
  "valoare": număr în RON (fără punct sau virgulă) sau 0 dacă nu există,
  "parti": {
    "beneficiar": "numele companiei/persoanei care contractează serviciile",
    "beneficiar_cif": "CIF sau CUI client",
    "beneficiar_reg_com": "Nr. Reg. Comerțului client (ex: J40/...)",
    "beneficiar_iban": "IBAN-ul clientului dacă e menționat",
    "beneficiar_banca": "Banca clientului",
    "beneficiar_reprezentant": "Numele celui care semnează pentru client",
    "prestator": "numele freelancerului/prestatorului dacă există sau string gol"
  },
  "riscuri": [
    {
      "nivel": "ridicat" sau "mediu" sau "scăzut",
      "clauza": "titlul scurt al clauzei problematice (max 60 caractere)",
      "detaliu": "explicație în română de ce această clauză poate fi dezavantajoasă pentru freelancer"
    }
  ],
  "rezumat": "2-3 propoziții care descriu obiectul contractului, durata și condițiile principale"
}

Verifică în special:
- Cesiunea drepturilor pe perioadă nedeterminată sau permanentă → risc ridicat
- Clauze de exclusivitate sau non-compete → risc ridicat
- Termene de plată mai mari de 30 de zile → risc mediu
- Penalități disproporționate pentru prestator → risc ridicat
- Lipsa unui plafon de răspundere → risc mediu
- Clauze de confidențialitate excesiv de restrictive → risc mediu
- Dreptul clientului de a modifica lucrarea fără consimțământ → risc mediu
- Reziliere unilaterală fără compensație → risc ridicat
- Drept de audit intruziv sau acces nerestricționat la sisteme → risc mediu`;

// ── Document analysis from a known file path (no picker) ─────────────────────

export async function analyzeClientContract(filePath: string): Promise<ContractAnalysis> {
  const [apiKey, model] = await Promise.all([getApiKey(), getModel()]);
  const raw = await invoke<string>("analyze_file", { apiKey, model, filePath, prompt: CONTRACT_ANALYSIS_PROMPT });
  return JSON.parse(stripJsonFences(raw));
}

export interface ExtractedInvoice {
  numar: string;
  data: string;        // YYYY-MM-DD
  total: number;
  emitent: string;     // company/person that issued the document
  descriere: string;   // short description of services/goods
  tip: "factura" | "pvr" | "bon" | "altul";
  emitent_cif?: string;
  emitent_reg_com?: string;
  emitent_iban?: string;
  emitent_banca?: string;
}

const INVOICE_ANALYSIS_PROMPT = `Ești un asistent contabil român. Analizează documentul financiar atașat (factură, proces-verbal de recepție, bon, sau alt document financiar) și returnează EXCLUSIV un JSON valid, fără text suplimentar sau markdown:

{
  "numar": "numărul documentului sau string gol dacă nu există",
  "data": "YYYY-MM-DD (data emiterii; string gol dacă nu există)",
  "total": număr în RON fără simbol valoric (ex: 5000.00) sau 0 dacă nu există,
  "emitent": "numele companiei sau persoanei care a emis documentul",
  "descriere": "descriere scurtă a serviciilor/bunurilor facturate, max 120 caractere",
  "tip": "factura" sau "pvr" sau "bon" sau "altul",
  "emitent_cif": "CIF/CUI emitent",
  "emitent_reg_com": "Reg. Com. emitent",
  "emitent_iban": "IBAN emitent",
  "emitent_banca": "Banca emitent"
}`;

export async function analyzeClientInvoice(filePath: string): Promise<ExtractedInvoice> {
  const [apiKey, model] = await Promise.all([getApiKey(), getModel()]);
  const raw = await invoke<string>("analyze_file", { apiKey, model, filePath, prompt: INVOICE_ANALYSIS_PROMPT });
  return JSON.parse(stripJsonFences(raw));
}

export async function pickAndAnalyzeContract(): Promise<{ filePath: string; analysis: ContractAnalysis } | null> {
  const apiKey = await getApiKey();
  const selected = await open({
    title: "Selectează contractul PDF primit de la client",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
    multiple: false,
  });
  if (!selected || typeof selected !== "string") return null;
  const model = await getModel();
  const raw = await invoke<string>("analyze_contract_pdf", { apiKey, model, filePath: selected, prompt: CONTRACT_ANALYSIS_PROMPT });
  return { filePath: selected, analysis: JSON.parse(raw) };
}

// ── Faza 3: Receipt scanning ──────────────────────────────────────────────────

const RECEIPT_PROMPT = `Ești un asistent contabil român. Analizează bonul/chitanța/factura atașată și returnează EXCLUSIV un JSON valid, fără text suplimentar:

{
  "furnizor": "numele furnizorului/magazinului de pe document",
  "data": "YYYY-MM-DD (data de pe document; dacă lipsește folosește data de azi)",
  "suma": număr în RON fără simbol (ex: 299.99),
  "categorie": una din: "echipament", "software", "internet", "transport", "training", "contabil", "spatiu", "marketing", "altele",
  "descriere": "descriere scurtă pentru registrul de cheltuieli (max 80 caractere)"
}

Suma totală = valoarea de plată cu TVA inclus dacă e cazul. Categoria se alege în funcție de ce s-a cumpărat, pentru un freelancer IT/creativ.`;

export async function pickAndAnalyzeReceipt(): Promise<ExtractedReceipt | null> {
  const apiKey = await getApiKey();
  const selected = await open({
    title: "Selectează bonul sau chitanța",
    filters: [{ name: "Documente și imagini", extensions: ["pdf", "jpg", "jpeg", "png", "webp"] }],
    multiple: false,
  });
  if (!selected || typeof selected !== "string") return null;
  const model = await getModel();
  const raw = await invoke<string>("analyze_file", { apiKey, model, filePath: selected, prompt: RECEIPT_PROMPT });
  return JSON.parse(raw);
}

// ── Faza 4: Fiscal assistant ──────────────────────────────────────────────────

export function buildFiscalContext(params: {
  an: number; mode: string; brut: number; exp: number;
  cass: number; cas: number; impozit: number; totalTaxe: number;
  netEfectiv: number; rataRetentie: number; sm: number;
}): string {
  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });
  return `Ești un asistent fiscal român. Cunoști situația utilizatorului pentru ${params.an}:
- Mod de operare: ${params.mode === "dda" ? "DDA (drepturi de autor, forfetar 40%)" : "PFA"}
- Venituri brute: ${fmt(params.brut)} RON
- Cheltuieli deductibile: ${fmt(params.exp)} RON
- CASS (sănătate): ${fmt(params.cass)} RON
- CAS (pensie): ${fmt(params.cas)} RON
- Impozit venit: ${fmt(params.impozit)} RON
- Total taxe: ${fmt(params.totalTaxe)} RON
- Venit net după taxe: ${fmt(params.netEfectiv)} RON
- Rată retenție: ${(params.rataRetentie * 100).toFixed(1)}%
- Salariu minim brut ${params.an}: ${fmt(params.sm)} RON

Răspunde concis și practic în română. Nu da sfaturi juridice formale.`;
}

export async function askFiscalQuestion(question: string, context: string): Promise<string> {
  const prompt = `${context}\n\nÎntrebare: ${question}`;
  return callGemini(prompt);
}

/// Chat version that includes full conversation history
export async function askFiscalQuestionChat(question: string, context: string, history: ChatMessage[]): Promise<string> {
  // Build messages array for Gemini API
  // Format: context goes first as "user" (system instruction), then conversation history, then new question
  const messages: ChatMessage[] = [
    { role: "user", text: `[INSTRUCȚIUNI SISTEM - IGNOREĂ ACEST RĂSPUNS]\n\n${context}` }, // System prompt as first user message
    ...history,
    { role: "user", text: question }
  ];
  return callGeminiChat(messages);
}

// ── Faza 5: Legislation monitor ───────────────────────────────────────────────

const LEGISLATION_PROMPT = `Ești un expert fiscal român. Analizează textul legislativ de mai jos și identifică modificările relevante pentru PFA și DDA (drepturi de autor).

Returnează EXCLUSIV un JSON valid:
{
  "titlu": "titlul actului normativ",
  "rezumat": "ce modifică pe scurt, în 1-2 propoziții",
  "modificari": [
    {
      "camp": "SM_2026" sau "SM_2025" sau "CASS" sau "CAS" sau "IMPOZIT" sau "FORFETAR",
      "valoare_noua": număr (pentru SM = valoare RON, pentru cote = procent ca zecimală ex 0.10 pentru 10%),
      "explicatie": "de ce se modifică și cum afectează freelancerii"
    }
  ]
}

Câmpuri posibile: SM_YYYY (salariu minim pentru un an), CASS (cotă sănătate), CAS (cotă pensie), IMPOZIT (cotă impozit venit), FORFETAR (deducere forfetară DDA).
Dacă nu există modificări relevante, returnează {"titlu": "...", "rezumat": "...", "modificari": []}.`;

export async function analyzeLegislation(text: string): Promise<LegislationAnalysis> {
  const prompt = `${LEGISLATION_PROMPT}\n\nText legislativ:\n${text}`;
  const raw = await callGemini(prompt);
  return JSON.parse(stripJsonFences(raw));
}

// ── Faza 6: Annual narrative ──────────────────────────────────────────────────

export async function generateAnnualNarrative(p: NarrativeParams): Promise<string> {
  const fmt = (n: number) => n.toLocaleString("ro-RO", { minimumFractionDigits: 2 });
  const modeLabel = p.mode === "dda" ? "DDA (drepturi de autor)" : "PFA";
  const topClientsText = p.topClients.slice(0, 3)
    .map(c => `${c.client_name} (${fmt(c.total)} RON)`)
    .join(", ") || "nicio factură înregistrată";
  const categoriesText = p.categoryBreakdown.slice(0, 4)
    .map(c => `${getCategoryLabel(c.category)}: ${fmt(c.total)} RON`)
    .join(", ") || "fără cheltuieli";

  const prompt = `Scrie un rezumat narativ profesional pentru raportul anual al unui freelancer român (${modeLabel}) pentru anul ${p.an}.

Date financiare:
- Venituri totale încasate: ${fmt(p.totalVenituri)} RON din ${p.invoiceCount} facturi
- Cheltuieli deductibile: ${fmt(p.totalCheltuieli)} RON (${p.expenseCount} înregistrări)
- Venit net înainte de taxe: ${fmt(p.venitNet)} RON
- Total taxe plătite: ${fmt(p.totalTaxe)} RON
- Venit net după taxe: ${fmt(p.netEfectiv)} RON
- Rată retenție: ${(p.rataRetentie * 100).toFixed(1)}% (cât rămâne din fiecare leu facturat)
- Luni cu activitate: ${p.luniActive} din 12
- Top clienți: ${topClientsText}
- Cheltuieli pe categorii: ${categoriesText}

Scrie exact 3 paragrafe în română (text continuu, fără titluri, fără bullet points):
1. Performanța generală și evoluția veniturilor
2. Analiza cheltuielilor și eficiența fiscală
3. O observație concretă și o sugestie pentru optimizarea anului următor`;

  return callGemini(prompt);
}
