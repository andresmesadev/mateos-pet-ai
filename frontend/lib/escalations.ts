export type Escalation = {
  id: string;
  userId: string;
  phone: string | null;
  petName: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  updatedAt: string;
  requiresHumanAttention: boolean;
};

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 60) {
    return "hace un momento";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1 ? "hace 1 minuto" : `hace ${diffMin} minutos`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? "hace 1 hora" : `hace ${diffHours} horas`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
}

export function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  if (phone.startsWith("57") && phone.length > 10) {
    return `+${phone.slice(0, 2)} ${phone.slice(2)}`;
  }
  return phone;
}
