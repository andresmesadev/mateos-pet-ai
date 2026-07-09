# Gate Review — Entregable 4.1 (Saneamiento Tenant-Blind), Macroetapa 1

**Fecha:** 2026-07-08
**Fase:** 4 — Plataforma Comercial (primer entregable del roadmap interno)
**Alcance de la macroetapa:** Auditoría del código real + Diseño completo (Etapas 1–5) + Gate Review.

---

## Resultado de la auditoría

Se verificó contra el código real, no contra el acta de auditoría v2.1.0, cada uno de los cuatro hallazgos heredados:

- **A6 — TOCTOU en reserva de Agenda.** Confirmado: `appointment.service.js:createAppointment` inserta directamente sin ninguna consulta previa atómica de conflicto.
- **M4 — Disponibilidad/recordatorios tenant-blind.** Confirmado y más extendido de lo registrado originalmente: `availability.service.js`/`availability-db.service.js` no tenían ninguna referencia a `tenantId`; las cinco funciones de consulta de `reminder.service.js` no recibían `tenantId`.
- **B2 — Webhook procesa mensajes sin tenant.** Confirmado, con matiz: `resolve-tenant-id.js` (3.4) ya resolvía el tenant, pero únicamente para atribuir la Tarea del Empleado Digital, no para gatear el procesamiento.
- **Hallazgo nuevo, no registrado en el acta original:** `User.phone` era `@unique` global en el schema — bloqueador duro para multi-establecimiento, incorporado al alcance por evidencia directa encontrada en el schema.

## Etapas 1–5 (resumen)

1. **Definición funcional:** ninguna cita puede solapar horario para el mismo bucket de servicio dentro de un tenant; ninguna consulta de disponibilidad/recordatorio puede ejecutarse sin `tenantId`; ningún mensaje entrante puede procesarse sin tenant resuelto; ninguna identidad de usuario puede colisionar entre tenants.
2. **Casos de uso:** reservar cita sin colisión; consultar disponibilidad/recordatorios por tenant; procesar mensaje entrante con tenant resuelto; identidad de usuario por tenant.
3. **Arquitectura técnica:** a diferencia de 3.4/3.5, el saneamiento modifica directamente los servicios señalados por la auditoría (no los envuelve) — ningún caso de uso público de otro contexto cambia su firma.
4. **Modelo de persistencia:** restricción de no-solapamiento sobre `Appointment`; `User.phone` de único-global a único-compuesto con `tenantId`.
5. **Esquema físico:** migración vía `migrate diff` + `migration.sql` manual + `migrate deploy`, mismo mecanismo institucionalizado desde 3.2/3.3.

## Punto de atención señalado en esta macroetapa

Cambiar `User.phone` de único-global a único-compuesto es una migración que reduce una restricción existente — señalada para confirmación explícita antes de escribirse en Macroetapa 2, no solo aprobada tácitamente en el diseño. Confirmada por el responsable del proyecto antes de iniciar la implementación.

## Resultado del Gate Review

**Aprobado para pasar a Macroetapa 2 (Implementación)**, con la condición de checkpoint sobre `User.phone` ya señalada arriba. El resto del diseño (Etapas 1–4, alcance de A6/M4/B2) quedó congelado sin objeciones.

## Reconciliaciones arquitectónicas posteriores (Macroetapa 2)

Durante la implementación se detectaron y resolvieron, por decisión explícita del responsable del proyecto, dos contradicciones reales entre este diseño congelado y el código existente — documentadas en detalle en `docs/history/ENTREGABLE_4_1_COMPLETION_REPORT.md`:

1. **M4** acotado a los consumidores externos al motor conversacional (principio "no reescribir el motor", 3.4) — el consumo interno del motor queda como deuda pendiente, fuera de este entregable.
2. **A6** rediseñado sobre `(tenantId, availabilityBucket, date)` en vez de `(tenantId, staffId, date)`, para reflejar el modelo real de reserva por bucket de servicio compartido, no por staff.

Ninguna de las dos reconciliaciones modificó el objetivo funcional del entregable.
