export const CATEGORIES = [
  { value: "echipament",     label: "Echipament IT" },
  { value: "software",      label: "Software / Licențe" },
  { value: "internet",      label: "Internet / Telefon" },
  { value: "transport",     label: "Transport / Deplasare" },
  { value: "training",      label: "Formare / Cursuri" },
  { value: "contabil",      label: "Servicii contabile" },
  { value: "spatiu",        label: "Spațiu de lucru" },
  { value: "marketing",     label: "Marketing / Publicitate" },
  { value: "altele",        label: "Altele" },
] as const;

export const CATEGORY_BADGE: Record<string, string> = {
  echipament:  "badge badge-muted",
  software:    "badge badge-blue",
  internet:    "badge badge-green",
  transport:   "badge badge-yellow",
  training:    "badge badge-purple",
  contabil:    "badge badge-muted",
  spatiu:      "badge badge-yellow",
  marketing:   "badge badge-blue",
  altele:      "badge badge-muted",
  generic:     "badge badge-muted",
};

export const MONTH_LABELS: Record<string, string> = {
  "01": "Ianuarie", "02": "Februarie", "03": "Martie", "04": "Aprilie",
  "05": "Mai",      "06": "Iunie",    "07": "Iulie",  "08": "August",
  "09": "Septembrie","10": "Octombrie", "11": "Noiembrie","12": "Decembrie",
};

export function getCategoryLabel(val: string): string {
  return CATEGORIES.find(c => c.value === val)?.label ?? val;
}
