export type PetType = "dog" | "cat" | "other" | string;

export type MedicalRecordType =
  | "allergy"
  | "vaccine"
  | "consultation"
  | "note";

export type DashboardPet = {
  id: string;
  name: string;
  type: PetType;
  breed: string | null;
  gender: string | null;
  birthDate: string | null;
  weight: number | null;
  sterilized: boolean | null;
  notes: string | null;
  owner: {
    phone: string;
  };
  _count: {
    medicalRecords: number;
    appointments: number;
  };
};

export type PetMedicalRecord = {
  id: string;
  type: MedicalRecordType;
  title: string;
  detail: string | null;
  date: string | null;
  createdAt: string;
  // Clinical fields (TAREA 10)
  appointmentId?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  reason?: string | null;
  findings?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  recommendations?: string | null;
  weight?: number | null;
  nextControlAt?: string | null;
  updatedAt?: string;
};

export const PET_TYPE_LABELS: Record<string, string> = {
  dog: "Perro",
  cat: "Gato",
  other: "Otro",
};

export const MEDICAL_SECTIONS: {
  type: MedicalRecordType;
  emoji: string;
  label: string;
}[] = [
  { type: "allergy", emoji: "🤧", label: "Alergias" },
  { type: "vaccine", emoji: "💉", label: "Vacunas" },
  { type: "consultation", emoji: "🩺", label: "Consultas" },
  { type: "note", emoji: "📝", label: "Notas" },
];

export function getPetEmoji(type: PetType): string {
  switch (type?.toLowerCase()) {
    case "dog":
      return "🐶";
    case "cat":
      return "🐱";
    default:
      return "🐰";
  }
}

export function formatPetType(type: PetType): string {
  return PET_TYPE_LABELS[type?.toLowerCase()] ?? type ?? "Otro";
}

export function formatPhone(phone: string): string {
  if (!phone) return "—";
  if (phone.length <= 4) return phone;
  return phone;
}

export function formatRecordDate(iso: string | null): string {
  if (!iso) return "—";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export type TimelineItemKind =
  | "consultation"
  | "grooming"
  | "other_appt"
  | "vaccine"
  | "deworming"
  | "exam"
  | "image"
  | "treatment"
  | "allergy"
  | "note"
  | "cancelled"
  | "no_show"
  | "next_action"
  | string;

export type TimelineItem = {
  id: string;
  kind: TimelineItemKind;
  date: string;
  title: string;
  // appointment
  appointmentId: string | null;
  appointmentStatus: string | null;
  serviceType: string | null;
  serviceName: string | null;
  // clinical / record
  staffName: string | null;
  recordId: string | null;
  reason: string | null;
  findings: string | null;
  diagnosis: string | null;
  treatment: string | null;
  recommendations: string | null;
  weight: number | null;
  nextControlAt: string | null;
  detail: string | null;
};

export type NextAction = {
  id: string;
  kind: "next_action";
  date: string;
  title: string;
  detail: string | null;
};

export type PetTimeline = {
  items: TimelineItem[];
  nextActions: NextAction[];
};

export function groupRecordsByType(
  records: PetMedicalRecord[]
): Record<MedicalRecordType, PetMedicalRecord[]> {
  const grouped: Record<MedicalRecordType, PetMedicalRecord[]> = {
    allergy: [],
    vaccine: [],
    consultation: [],
    note: [],
  };

  for (const record of records) {
    const type = record.type?.toLowerCase() as MedicalRecordType;

    if (grouped[type]) {
      grouped[type].push(record);
    }
  }

  return grouped;
}
