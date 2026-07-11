require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");

// Precondición operativa del Entregable 3.0: "CitaCompletada" debe existir y
// estar activo en el Catálogo (Invariante 2) antes de que el comando
// Completar Cita del contexto Agenda pueda certificarlo como Evento de
// Dominio. Idempotente: no falla si el tipo ya existe.
// Entregable 5.2 (Fase 5) — Certificación Real de Eventos por Contexto: los 37
// Tipos de Evento de los 6 contextos productores que hasta ahora solo
// publicaban log-only (Empleados Digitales, Automatizaciones, Comunicación,
// Finanzas, Servicios, Staff). El propio contexto Eventos queda
// deliberadamente excluido — certificar sus 4 eventos propios con el mismo
// mecanismo generaría una llamada recursiva a registerDomainEvent dentro de
// sí mismo (hallazgo del checkpoint de contradicción de la Macroetapa 2).
const DEFAULT_EVENT_TYPES = [
  {
    name: "CitaCompletada",
    originContext: "Agenda",
    payloadContractDescription:
      "tenantId, appointmentId, staffId?, serviceId?, serviceType?, resolvedPrice, priceSource, completedAt",
  },
  // Empleados Digitales
  { name: "EmpleadoDigitalRegistrado", originContext: "Empleados Digitales", payloadContractDescription: "digitalEmployee" },
  { name: "EmpleadoDigitalPausado", originContext: "Empleados Digitales", payloadContractDescription: "digitalEmployee" },
  { name: "EmpleadoDigitalReactivado", originContext: "Empleados Digitales", payloadContractDescription: "digitalEmployee" },
  { name: "TareaIniciada", originContext: "Empleados Digitales", payloadContractDescription: "task" },
  { name: "TareaCompletada", originContext: "Empleados Digitales", payloadContractDescription: "task" },
  { name: "DecisiónRegistrada", originContext: "Empleados Digitales", payloadContractDescription: "decision" },
  { name: "EscalaciónGenerada", originContext: "Empleados Digitales", payloadContractDescription: "escalation" },
  { name: "EscalaciónAtendida", originContext: "Empleados Digitales", payloadContractDescription: "escalation" },
  {
    name: "LimiteDeAutonomiaConfigurado",
    originContext: "Empleados Digitales",
    payloadContractDescription: "digitalEmployeeId, limit, tenantId?",
  },
  // Automatizaciones
  { name: "ReglaDeAutomatizacionRegistrada", originContext: "Automatizaciones", payloadContractDescription: "rule" },
  { name: "ReglaDeAutomatizacionActivada", originContext: "Automatizaciones", payloadContractDescription: "rule" },
  { name: "ReglaDeAutomatizacionDesactivada", originContext: "Automatizaciones", payloadContractDescription: "rule" },
  { name: "PlantillaDeAutomatizacionRegistrada", originContext: "Automatizaciones", payloadContractDescription: "template" },
  {
    name: "PlantillaDeAutomatizacionActivada",
    originContext: "Automatizaciones",
    payloadContractDescription: "rule, template",
  },
  // Comunicación
  { name: "CanalRegistrado", originContext: "Comunicación", payloadContractDescription: "channel" },
  { name: "CanalDesactivado", originContext: "Comunicación", payloadContractDescription: "channel" },
  { name: "MensajeEnviado", originContext: "Comunicación", payloadContractDescription: "message, channel" },
  { name: "ConversaciónEscalada", originContext: "Comunicación", payloadContractDescription: "conversation" },
  {
    name: "EscalaciónDeConversaciónResuelta",
    originContext: "Comunicación",
    payloadContractDescription: "conversation",
  },
  // Finanzas
  { name: "GastoRegistrado", originContext: "Finanzas", payloadContractDescription: "expense" },
  { name: "GastoAnulado", originContext: "Finanzas", payloadContractDescription: "expense" },
  { name: "CobroRegistrado", originContext: "Finanzas", payloadContractDescription: "transaction" },
  { name: "CobroLiquidado", originContext: "Finanzas", payloadContractDescription: "transaction" },
  { name: "VentaAnulada", originContext: "Finanzas", payloadContractDescription: "transaction" },
  { name: "CierreDíaGenerado", originContext: "Finanzas", payloadContractDescription: "dailyClose" },
  { name: "PeríodoFinancieroGenerado", originContext: "Finanzas", payloadContractDescription: "financialPeriod" },
  // Servicios
  { name: "ServicioCreado", originContext: "Servicios", payloadContractDescription: "service" },
  { name: "ServicioActualizado", originContext: "Servicios", payloadContractDescription: "service, appliedRule?" },
  { name: "ServicioDesactivado", originContext: "Servicios", payloadContractDescription: "service" },
  // Staff
  { name: "StaffRegistrado", originContext: "Staff", payloadContractDescription: "staff" },
  { name: "StaffActualizado", originContext: "Staff", payloadContractDescription: "staff" },
  { name: "StaffDesactivado", originContext: "Staff", payloadContractDescription: "staff" },
  { name: "StaffReactivado", originContext: "Staff", payloadContractDescription: "staff" },
  {
    name: "CapacidadAsignada",
    originContext: "Staff",
    payloadContractDescription: "staffId, serviceId, tenantId",
  },
  {
    name: "CapacidadRevocada",
    originContext: "Staff",
    payloadContractDescription: "staffId, serviceId, tenantId",
  },
  {
    name: "DisponibilidadActualizada",
    originContext: "Staff",
    payloadContractDescription: "staffId, availability, origin, tenantId",
  },
  { name: "ComisiónRegistrada", originContext: "Staff", payloadContractDescription: "commission" },
  { name: "ComisiónAnulada", originContext: "Staff", payloadContractDescription: "commission" },
  { name: "LiquidaciónGenerada", originContext: "Staff", payloadContractDescription: "settlement" },
];

async function main() {
  for (const eventType of DEFAULT_EVENT_TYPES) {
    const existing = await prisma.eventType.findUnique({ where: { name: eventType.name } });
    if (existing) {
      console.log(`  → "${eventType.name}" ya existe en el Catálogo (activo=${existing.active}).`);
      continue;
    }
    await prisma.eventType.create({ data: eventType });
    console.log(`  → "${eventType.name}" registrado en el Catálogo.`);
  }
  console.log("Seed de Tipos de Evento completado.");
}

main()
  .catch((error) => {
    console.error("Seed de Tipos de Evento falló:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
