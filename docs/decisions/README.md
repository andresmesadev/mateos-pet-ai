# Decisiones arquitectónicas

Se conservan los identificadores y archivos originales. Existen **dos ADR con número 011**: Recuperación de cola (15 de septiembre) y Disponibilidad del equipo (6 de octubre). Para evitar ambigüedad, citarlos por **título y enlace exacto**, no solo por número. No se renumeran retroactivamente decisiones ya referenciadas.

| Archivo | Decisión |
| --- | --- |
| [001-congelamiento-diseno-entregable-2.1.md](001-congelamiento-diseno-entregable-2.1.md) | ADR 001 — Congelamiento del diseño del Entregable 2.1 (Sistema Operativo de Servicios) |
| [002-resolver-precio-consulta-atributos-mascota.md](002-resolver-precio-consulta-atributos-mascota.md) | ADR 002 — Resolver Precio del Servicio puede consultar atributos de Mascota vía puerto de lectura |
| [003-disponibilidad-staff-convivencia-fase1.md](003-disponibilidad-staff-convivencia-fase1.md) | ADR 003 — Convivencia entre `StaffAvailability` (nuevo) y `Staff.availability` (Fase 1) |
| [004-resolver-disponibilidad-consulta-servicios.md](004-resolver-disponibilidad-consulta-servicios.md) | ADR 004 — Resolver Disponibilidad del Staff puede consultar Servicios vía puerto de existencia |
| [005-cobro-especializacion-transaccion.md](005-cobro-especializacion-transaccion.md) | ADR 005 — `Cobro` deja de ser una entidad independiente; `Transaction`/`Transacción` se convierte en la entidad oficial de ingreso |
| [006-reconciliacion-cierre-fase-2.md](006-reconciliacion-cierre-fase-2.md) | ADR 006 — Reconciliación Arquitectónica del cierre de la Fase 2: qué prometió la fase y qué entregó realmente |
| [007-fuente-oficial-ingreso.md](007-fuente-oficial-ingreso.md) | ADR 007 — Fuente oficial del ingreso del negocio y flujo del evento `CitaCompletada` |
| [008-dia-financiero-zona-horaria.md](008-dia-financiero-zona-horaria.md) | ADR 008 — El día financiero es el día civil del negocio en su zona horaria |
| [009-commission-anulacion.md](009-commission-anulacion.md) | ADR 009 — `Commission` incorpora el patrón de anulación; la unicidad pasa a "una comisión activa por cita" |
| [010-reconciliacion-motor-conversacional-memoria.md](010-reconciliacion-motor-conversacional-memoria.md) | ADR 010 — Reconciliación Arquitectónica: el principio "motor conversacional intocable" frente a una carencia funcional real de memoria |
| [011-equipo-disponibilidad-agenda.md](011-equipo-disponibilidad-agenda.md) | ADR 011 — Disponibilidad del equipo aplicada a Agenda |
| [011-recuperacion-segura-cola-entrante.md](011-recuperacion-segura-cola-entrante.md) | ADR 011 — Recuperación segura de la cola entrante |
| [012-horarios-por-servicio.md](012-horarios-por-servicio.md) | ADR 012 — Horarios de atención por servicio |
| [013-excepciones-fechadas-de-agenda.md](013-excepciones-fechadas-de-agenda.md) | ADR 013 — Excepciones fechadas de agenda |
| [014-whatsapp-atencion-compartida.md](014-whatsapp-atencion-compartida.md) | ADR 014 — Atención compartida de WhatsApp |
| [015-inventario-productos-insumos.md](015-inventario-productos-insumos.md) | ADR 015 — Incorporar Inventario de productos e insumos |
| [016-venta-inventario-atomica.md](016-venta-inventario-atomica.md) | ADR 016 — Coordinar venta y stock en una confirmación atómica |
| [017-reportes-comparacion-equivalente.md](017-reportes-comparacion-equivalente.md) | ADR 017 — Comparación y salida de Reportes |
| [018-equipo-ausencias-capacidades-franjas.md](018-equipo-ausencias-capacidades-franjas.md) | ADR 018 — Corrección de ausencias, capacidades y jornadas partidas |

Una fecha o estado en un ADR describe su aprobación. Para comprobar implementación/publicación posterior, consultar el [estado actual](../ESTADO_ACTUAL.md), los informes enlazados y las decisiones posteriores del mismo contexto.
