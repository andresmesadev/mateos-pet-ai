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
  if (phone.startsWith("NOPHONE_")) return "Sin teléfono";
  // Celular colombiano: 573XXXXXXXXX → +57 3XX XXX XXXX
  if (/^573\d{9}$/.test(phone)) {
    const n = phone.slice(2);
    return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  // Fijo Medellín 604XXXXXXX → (604) XXX XXXX
  if (/^604\d{7}$/.test(phone)) {
    return `(604) ${phone.slice(3, 6)} ${phone.slice(6)}`;
  }
  // Fijo otra área 60XXXXXXXX → (60X) XXX XXXX
  if (/^60\d{8}$/.test(phone)) {
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)} ${phone.slice(6)}`;
  }
  return phone;
}
