import { type TodayAppointment } from "@/lib/appointments";

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  return addDays(ymd, -((date.getUTCDay() + 6) % 7));
}

const examples = [
  { day: 0, hour: "09:00", petName: "Luna", petType: "dog", clientName: "Camila Ruiz", serviceName: "Consulta general", staffName: "Dra. Valentina", status: "confirmed" },
  { day: 1, hour: "10:00", petName: "Milo", petType: "cat", clientName: "Andrés Pérez", serviceName: "Control veterinario", staffName: "Dra. Valentina", status: "arrived" },
  { day: 2, hour: "11:00", petName: "Coco", petType: "dog", clientName: "Laura Gómez", serviceName: "Baño y corte", staffName: "Daniela", status: "pending" },
  { day: 3, hour: "14:00", petName: "Nala", petType: "cat", clientName: "Santiago Ríos", serviceName: "Consulta general", staffName: "Dr. Felipe", status: "confirmed" },
  { day: 4, hour: "09:00", petName: "Bruno", petType: "dog", clientName: "Mariana Torres", serviceName: "Vacunación", staffName: "Dra. Valentina", status: "in_progress" },
  { day: 4, hour: "11:00", petName: "Kira", petType: "dog", clientName: "Julián Díaz", serviceName: "Baño y corte", staffName: "Daniela", status: "confirmed" },
  { day: 5, hour: "10:00", petName: "Max", petType: "dog", clientName: "Paula Moreno", serviceName: "Control veterinario", staffName: "Dr. Felipe", status: "pending" },
] as const;

function appointmentsForWeek(mondayYmd: string): TodayAppointment[] {
  return examples.map((example, index) => ({
    id: `ejemplo-${mondayYmd}-${index}`,
    date: new Date(`${addDays(mondayYmd, example.day)}T${example.hour}:00-05:00`).toISOString(),
    status: example.status,
    serviceType: example.serviceName === "Baño y corte" ? "grooming" : "vet",
    petName: example.petName,
    petType: example.petType,
    clientPhone: "",
    clientName: example.clientName,
    petId: null,
    serviceName: example.serviceName,
    staffName: example.staffName,
    finalPrice: null,
    priceResolution: null,
    startedAt: null,
    endedAt: null,
  }));
}

export function previewWeekData(date?: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`))
    ? date
    : today;
  const mondayYmd = mondayOf(selectedDate);

  return {
    weekStart: new Date(`${mondayYmd}T00:00:00-05:00`).toISOString(),
    weekEnd: new Date(`${addDays(mondayYmd, 7)}T00:00:00-05:00`).toISOString(),
    mondayYmd,
    appointments: appointmentsForWeek(mondayYmd),
  };
}

export function previewMonthAppointments(year: number, month: number): TodayAppointment[] {
  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);
  const appointments: TodayAppointment[] = [];

  for (let monday = mondayOf(firstDay); monday < nextMonth; monday = addDays(monday, 7)) {
    appointments.push(...appointmentsForWeek(monday));
  }

  return appointments.filter((appointment) => {
    const date = new Date(new Date(appointment.date).getTime() - 5 * 3_600_000);
    const ymd = date.toISOString().slice(0, 10);
    return ymd >= firstDay && ymd < nextMonth;
  });
}
