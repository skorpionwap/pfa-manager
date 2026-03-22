import type { OperatingMode, PfaMode } from "@/types";

export const FISCAL = {
  2025: { SM: 4050, label: "Realizat 2025", declarare: "25 mai 2026", desc: "Plată datorată ACUM" },
  2026: { SM: 4200, label: "Estimat 2026", declarare: "25 mai 2027", desc: "Activitate curentă" },
} as const;

/** Valori default — folosite dacă utilizatorul nu le suprascrie în Setări */
export const FISCAL_DEFAULTS = {
  CASS: 0.10,
  CAS: 0.25,
  IMPOZIT: 0.10,
  FORFETAR: 0.40,
} as const;

export type An = keyof typeof FISCAL;

export interface FiscalOverrides {
  SM?: number;
  CASS?: number;
  CAS?: number;
  IMPOZIT?: number;
  FORFETAR?: number;
}

export interface CalculeResult {
  brutAnual: number;
  cheltuieliDeductibile: number;
  venitNet: number;
  impozit: number;
  cass: number;
  cassBase: number;
  cassNivel: string;
  cas: number;
  casBase: number;
  casNivel: string;
  casObligatoriu: boolean;
  totalTaxe: number;
  netEfectiv: number;
  rataRetentie: number;
  sm: number;
}

export function calculeaza(
  brutAnual: number,
  expenses: number,
  an: An,
  mode: OperatingMode,
  pfaMode: PfaMode,
  normaValue: number,
  areSalariu: boolean,
  casBifat: boolean,
  overrides: FiscalOverrides = {},
): CalculeResult {
  const SM = overrides.SM ?? FISCAL[an].SM;
  const rCASS = overrides.CASS ?? FISCAL_DEFAULTS.CASS;
  const rCAS = overrides.CAS ?? FISCAL_DEFAULTS.CAS;
  const rIMPOZIT = overrides.IMPOZIT ?? FISCAL_DEFAULTS.IMPOZIT;
  const rFORFETAR = overrides.FORFETAR ?? FISCAL_DEFAULTS.FORFETAR;

  let venitNet = 0;
  let cheltuieliDeductibile = 0;

  if (mode === "dda") {
    cheltuieliDeductibile = brutAnual * rFORFETAR;
    venitNet = brutAnual - cheltuieliDeductibile;
  } else {
    if (pfaMode === "real") {
      cheltuieliDeductibile = expenses;
      venitNet = Math.max(0, brutAnual - cheltuieliDeductibile);
    } else {
      venitNet = normaValue;
      cheltuieliDeductibile = 0;
    }
  }

  const p6 = 6 * SM;
  const p12 = 12 * SM;
  const p24 = 24 * SM;
  const p60 = 60 * SM;

  // ── CASS (Sănătate) ────────────────────────────────────────────────────────
  let cassBase = 0;
  let cassNivel = "";

  if (mode === "dda") {
    if (areSalariu && venitNet < p6) {
      cassBase = 0;
      cassNivel = "Scutit (Salariat & sub 6 SM)";
    } else {
      if (venitNet < p6) {
         cassBase = 0;
         cassNivel = "Sub prag 6 SM";
      } else if (venitNet < p12) {
        cassBase = p6;
        cassNivel = "Plafon 6 SM";
      } else if (venitNet < p24) {
        cassBase = p12;
        cassNivel = "Plafon 12 SM";
      } else {
        cassBase = p24;
        cassNivel = "Plafon 24 SM (Max)";
      }
    }
  } else {
    let bazaCASS = venitNet;
    if (venitNet > p60) {
      bazaCASS = p60;
      cassNivel = "Plafonat la 60 SM (Max)";
    } else if (venitNet < p6) {
      if (areSalariu) {
        bazaCASS = venitNet;
        cassNivel = "Venit real (Salariat)";
      } else {
        bazaCASS = p6;
        cassNivel = "Minim 6 SM (Neasigurat)";
      }
    } else {
      cassNivel = `${(rCASS * 100).toFixed(0)}% din Venit Net`;
    }
    cassBase = bazaCASS;
  }
  const cass = cassBase * rCASS;

  // ── CAS (Pensie) ───────────────────────────────────────────────────────────
  let casBase = 0;
  let casNivel = "";
  let casObligatoriu = false;

  if (venitNet < p12) {
    casBase = casBifat ? p12 : 0;
    casNivel = casBifat ? "Opțional (12 SM)" : "Sub prag obligatoriu";
  } else if (venitNet < p24) {
    casBase = p12;
    casNivel = "Plafon 12 SM";
    casObligatoriu = true;
  } else {
    casBase = p24;
    casNivel = "Plafon 24 SM (Max)";
    casObligatoriu = true;
  }
  const cas = casBase * rCAS;

  // ── Impozit pe venit ───────────────────────────────────────────────────────
  let impozitFinal = 0;
  if (mode === "pfa" && pfaMode === "real") {
    const venitImpozabil = Math.max(0, venitNet - cas - cass);
    impozitFinal = venitImpozabil * rIMPOZIT;
  } else if (mode === "pfa" && pfaMode === "norma") {
    impozitFinal = normaValue * rIMPOZIT;
  } else {
    impozitFinal = venitNet * rIMPOZIT;
  }

  const totalTaxe = impozitFinal + cass + cas;
  let netEfectiv = mode === "dda" ? (brutAnual - totalTaxe) : (mode === "pfa" && pfaMode === "real" ? (brutAnual - expenses - totalTaxe) : (brutAnual - totalTaxe));
  const rataRetentie = brutAnual > 0 ? (netEfectiv / brutAnual * 100) : 0;

  return {
    brutAnual, cheltuieliDeductibile, venitNet, impozit: impozitFinal,
    cass, cassBase, cassNivel,
    cas, casBase, casNivel, casObligatoriu,
    totalTaxe, netEfectiv, rataRetentie,
    sm: SM,
  };
}
