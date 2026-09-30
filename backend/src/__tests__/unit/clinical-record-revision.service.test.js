const { saveConsultationRecord, snapshot } = require("../../services/clinical-record-revision.service");

const original = { id: "record-1", petId: "pet-1", appointmentId: "appt-1", version: 1, type: "consultation", title: "Consulta", diagnosis: "Original", findings: "Hallazgo original", date: new Date("2026-09-30T15:00:00Z") };
const actor = { type: "vet", staffId: "vet-1", name: "Dra. Lina", email: null };
function setup(current = original, count = 1) {
  const updated = { ...original, diagnosis: "Corregido", version: 2 };
  const tx = { medicalRecord: { findUnique: jest.fn().mockResolvedValueOnce(current).mockResolvedValue(updated), updateMany: jest.fn().mockResolvedValue({ count }), upsert: jest.fn().mockResolvedValue(original) }, medicalRecordRevision: { create: jest.fn().mockResolvedValue({}) } };
  const args = { appointment: { id: "appt-1", status: "completed" }, expectedVersion: 1, correctionReason: "Se corrige la transcripción", updateData: { diagnosis: "Corregido" }, createData: original, include: {}, actor };
  return { tx, args };
}

test("keeps complete before and after contents with authenticated author and version", async () => {
  const { tx, args } = setup();
  const result = await saveConsultationRecord(tx, args);
  expect(result.version).toBe(2);
  expect(tx.medicalRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "record-1", version: 1 }, data: { diagnosis: "Corregido", version: { increment: 1 } } }));
  expect(tx.medicalRecordRevision.create).toHaveBeenCalledWith({ data: expect.objectContaining({ version: 1, before: expect.objectContaining({ diagnosis: "Original", findings: "Hallazgo original" }), after: expect.objectContaining({ diagnosis: "Corregido", findings: "Hallazgo original" }), actorName: "Dra. Lina", actorStaffId: "vet-1", reason: "Se corrige la transcripción" }) });
});
test.each([undefined, "", "err"])("completed correction requires reason: %s", async (reason) => {
  const { tx, args } = setup();
  await expect(saveConsultationRecord(tx, { ...args, correctionReason: reason })).rejects.toMatchObject({ status: 422 });
  expect(tx.medicalRecord.updateMany).not.toHaveBeenCalled();
  expect(tx.medicalRecordRevision.create).not.toHaveBeenCalled();
});
test.each([undefined, null, 0, 2, "1"])("rejects stale or missing version: %s", async (expectedVersion) => {
  const { tx, args } = setup();
  await expect(saveConsultationRecord(tx, { ...args, expectedVersion })).rejects.toMatchObject({ status: 409 });
  expect(tx.medicalRecord.updateMany).not.toHaveBeenCalled();
});
test("a simultaneous correction cannot create a revision after losing the conditional update", async () => {
  const { tx, args } = setup(original, 0);
  await expect(saveConsultationRecord(tx, args)).rejects.toMatchObject({ status: 409 });
  expect(tx.medicalRecordRevision.create).not.toHaveBeenCalled();
});
test("unchanged save does not create a correction or increment version", async () => {
  const { tx, args } = setup();
  expect(await saveConsultationRecord(tx, { ...args, updateData: { diagnosis: "Original" }, correctionReason: "" })).toBe(original);
  expect(tx.medicalRecord.updateMany).not.toHaveBeenCalled();
});
test("new appointment creates an independent record without overwriting another record", async () => {
  const { tx, args } = setup(null);
  await saveConsultationRecord(tx, { ...args, expectedVersion: null });
  expect(tx.medicalRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { appointmentId: "appt-1" }, update: {} }));
  expect(tx.medicalRecordRevision.create).not.toHaveBeenCalled();
});
test("in-progress changes retain both versions even without a final correction reason", async () => {
  const { tx, args } = setup();
  await saveConsultationRecord(tx, { ...args, appointment: { id: "appt-1", status: "in_progress" }, correctionReason: null });
  expect(tx.medicalRecordRevision.create.mock.calls[0][0].data.reason).toBe("Actualización durante la atención");
});
test("audit persistence failure propagates so transaction can roll back clinical update", async () => {
  const { tx, args } = setup();
  tx.medicalRecordRevision.create.mockRejectedValue(new Error("Audit unavailable"));
  await expect(saveConsultationRecord(tx, args)).rejects.toThrow("Audit unavailable");
});
test("snapshot normalizes dates and retains empty clinical fields", () => {
  expect(snapshot(original)).toMatchObject({ date: "2026-09-30T15:00:00.000Z", treatment: null, diagnosis: "Original" });
});
