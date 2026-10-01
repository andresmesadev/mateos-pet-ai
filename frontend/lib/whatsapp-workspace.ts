import type { ConversationMessage, DashboardConversation } from "@/lib/conversations";

export function messageAuthorLabel(message: ConversationMessage) {
  if (message.role !== "assistant") return "Cliente";
  if (message.senderKind === "human") return `${message.senderName || "Equipo"} · Equipo`;
  if (message.senderKind === "ai") return "Asistente IA";
  if (message.senderKind === "system" || message.origin === "sistema") return "Sistema";
  return "Saliente histórico · Autor no registrado";
}

export function mergeThreadMessages(previous: ConversationMessage[], incoming: ConversationMessage[]) {
  return [...new Map([...previous, ...incoming].map((message) => [message.id, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function uniqueThreads(rows: DashboardConversation[]) {
  const threads = new Map<string, DashboardConversation>();
  for (const row of [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))) {
    if (!threads.has(row.userId)) threads.set(row.userId, row);
  }
  return [...threads.values()];
}

export function messageDay(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export function normalizeMessageSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CO").trim();
}

export function matchingMessageIds(messages: ConversationMessage[], query: string) {
  const needle = normalizeMessageSearch(query);
  return needle ? messages.filter((message) => normalizeMessageSearch(message.content).includes(needle)).map((message) => message.id) : [];
}

export function threadDateLabel(iso: string | null, now = new Date()) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "";
  const date = new Date(iso);
  if (messageDay(iso) === messageDay(now.toISOString())) return "Hoy";
  if (messageDay(iso) === messageDay(new Date(now.getTime() - 86400000).toISOString())) return "Ayer";
  const year = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", year: "numeric" });
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", ...(year.format(date) !== year.format(now) ? { year: "numeric" } : {}) }).format(date);
}
