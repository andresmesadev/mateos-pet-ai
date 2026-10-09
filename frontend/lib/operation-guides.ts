import type { DashboardAccess } from "./dashboard-access";

export function operationGuides(access: DashboardAccess) {
  const c = access.capabilities;
  return [
    ...(c.agenda ? [{ id: "agenda", path: "/dashboard/calendar", title: "Recibir una cita", steps: ["Busca la cita por mascota o propietario y verifica fecha y servicio.", "Cuando llegue el paciente, registra su llegada en la cita vigente.", "Confirma el profesional responsable. Si el plazo de llegada venció, revisa el estado antes de atender.", "Abre el área correspondiente para registrar la atención."] }] : []),
    ...(c.clinical ? [{ id: "consultas", path: "/dashboard/consultas", title: "Guardar una consulta", steps: ["Abre la cita y revisa el expediente y las alertas del paciente.", "Inicia la atención de una cita vigente y verifica el profesional responsable.", "Completa la evaluación, diagnóstico, plan y seguimiento; guarda la historia.", "Finaliza la cita cuando corresponda. Al regresar, crea una nueva cita: su historia anterior se conserva."] }] : []),
    ...(c.grooming ? [{ id: "peluqueria", path: "/dashboard/peluqueria", title: "Atender y entregar una mascota", steps: ["Verifica la cita, mascota, propietario y alertas de manejo.", "Registra la llegada y comienza el baño o corte asignado.", "Guarda las notas del trabajo y productos usados; finaliza el servicio.", c.cash ? "Confirma la entrega al propietario. Consulta Caja si el método de pago está pendiente." : "Confirma la entrega al propietario. Solicita a recepción que revise el pago si está pendiente."] }] : []),
    ...(c.cash ? [{ id: "pos", path: "/dashboard/pos?tab=caja", title: "Confirmar un cobro existente", steps: ["En Caja revisa los cobros con método pendiente.", "Verifica cliente, servicio y valor antes de confirmar el pago.", "Registra el método con el que realmente se pagó.", "Consulta el movimiento en Historial. Un servicio finalizado ya genera su cobro; evita crear otra venta."] }] : []),
  ];
}
