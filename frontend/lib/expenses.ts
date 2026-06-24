export type ExpenseCategory =
  | "supplies"
  | "utilities"
  | "rent"
  | "salary"
  | "equipment"
  | "marketing"
  | "other";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  supplies:  "Insumos",
  utilities: "Servicios",
  rent:      "Arriendo",
  salary:    "Nómina",
  equipment: "Equipos",
  marketing: "Marketing",
  other:     "Otro",
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  supplies:  "bg-orange-500/15 text-orange-400",
  utilities: "bg-blue-500/15 text-blue-400",
  rent:      "bg-purple-500/15 text-purple-400",
  salary:    "bg-pink-500/15 text-pink-400",
  equipment: "bg-cyan-500/15 text-cyan-400",
  marketing: "bg-yellow-500/15 text-yellow-400",
  other:     "bg-slate-500/15 text-slate-400",
};

export type Expense = {
  id: string;
  tenantId: string | null;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
};
