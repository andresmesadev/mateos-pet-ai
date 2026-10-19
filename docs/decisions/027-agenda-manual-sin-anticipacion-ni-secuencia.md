# ADR 027 — Agenda manual para la jornada de hoy

2026-10-19. Aceptado por petición explícita del responsable del producto.

La anticipación de 30 minutos y la secuencia consecutiva se aplicaban también a la recepción manual, impidiendo registrar a las mascotas ya llegadas y elegir otros horarios libres. El dashboard autenticado usa ahora modo manual interno: permite todos los turnos libres de hoy/futuro y las horas pasadas de hoy. Nunca admite un día anterior ni ignora horas, cierres, ausencias, ocupación o Tenant. El cliente HTTP no decide esta política; la ruta administrativa la fija.

El consumidor público y el motor de WhatsApp mantienen la política autónoma existente. La resolución horaria compartida usa área y después habitual cuando falta configuración válida, respetando cierres explícitos. No se duplican agendas, se alteran citas existentes ni se modifica persistencia. Se mantiene la cadencia de recepción de peluquería del ADR 026. La pausa local de WhatsApp es reversible y no cambia credenciales.

Checkpoint de implementación: el barrido existente de ausencias marca como no_show citas pendientes/confirmadas cuya hora venció. Por eso, el alta manual con hora pasada de hoy se registra directamente como arrived, conforme a que el responsable está registrando mascotas que ya llegaron. Así se conserva el estado real sin desactivar el barrido para el resto de citas. La UI explica ese resultado y el servidor lo decide, sin confiar en status enviado por el cliente.

[Diseño de cinco etapas](../architecture/manual-agenda-and-whatsapp-pause-20261019.md).
