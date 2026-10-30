export const SERVICE_STATES = {
  whatsapp: {
    paused: ['En pausa', 'WhatsApp está pausado por la plataforma. Continúa registrando las atenciones manualmente.'],
    unavailable: ['Sin ruta disponible', 'La conexión está ausente, desactivada o requiere renovar su autorización. Consulta al administrador.'],
    configured: ['Configuración disponible', 'Existe una ruta habilitada y el procesador responde. Esto no confirma la entrega de cada mensaje.'],
    worker_degraded: ['Procesamiento con incidencias', 'El procesador de mensajes requiere revisión. Atiende manualmente y avisa a soporte.'],
    unknown: ['Sin comprobar', 'No se pudo verificar WhatsApp. Consulta al administrador antes de depender de los mensajes.'],
  },
  ai: {
    not_configured: ['Sin configurar', 'La plataforma no tiene configurado el acceso a la IA.'],
    policy_pending: ['Consumo por configurar', 'La política de consumo necesita revisión de la plataforma.'],
    quota_pending: ['Sin cupo asignado', 'La plataforma debe asignar el cupo de este negocio.'],
    exhausted: ['Cupo agotado', 'No se permiten nuevos consumos de IA hasta disponer de cupo.'],
    degraded: ['Proveedor con incidencias', 'El último sondeo de OpenAI falló. La respuesta automática puede fallar; continúa la atención manual y avisa a soporte.'],
    observed_ok: ['Sondeo reciente correcto', 'OpenAI respondió al sondeo técnico. Esto no garantiza cada respuesta o función de IA.'],
    unverified: ['Sin sondeo reciente', 'No hay un resultado de OpenAI de los últimos diez minutos. No se ha comprobado su disponibilidad en esta consulta.'],
    unknown: ['Sin comprobar', 'No se pudo consultar la situación de la IA. No dependas de la respuesta automática hasta verificarla.'],
  },
} as const;
export type ServiceStatus = {
  tenantId: string; checkedAt: string; dashboard: { state: 'responding' };
  whatsapp: { state: keyof typeof SERVICE_STATES.whatsapp };
  ai: { state: keyof typeof SERVICE_STATES.ai; observedAt?: string | null };
};
export function parseServiceStatus(value: unknown, tenantId: string): ServiceStatus {
  const data = value as ServiceStatus | null;
  if (!data || data.tenantId !== tenantId || !Number.isFinite(Date.parse(data.checkedAt)) || data.dashboard?.state !== 'responding' ||
      !Object.hasOwn(SERVICE_STATES.whatsapp, data.whatsapp?.state ?? '') || !Object.hasOwn(SERVICE_STATES.ai, data.ai?.state ?? '') ||
      (data.ai.observedAt != null && !Number.isFinite(Date.parse(data.ai.observedAt)))) throw new Error('Invalid service status');
  return data;
}
