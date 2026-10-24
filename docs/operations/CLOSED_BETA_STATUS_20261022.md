# Beta cerrada de la veterinaria propia — estado al 22 de octubre de 2026

**Publicación posterior — 24/10, 16:20:** [2.58.0](../history/RELEASE_2_58_0_VPS_20261024.md)
publicada: efectivo + transferencia en un cobro, base compacta y recuperación de
sesiones revocadas. CI y lecturas operativas correctas, migración aditiva y
stock/cierre histórico conservados. No se generaron pagos de prueba en producción.
Observación nueva sin certificar 48 horas; los diez ítems conservan sus pendientes.

**Publicación posterior — 24/10, 14:37:** [2.57.1](../history/RELEASE_2_57_1_VPS_20261024.md)
publicada: búsqueda única y base de caja visible al cobrar. CI, salud, catálogos,
base y reportes correctos; ninguna operación financiera de prueba en producción.
Ventana 2.57.0 preservada con ocho muestras/cero fallos; nueva observación sin
certificar 48 horas. Se conservan avances y pendientes de los diez ítems.

**Publicación posterior — 24/10, 13:57:** [2.57.0](../history/RELEASE_2_57_0_VPS_20261024.md)
publicada: cobro de vacunación por productos y cargo principal opcional fuera
de peluquería. CI, salud y lecturas operativas correctas, sin pagos ficticios
ni correcciones históricas en producción. Ventana previa con 21 muestras/cero
fallos preservada; nueva observación, todavía sin 48 horas. Los diez ítems
mantienen sus avances y pendientes.

**Publicación posterior — 24/10, 12:14:** [2.56.0](../history/RELEASE_2_56_0_VPS_20261024.md)
publicada: precio pendiente fuera de peluquería hasta Caja y parche de
body-parser. CI y salud correctos; misma BD, sin operaciones financieras
de prueba en producción. Ventana anterior conservada con 266 muestras/un fallo;
nueva observación desde las 12:14:56 Colombia, sin 48 horas certificadas.
Se conservan los avances operativos y pendientes de los diez ítems.

**Publicación posterior — 23/10, 14:04:** [2.55.2](../history/RELEASE_2_55_2_VPS_20261023.md)
publicada con paginación de diez citas y canceladas ocultas del calendario.
La ventana posterior al mantenimiento de Ubuntu quedó conservada con 21 muestras
sin fallos; nueva observación `ventana-2.55.2-20261023T190410Z`, todavía sin
48 horas certificadas. Los diez ítems conservan sus avances y pendientes.

**Actualización posterior — 23/10:** [mantenimiento de VPS completado](VPS_OS_MAINTENANCE_RESULT_20261023.md).
Ubuntu 24.04.5/Docker 29.9.2 resuelven el pendiente del host del ítem 3.
Respaldos de volumen y acceso de recuperación comprobados y retirado este
último; el ítem 5 mantiene ensayo aislado de restauración actual pendiente.
Nueva observación 2.55.1 iniciada el 23/10 a las 12:17 Colombia; la serie
anterior terminó con 203 muestras y tres timeouts previos al mantenimiento.
El ítem 9 sigue abierto. La tabla inferior conserva su corte histórico del 22/10;
no debe usarse para afirmar que Ubuntu sigue pendiente ni que la serie anterior
continúa activa. Operación real y aceptación desde el 19/10 conservadas.

**Revisión vigente:** 22/10, 20:07 Colombia. **Publicación:** 2.55.1.
Esta tabla sustituye como seguimiento actual al [corte del 20 de octubre](CLOSED_BETA_STATUS_20261020.md).
Conserva los criterios y cierres del [plan original](CLOSED_BETA_READINESS_PLAN_20260919.md);
una mejora publicada no equivale a su aceptación por el equipo del centro.

**Operación real desde el lunes 19/10, confirmada por el responsable:** clientes,
citas de peluquería y veterinaria, venta de medicamentos y registro de pagos.
El responsable informa buen funcionamiento y correcciones según los hallazgos.
La puesta en marcha ya ocurrió; no se trata de una base ficticia ni de una
simulación. «Beta cerrada» identifica aquí el seguimiento de calidad durante
el uso real supervisado. WhatsApp continúa aplazado y pausado por decisión del responsable.
Esta revisión solo actualiza documentación y consulta evidencia; no registra
cobros, cierres, historias clínicas ni movimientos de inventario.

## Los diez ítems y su siguiente comprobación

| Ítem | Estado comprobado | Qué falta para el alcance actual |
| --- | --- | --- |
| 1. Worker entrante | ✅ Corrección original cerrada y regresiones conservadas. En la beta manual el trabajador permanece pausado. | No hay trabajo nuevo de este ítem mientras WhatsApp siga excluido; la pausa no certifica entrega de mensajes. |
| 2. Capacidad de la base | 🟠 PostgreSQL en VPS y ensayo ligero anterior aprobados; ya existe uso real del equipo. | Medir una jornada representativa: tiempos, errores, concurrencia y recursos. Usar los operadores reales, sin exigir un número arbitrario de usuarios. |
| 3. Dependencias y runtime | ✅ Criterio original de aplicación actualizado: Node 24.22.1, OpenSSL 3.5.9, Next.js 16.4.2; auditorías de producción sin vulnerabilidades informadas y CI aprobado. 🟠 Soporte del host pendiente. | Ubuntu 20.04 sin Pro/ESM informa 174 parches de seguridad pendientes; Docker está limitado por Focal. Aplicar el plan del host y verificar el resultado. La seguridad completa no se da por cerrada. |
| 4. Observabilidad | ✅ Activación original de Sentry/alertas comprobada; observador persistente activo y salud de publicación correcta. | Conservar la vigilancia. Revisar los ocho fallos de la ventana 2.54.0; tener alertas instaladas no resuelve ese incidente ni certifica estabilidad. |
| 5. Backup y restauración | ✅ Mecanismo periódico y restauración histórica aprobados. Respaldos cifrados del 22/10 con SHA-256 comprobado. 🟠 Recuperación del estado actual pendiente. | Restaurar de forma aislada una copia con el esquema actual de 65 migraciones, practicar con el suplente y acordar pérdida/tiempo tolerables. Antes de migrar Ubuntu, obtener además respaldo recuperable del volumen de arranque y acceso a consola. |
| 6. WhatsApp empresarial | ⏸️ Aplazado expresamente. La beta utiliza el dashboard; canal privado deshabilitado. | Habilitación, número y entregas reales se revisarán cuando el responsable incorpore ese canal. No bloquea la beta manual acordada. |
| 7. Documentación de la operación real | ✅ Alcance real y organización confirmados: clientes, citas, medicamentos y pagos desde el 19/10. 🟠 Decisiones documentales específicas pendientes. | Actualizar las decisiones del [anexo de operación propia](../legal/anexo-beta-veterinaria-propia-borrador.md) con ese alcance y su evidencia privada. El paquete ficticio del 14/10 es solo antecedente histórico; no describe los datos actuales ni acredita decisiones de terceros. |
| 8. Matriz de agenda | ✅ Cierre del 13/10 conservado, mejoras publicadas y uso real de citas de peluquería/veterinaria confirmado. Regresiones aprobadas. | Revisar únicamente hallazgos nuevos y regresiones afectadas; no volver a exigir que empiecen a agendar ni repetir la matriz cerrada. |
| 9. Estabilización | 🟠 Monitoreo activo. Desde el lunes: 947 muestras a través de once versiones, ocho fallidas; ventanas cambiadas por despliegues. Actual 2.55.1: 19 muestras, 1 h 30 min, cero fallos/huecos internos al corte. | Conservar el uso real acumulado; todavía no hay 48 h completas de una versión. Revisar los fallos de salud y dejar una ventana sin despliegues de mejoras tras el mantenimiento de Ubuntu, salvo corrección urgente. [Detalle de continuidad](REAL_OPERATION_STABILITY_REVIEW_20261022.md). |
| 10. Jornada y aceptación | ✅ Puesta en marcha real desde el 19/10 y buen funcionamiento reportados por el responsable. Cuentas, responsables, soporte, comparación habitual, ingresos/métodos de pago y cierre revisado confirmados. 🟠 Verificaciones puntuales restantes. | Documentar stock contra conteo físico y uso de base/reportes nuevos sin repetir operaciones ni fabricar una «primera jornada». La historia clínica revisada está en el registro habitual confirmado; no exigir duplicarla ni condicionar el uso ya aceptado de agenda/cobro a adoptar ese recorrido dentro de la aplicación. |

✅ indica un criterio técnico u organizativo comprobado, dentro del alcance
descrito. 🟠 mantiene trabajo pendiente; ⏸️ indica una exclusión acordada.
Los cierres históricos se conservan sin ocultar las comprobaciones actuales que
faltan. No se declara cerrada la beta ni habilitada su comercialización externa.

## Mejoras ya publicadas

| Publicación | Trabajo que ya no debe figurar como «solo local» |
| --- | --- |
| Hasta 2.52.0 | Propietarios/mascotas y teléfonos, agenda manual, pagos, contratos y porcentaje por persona, check de reparto por servicio/área, comisiones en cobros mixtos y cierre oficial. |
| [2.53.0 — 20/10](../history/RELEASE_2_53_0_VPS_20261020.md) | Menú móvil separado, diálogo móvil de cierre, existencias iniciales, corrección de cantidad/costo de entradas, retiro auditable de productos y formato de ficha de cita. |
| [2.54.0 — 21/10](../history/RELEASE_2_54_0_VPS_20261021.md) | Bloqueo diario de cita duplicada por mascota/servicio, permitiendo servicios diferentes; retiro auditado de reservas erróneas desde Agenda. La duplicada puntual autorizada ya fue retirada. |
| [2.55.0 — 22/10](../history/RELEASE_2_55_0_VPS_20261022.md) | Base de efectivo, importe dejado al cierre y sugerencia de apertura siguiente; participación profesional en reportes/Excel/impresión; precio y domicilio guardados también en la ficha de cada mascota; Vacunación y Otros con «Requiere cita» agendables. |
| [2.55.1 — 22/10](../history/RELEASE_2_55_1_SECURITY_20261022.md) | Node y dependencias corregidos, puertos internos solo en localhost, endurecimiento de SSH/TLS/permisos y nueve actualizaciones estándar del host. No incluye migración de Ubuntu. |

La base de caja no es ingreso. La reserva de comisiones se muestra descontada
del resultado, pero no registra por sí sola una entrega de dinero al profesional.
Las comisiones históricas conservan su auditoría; no se recalculan con contratos
actuales. Los cierres/cobros anteriores no se alteran para probar mejoras.

## Evidencia vigente y límites

- Publicación 2.55.1, HEAD/tag `964efac`, 65 migraciones; estado de producción
  comprobado en su [certificación](../history/RELEASE_2_55_1_SECURITY_20261022.md).
- [CI final 39873173122](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/39873173122):
  cinco jobs finalizados correctamente, consultados durante esta revisión.
  La publicación conserva evidencia de 217 suites / 1.822 pruebas backend,
  166 auxiliares, lint y recorridos PostgreSQL/HTTPS aprobados. No se repitieron
  esas pruebas de aplicación para una actualización exclusivamente documental.
- Observador consultado en modo lectura: `ventana-2.55.1-20261022T233613Z`;
  primera muestra 22/10 a las 18:36:13 y última 22/10 a las 20:06:13 Colombia;
  19 muestras de 2.55.1, ninguna fallida. Servicio activo y salud nueva correcta.
  La [revisión desde el lunes](REAL_OPERATION_STABILITY_REVIEW_20261022.md)
  distingue uso real, cambios de ventana y fallos del sondeo. Aún no certifica 48 horas.
- Ventana anterior 2.55.0 preservada: 52 muestras, 4,25003 horas, cero
  fallos/huecos. Ventana 2.54.0: 248 muestras, 20,586 horas, ocho fallidas:
  siete sin respuesta HTTP y una con error de OpenAI; incidente no cerrado por
  la publicación de seguridad. No sumar estas ventanas como continuidad actual.
- Respaldos cifrados verificados del 22/10: `20261022T232505Z` y
  `20261022T233324Z`. Eso no acredita una restauración nueva ni un snapshot
  recuperable de toda la máquina. La copia independiente comprobada el 20/10
  y el ensayo del 16/10 conservan sus fechas; no se presentan como nuevos.
- Huellas de inventario y jornada histórica idénticas antes/después de 2.55.1.
  No se consumió retrospectivamente la vacuna del 19/10: el responsable decidió
  conservar las existencias sin ese ajuste histórico. La consulta fue real y su historia
  permanece en el registro habitual; no se inventa ni duplica para cerrar el ítem.

## Próximo orden acordado

1. **23 de octubre, con el responsable frente a su PC:** retomar acceso a
   Oracle Cloud, consola de recuperación y copia recuperable del volumen antes
   de actualizar Ubuntu. El responsable indicó que no dispone de Ubuntu Pro y
   aplazó la intervención para ese día. No se inició la actualización mayor ni
   se reinició la VPS. Ver [plan y límites](VPS_OS_MAINTENANCE_PLAN_20261022.md).
2. Tras esa intervención, comprobar aplicación/datos, respaldos y observación.
   Mantener abierto el incidente anterior y el criterio de estabilidad hasta
   revisar evidencia suficiente, sin borrar sus muestras.
3. Mantener la operación real que ya se realiza y completar únicamente las
   verificaciones específicas del ítem 10, contrastadas con el registro habitual
   y conteo. Aprovechar operaciones reales que correspondan, sin duplicar
   cobros, inventar una jornada ni ajustar retrospectivamente stock. Las pruebas
   técnicas automatizadas siguen en entornos aislados.
4. Completar medición de capacidad, ensayo de recuperación con suplente y
   decisiones documentales pendientes. Registrar la aceptación por área.

La responsabilidad, suplencia y reporte presencial ya están confirmados; no se
vuelven a solicitar. La [hoja de jornada](OWN_CLINIC_STARTUP_WORKSHEET.md) sirve
para los resultados operativos privados y el [runbook](INTERNAL_PILOT_RUNBOOK.md)
para incidencias y medición. WhatsApp y venta a otros centros siguen fuera de
esta aceptación manual.

## Validación de esta actualización documental

`node scripts/check-docs.cjs`: 417 documentos, 1.244 enlaces locales revisados;
`broken: []`, `missingDocReferences: []`, `catalogueErrors: []`.
`node --test scripts/check-docs.test.cjs`: ocho pruebas aprobadas, cero fallidas.
`git diff --check`: sin errores de espacios. Solo documentación modificada;
no requiere migración, nueva versión de aplicación ni despliegue.
