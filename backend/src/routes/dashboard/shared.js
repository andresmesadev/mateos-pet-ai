// Utilidades compartidas entre todos los subrouters del dashboard

const BOGOTA_OFFSET_MS = 5 * 3600 * 1000; // UTC-5

function getBogotaYmd() {
  const bogota = new Date(Date.now() - BOGOTA_OFFSET_MS);
  return bogota.toISOString().slice(0, 10);
}

function bogotaDayStart(ymd) {
  return new Date(`${ymd}T05:00:00.000Z`);
}

const APPOINTMENT_INCLUDE = {
  user: { select: { phone: true, name: true } },
  pet: { select: { name: true, type: true } },
  service: { select: { name: true } },
  staff: { select: { name: true } },
};

function mapAppointmentRow(a) {
  return {
    id: a.id,
    date: a.date,
    status: a.status,
    serviceType: a.serviceType,
    petName: a.pet?.name ?? a.petName,
    petType: a.pet?.type ?? a.petType,
    clientPhone: a.user?.phone ?? "",
    clientName: a.user?.name ?? null,
    petId: a.petId ?? null,
    serviceName: a.service?.name ?? null,
    staffName: a.staff?.name ?? null,
    finalPrice: a.finalPrice !== null && a.finalPrice !== undefined ? Number(a.finalPrice) : null,
    startedAt: a.startedAt?.toISOString() ?? null,
    endedAt: a.endedAt?.toISOString() ?? null,
  };
}

function mapMedicalRecord(r) {
  return {
    id: r.id,
    appointmentId: r.appointmentId ?? null,
    staffId: r.staffId ?? null,
    staffName: r.staff?.name ?? null,
    type: r.type,
    title: r.title,
    detail: r.detail ?? null,
    date: r.date?.toISOString() ?? null,
    reason: r.reason ?? null,
    findings: r.findings ?? null,
    diagnosis: r.diagnosis ?? null,
    treatment: r.treatment ?? null,
    recommendations: r.recommendations ?? null,
    weight: r.weight ?? null,
    nextControlAt: r.nextControlAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
  };
}

function appointmentKind(appt) {
  const st = (appt.serviceType ?? "").toLowerCase();
  const cat = (appt.service?.category ?? "").toLowerCase();
  if (appt.status === "cancelled") return "cancelled";
  if (appt.status === "no_show") return "no_show";
  if (cat === "veterinary" || st.includes("consulta") || st.includes("veterinar") || st.includes("vet"))
    return "consultation";
  if (cat === "grooming" || st.includes("baño") || st.includes("grooming") || st.includes("peluquer"))
    return "grooming";
  return "other_appt";
}

function standaloneRecordKind(record) {
  if (record.type !== "note") return record.type;

  const text = `${record.title ?? ""} ${record.detail ?? ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  if (text.includes("desparasit")) return "deworming";
  if (text.includes("imagen") || text.includes("foto")) return "image";
  if (
    text.includes("examen") ||
    text.includes("laboratorio") ||
    text.includes("rayos x") ||
    text.includes("ecografia")
  ) {
    return "exam";
  }
  if (text.includes("tratamiento")) return "treatment";
  return "note";
}

function mapTransaction(t) {
  return {
    id: t.id,
    tenantId: t.tenantId ?? null,
    userId: t.userId ?? null,
    clientName: t.user?.name ?? null,
    clientPhone: t.user?.phone ?? null,
    petId: t.petId ?? null,
    petName: t.pet?.name ?? null,
    petType: t.pet?.type ?? null,
    appointmentId: t.appointmentId ?? null,
    total: Number(t.total),
    paymentMethod: t.paymentMethod,
    notes: t.notes ?? null,
    paidAt: t.paidAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    items: (t.items ?? []).map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
  };
}

module.exports = {
  getBogotaYmd,
  bogotaDayStart,
  APPOINTMENT_INCLUDE,
  mapAppointmentRow,
  mapMedicalRecord,
  appointmentKind,
  standaloneRecordKind,
  mapTransaction,
};
