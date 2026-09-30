const CLINICAL_FIELDS = ["petId", "appointmentId", "type", "title", "detail", "date", "staffId", "reason", "findings", "diagnosis", "treatment", "recommendations", "weight", "nextControlAt"];

function snapshot(record) {
  return Object.fromEntries(CLINICAL_FIELDS.map((key) => {
    const value = record[key] ?? null;
    return [key, value instanceof Date ? value.toISOString() : value];
  }));
}

class ClinicalRevisionError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function saveConsultationRecord(tx, { appointment, createData, updateData, include, expectedVersion, correctionReason, actor }) {
  const current = await tx.medicalRecord.findUnique({ where: { appointmentId: appointment.id }, include });
  if (!current) {
    if (expectedVersion != null) throw new ClinicalRevisionError(409, "El registro cambió. Vuelve a abrir la consulta antes de guardar.");
    return tx.medicalRecord.upsert({ where: { appointmentId: appointment.id }, create: createData, update: {}, include });
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion !== current.version) {
    throw new ClinicalRevisionError(409, "Otra persona modificó el registro o tu versión está desactualizada. Conserva tu texto y vuelve a abrir la consulta.");
  }
  const before = snapshot(current);
  const after = snapshot({ ...current, ...updateData });
  if (JSON.stringify(before) === JSON.stringify(after)) return current;
  const reason = typeof correctionReason === "string" ? correctionReason.trim() : "";
  if (reason.length > 1000) throw new ClinicalRevisionError(422, "El motivo de la corrección no puede superar los 1000 caracteres.");
  if (appointment.status === "completed" && (reason.length < 5 || reason.length > 1000)) {
    throw new ClinicalRevisionError(422, "Explica el motivo de la corrección de la consulta finalizada (entre 5 y 1000 caracteres).");
  }
  const result = await tx.medicalRecord.updateMany({
    where: { id: current.id, version: expectedVersion },
    data: { ...updateData, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new ClinicalRevisionError(409, "El registro cambió mientras guardabas. Vuelve a abrir la consulta.");
  await tx.medicalRecordRevision.create({ data: {
    recordId: current.id, version: current.version, before, after,
    reason: reason || "Actualización durante la atención",
    actorType: actor.type, actorStaffId: actor.staffId ?? null,
    actorName: actor.name, actorEmail: actor.email ?? null,
  } });
  return tx.medicalRecord.findUnique({ where: { id: current.id }, include });
}

module.exports = { snapshot, saveConsultationRecord, ClinicalRevisionError };
