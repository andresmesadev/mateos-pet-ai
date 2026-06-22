const express = require("express");
const router = express.Router();
const prisma = require("../../lib/prisma");
const ERRORS = require("../../constants/errors");
const {
  listClients,
  getClientById,
  updateClient,
  listInactiveClients,
} = require("../../services/dashboard-client.service");
const { sendWhatsAppMessage } = require("../../services/whatsapp-api.service");
const { sendNextActionReminders } = require("../../services/next-action.service");

router.get("/clients", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { search, limit, page } = req.query;

    // Quick search mode para POS autocomplete (limit pequeño, retorna pets)
    if (search && typeof search === "string" && search.trim().length >= 2 && parseInt(limit) <= 20) {
      const tenantFilter = tenantId ? { tenantId } : {};
      const term = search.trim();
      const take = Math.min(parseInt(limit) || 8, 20);
      const users = await prisma.user.findMany({
        where: {
          ...tenantFilter,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { phone: { contains: term } },
          ],
        },
        take,
        orderBy: { createdAt: "desc" },
        include: {
          pets: { select: { id: true, name: true, type: true }, orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      return res.json(users.map((u) => ({
        id: u.id, name: u.name, phone: u.phone, pets: u.pets,
      })));
    }

    const result = await listClients(tenantId, { page, limit, search });
    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Clients error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

// ── Importar contactos desde CSV (parseado por el frontend) ──────────────────

function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (/^57\d{10}$/.test(p)) return p;
  if (/^\d{10}$/.test(p)) return "57" + p;
  if (/^0\d{10}$/.test(p)) return "57" + p.slice(1);
  if (p.replace(/\D/g, "").length < 7) return null;
  return p;
}

router.post("/clients/import", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { contacts } = req.body ?? {};

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "Se requiere un array de contactos no vacío" });
    }
    if (contacts.length > 500) {
      return res.status(400).json({ error: "Máximo 500 contactos por importación" });
    }

    const results = [];
    let created = 0, updated = 0, invalid = 0;

    for (const c of contacts) {
      const phone = normalizePhone(c.phone);
      if (!phone) {
        results.push({ name: c.name ?? "", phone: null, status: "invalid", reason: "Teléfono inválido" });
        invalid++;
        continue;
      }

      try {
        const where = tenantId ? { phone, tenantId } : { phone };
        const existing = await prisma.user.findFirst({ where });

        if (existing) {
          const patch = {};
          if (!existing.name    && c.name?.trim())    patch.name    = c.name.trim();
          if (!existing.address && c.address?.trim()) patch.address = c.address.trim();
          if (!existing.notes   && c.notes?.trim())   patch.notes   = c.notes.trim();
          if (Object.keys(patch).length) {
            await prisma.user.update({ where: { id: existing.id }, data: patch });
          }
          results.push({ name: c.name ?? existing.name ?? "", phone, status: "updated" });
          updated++;
        } else {
          await prisma.user.create({
            data: {
              phone,
              name:    c.name?.trim()    || null,
              address: c.address?.trim() || null,
              notes:   c.notes?.trim()   || null,
              ...(tenantId ? { tenantId } : {}),
            },
          });
          results.push({ name: c.name ?? "", phone, status: "created" });
          created++;
        }
      } catch {
        results.push({ name: c.name ?? "", phone, status: "invalid", reason: "Error al guardar" });
        invalid++;
      }
    }

    res.json({ created, updated, invalid, results });
  } catch (error) {
    console.error("[Dashboard] Import contacts error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Importar contactos COMPLETOS (propietario + mascotas + historial peluquería) ──

router.post("/clients/import/full", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { contacts } = req.body ?? {};

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "Se requiere un array de contactos no vacío" });
    }
    if (contacts.length > 3000) {
      return res.status(400).json({ error: "Máximo 3000 contactos por importación" });
    }

    let ownersCreated = 0, ownersUpdated = 0, petsCreated = 0, recordsCreated = 0, invalid = 0;
    const errors = [];

    // ── FASE 1: normalizar y validar teléfonos ─────────────────────────────────
    const valid = [];
    for (const c of contacts) {
      const phone = normalizePhone(c.phone);
      const hasPets = Array.isArray(c.pets) && c.pets.some((p) => p.name?.trim());
      if (!phone && !hasPets) {
        errors.push({ name: c.owner_name ?? "", reason: "Sin teléfono ni mascota" });
        invalid++;
        continue;
      }
      valid.push({ ...c, _phone: phone });
    }

    // ── FASE 2: bulk lookup de propietarios existentes ─────────────────────────
    const phones = [...new Set(valid.map((c) => c._phone).filter(Boolean))];
    const existingUsers = await prisma.user.findMany({
      where: tenantId
        ? { phone: { in: phones }, tenantId }
        : { phone: { in: phones } },
      select: { id: true, phone: true, name: true, address: true, notes: true },
    });
    const userByPhone = new Map(existingUsers.map((u) => [u.phone, u]));

    // ── FASE 3: crear propietarios nuevos en lote ──────────────────────────────
    const toCreate = valid.filter((c) => c._phone && !userByPhone.has(c._phone));
    if (toCreate.length > 0) {
      // createMany no devuelve IDs en PostgreSQL, así que insertamos en chunks
      const CHUNK = 200;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        const chunk = toCreate.slice(i, i + CHUNK);
        await prisma.user.createMany({
          data: chunk.map((c) => ({
            phone:    c._phone,
            name:     c.owner_name?.trim() || null,
            address:  c.address?.trim()    || null,
            notes:    c.notes?.trim()      || null,
            ...(tenantId ? { tenantId } : {}),
          })),
          skipDuplicates: true,
        });
      }
      ownersCreated = toCreate.length;

      // Re-fetch para obtener IDs de los recién creados
      const newUsers = await prisma.user.findMany({
        where: tenantId
          ? { phone: { in: toCreate.map((c) => c._phone) }, tenantId }
          : { phone: { in: toCreate.map((c) => c._phone) } },
        select: { id: true, phone: true, name: true, address: true, notes: true },
      });
      newUsers.forEach((u) => userByPhone.set(u.phone, u));
    }

    // ── FASE 4: actualizar propietarios existentes (solo campos vacíos) ─────────
    const toUpdate = valid.filter((c) => c._phone && existingUsers.find((u) => u.phone === c._phone));
    for (const c of toUpdate) {
      const existing = userByPhone.get(c._phone);
      if (!existing) continue;
      const patch = {};
      if (!existing.name    && c.owner_name?.trim()) patch.name    = c.owner_name.trim();
      if (!existing.address && c.address?.trim())    patch.address = c.address.trim();
      if (!existing.notes   && c.notes?.trim())      patch.notes   = c.notes.trim();
      if (Object.keys(patch).length) {
        await prisma.user.update({ where: { id: existing.id }, data: patch });
      }
    }
    ownersUpdated = toUpdate.length;

    // ── FASE 5: mascotas y registros de peluquería ─────────────────────────────
    // Construir lista plana de mascotas a procesar
    const petRows = []; // { owner, petData }
    for (const c of valid) {
      const owner = c._phone ? userByPhone.get(c._phone) : null;
      if (!owner || !Array.isArray(c.pets)) continue;
      for (const petData of c.pets) {
        if (petData.name?.trim()) petRows.push({ owner, petData });
      }
    }

    // Bulk lookup de mascotas existentes por ownerId
    const ownerIds = [...new Set(petRows.map((r) => r.owner.id))];
    const existingPets = await prisma.pet.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { id: true, ownerId: true, name: true, breed: true },
    });
    // Map: "ownerId|petName_lower" → pet
    const petKey = (ownerId, name) => `${ownerId}|${name.toLowerCase()}`;
    const petByKey = new Map(existingPets.map((p) => [petKey(p.ownerId, p.name), p]));

    // Crear mascotas nuevas en lote
    const petsToCreate = petRows.filter(
      ({ owner, petData }) => !petByKey.has(petKey(owner.id, petData.name.trim()))
    );

    if (petsToCreate.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < petsToCreate.length; i += CHUNK) {
        const chunk = petsToCreate.slice(i, i + CHUNK);
        await prisma.pet.createMany({
          data: chunk.map(({ owner, petData }) => ({
            name:    petData.name.trim(),
            type:    "dog",
            breed:   petData.breed?.trim()  || null,
            notes:   petData.price?.trim()  || null,
            ownerId: owner.id,
            ...(tenantId ? { tenantId } : {}),
          })),
          skipDuplicates: true,
        });
      }
      petsCreated = petsToCreate.length;

      // Re-fetch mascotas recién creadas
      const newPets = await prisma.pet.findMany({
        where: { ownerId: { in: ownerIds } },
        select: { id: true, ownerId: true, name: true, breed: true },
      });
      newPets.forEach((p) => petByKey.set(petKey(p.ownerId, p.name), p));
    }

    // ── FASE 6: registros de peluquería en lote ────────────────────────────────
    // Recopilar todos los petIds que tienen visitas
    const petIdsWithVisits = new Set(
      petRows
        .filter(({ petData }) => petData.last_visit || petData.visit_history)
        .map(({ owner, petData }) => {
          const p = petByKey.get(petKey(owner.id, petData.name.trim()));
          return p?.id;
        })
        .filter(Boolean)
    );

    // Bulk lookup de registros grooming existentes
    const existingGrooming = await prisma.medicalRecord.findMany({
      where: { petId: { in: [...petIdsWithVisits] }, type: "grooming" },
      select: { petId: true, date: true },
    });
    // Set de "petId|YYYY-MM-DD" ya existentes
    const groomingSet = new Set(
      existingGrooming
        .filter((r) => r.date)
        .map((r) => `${r.petId}|${r.date.toISOString().split("T")[0]}`)
    );

    // Construir registros nuevos
    const groomingToCreate = [];
    for (const { owner, petData } of petRows) {
      const pet = petByKey.get(petKey(owner.id, petData.name.trim()));
      if (!pet) continue;

      const allDates = new Set();
      if (petData.last_visit?.trim()) allDates.add(petData.last_visit.trim());
      if (petData.visit_history?.trim()) {
        petData.visit_history.split("|").forEach((d) => {
          const clean = d.trim();
          if (clean) allDates.add(clean);
        });
      }

      const title = petData.price?.trim() ? `Peluquería — ${petData.price.trim()}` : "Peluquería";

      for (const dateStr of allDates) {
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) continue;
        const key = `${pet.id}|${parsed.toISOString().split("T")[0]}`;
        if (groomingSet.has(key)) continue;
        groomingSet.add(key);
        groomingToCreate.push({ petId: pet.id, type: "grooming", title, date: parsed });
      }
    }

    if (groomingToCreate.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < groomingToCreate.length; i += CHUNK) {
        await prisma.medicalRecord.createMany({
          data: groomingToCreate.slice(i, i + CHUNK),
          skipDuplicates: true,
        });
      }
      recordsCreated = groomingToCreate.length;
    }

    res.json({ ownersCreated, ownersUpdated, petsCreated, recordsCreated, invalid, errors });
  } catch (error) {
    console.error("[Dashboard] Import full error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Crear cliente manualmente desde el dashboard.
router.post("/clients", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, phone, email, address, notes } = req.body ?? {};

    const cleanPhone = typeof phone === "string" ? phone.replace(/\s+/g, "").trim() : "";
    if (!cleanPhone) {
      return res.status(400).json({ error: "El teléfono es requerido" });
    }

    const created = await prisma.user.create({
      data: {
        phone: cleanPhone,
        tenantId: tenantId ?? null,
        name: name?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
      select: { id: true, name: true, phone: true },
    });

    res.status(201).json(created);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un cliente con ese teléfono" });
    }
    console.error("[Dashboard] Create client error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

// Crear propietario + mascotas en una transacción atómica.
// Debe estar antes de /:id para que Express no lo capture como parámetro.
router.post("/clients/with-pets", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { name, phone, address, notes, pets } = req.body ?? {};

    const cleanPhone = typeof phone === "string" ? phone.replace(/\s+/g, "").trim() : "";
    const cleanName = typeof name === "string" ? name.trim() : "";

    if (!cleanName) return res.status(400).json({ error: ERRORS.REQUIRED("El nombre del propietario") });
    if (!cleanPhone) return res.status(400).json({ error: ERRORS.REQUIRED("El teléfono") });

    const VALID_PET_TYPES = ["dog", "cat", "other"];
    const petsArr = Array.isArray(pets) ? pets : [];

    for (let i = 0; i < petsArr.length; i++) {
      const p = petsArr[i];
      if (!p.name?.trim()) {
        return res.status(400).json({ error: `Mascota ${i + 1}: el nombre es requerido` });
      }
      if (!VALID_PET_TYPES.includes(p.type?.toLowerCase())) {
        return res.status(400).json({ error: `Mascota ${i + 1}: tipo inválido` });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          phone: cleanPhone,
          tenantId: tenantId ?? null,
          name: cleanName || null,
          address: address?.trim() || null,
          notes: notes?.trim() || null,
        },
        select: { id: true, name: true, phone: true },
      });

      const createdPets = await Promise.all(
        petsArr.map((p) =>
          tx.pet.create({
            data: {
              name: p.name.trim(),
              type: p.type.toLowerCase(),
              breed: p.breed?.trim() || null,
              gender: p.gender?.trim() || null,
              weight: p.weight != null ? Number(p.weight) : null,
              notes: p.notes?.trim() || null,
              tenantId: tenantId ?? null,
              ownerId: owner.id,
            },
            select: { id: true, name: true, type: true },
          })
        )
      );

      return { owner, pets: createdPets };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un cliente con ese teléfono" });
    }
    console.error("[Dashboard] Create client+pets error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

router.get("/clients/inactive", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const clients = await listInactiveClients(tenantId);
    res.json(clients);
  } catch (error) {
    console.error("[Dashboard] Inactive clients error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;
    const client = await getClientById(id, tenantId);

    if (!client) {
      return res.status(404).json({ error: ERRORS.NOT_FOUND("Cliente") });
    }

    res.json(client);
  } catch (error) {
    console.error("[Dashboard] Client detail error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId } = req.tenant;

    const existing = await prisma.user.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: ERRORS.NOT_FOUND("Cliente") });

    const { name, email, address, notes } = req.body ?? {};
    const updated = await updateClient(id, { name, email, address, notes });
    res.json({ id: updated.id, name: updated.name, email: updated.email, address: updated.address, notes: updated.notes });
  } catch (error) {
    console.error("[Dashboard] Update client error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: ERRORS.NOT_FOUND("Cliente") });
    }
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

router.post("/campaigns/reactivation", async (req, res) => {
  try {
    const { clientIds, message } = req.body ?? {};

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ error: "clientIds es requerido" });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message es requerido" });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, phone: true, name: true },
    });

    let sent = 0;
    let failed = 0;

    const now = new Date();
    for (const user of users) {
      const text = message.replace(/\{nombre\}/g, user.name ?? "cliente");
      const result = await sendWhatsAppMessage(user.phone, text);
      if (result) {
        sent++;
        await prisma.user.update({ where: { id: user.id }, data: { lastReminderSentAt: now } });
      } else {
        failed++;
      }
    }

    res.json({ sent, failed, total: users.length });
  } catch (error) {
    console.error("[Dashboard] Reactivation campaign error:", error);
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

// ── Automatizaciones — envío masivo por tipo de acción (TAREA 14) ────────────
router.post("/campaigns/next-actions", async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { type } = req.body ?? {};
    if (!type) return res.status(400).json({ error: "type es requerido" });
    const result = await sendNextActionReminders({ tenantId, type });
    res.json(result);
  } catch (error) {
    console.error("[Dashboard] Next-action campaign error:", error.message);
    if (error.message.includes("inválido")) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: ERRORS.INTERNAL });
  }
});

module.exports = router;
