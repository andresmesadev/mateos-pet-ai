# 2.46.6 — Gestión después de cancelar una reprogramación

**Fecha:** 13 de octubre de 2026, hora Colombia. **Estado:** publicada y desplegada, CI completo, smoke HTTPS y recuperación/cancelación real aprobados. Paso 8 de preparación completado a las 14:34; estabilización de 2.46.6 en curso. Los pendientes fechados abajo son evidencia del avance anterior.

## Problema y cambio

Después de rechazar un destino ocupado y cancelar la original de Akiles, la sesión conservó su `reschedule_appointment_id`. Pedir cancelar Matías produjo un aviso sobre cambiar mascota en la reprogramación de Akiles. Matías siguió confirmado; no hubo operación indebida, pero el cliente no pudo completar la gestión.

Las solicitudes explícitas de gestión llegan al caso de uso antes de aplicar guards de cambio de mascota del borrador. Sus datos extraídos seleccionan la cita, sin sobrescribir el borrador: solo el parche explícito del caso de gestión modifica sesión. Cancelar la original termina la reprogramación y limpia sus datos. Una selección antigua que ya no aparece en la lista activa autorizada se limpia sin modificar citas. Si la lista alcanza su límite de 50, su ausencia no se interpreta como inactividad. El paso de retorno guardado solo se utiliza en una gestión pendiente.

Se conservan consentimiento, identificación del propietario/establecimiento y protección contra cambiar mascota durante una reserva. Sin cambios de dominio, schema, migraciones ni frontend. Diseño previo: [ADR 019](../decisions/019-asistente-contexto-y-operaciones-seguras.md). Evidencia del diálogo: [pruebas del paso 8](../operations/ASSISTANT_BOOKING_SAFETY_TRIAL_20261010.md).

## Validación real

```text
Antes de corregir, regresión del adaptador: 3 fallidas / 24 aprobadas, exit 1.
Después, tres suites dirigidas: 56 pruebas aprobadas, exit 0, 2,903 s.
Suite completa del primer ajuste: 183 suites / 1.470 pruebas, exit 0, 40,26 s.
Frontend eslint: exit 0.
Node --check de los dos servicios: exit 0.
git diff --check: exit 0.
```

Tras completar el manejo del paso de retorno y las aserciones de cancelar/rechazar otra mascota, las tres suites dirigidas volvieron a pasar. Dos intentos locales de suite completa final terminaron con exit 1 y exit 9 sin resumen; no se cuentan como aprobados ni se atribuyen a un test fallido sin evidencia. CI final debe certificar esa revisión completa.

**Validación final superada por CI:** commit `c04c0bb67ee716ce74a68e2ad3c4dd465657de8d`, publicado en `main`. [Ejecución 38454704658](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38454704658): `test`, `lint`, `inbound-postgres` y `administration-postgres`, todos `success`. Output real del job `test`: **183 suites / 1.470 pruebas aprobadas, 12,45 s**. Lint/build frontend, auditorías de dependencias de producción y PostgreSQL aislado aprobados. Esta ejecución sí certifica la revisión final, a diferencia de los intentos locales sin resumen.

Grep del repositorio: una sola llamada operativa a `sendWhatsAppMessage`, dentro del proveedor de Comunicación; sin nuevos envíos directos. Las pruebas usan dobles de I/O y no escriben citas ni envían mensajes a producción. Los errores deliberados de esos dobles no son logs del servidor.

## Preparación de despliegue

Respaldo cifrado previo: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261013T192242Z`, servicio `Result=success`, `ExecMainStatus=0`. Código y lockfile declaran `2.46.6`. No se genera un tag de cierre de fase: mantenimiento del alcance existente, aún en comprobación real.

La ventana de 2.46.5 debe detenerse antes de reiniciar y conservarse como incompleta. Sus muestras no se mezclan con la observación de 2.46.6; la ventana completa de 2.46.4 sigue preservada. Repetir por el chat la cancelación de Matías después de CI/despliegue; no cancelar esa reserva desde un script.

Observador anterior identificado por PID y comando, detenido antes del despliegue: **25 muestras, dos horas, cero fallos/huecos/reinicios**, desde el 13 a las 12:27:13 hasta las 14:27:13 Colombia. Archivo `.cache/stability/ventana-2.46.5-20261013T172713Z.jsonl` conservado; veredicto `incomplete`, exit 1 esperado por falta de 48 horas. Se inicia `scripts/deploy.sh` para el commit verificado, sin modificar citas por script.

## Despliegue y comprobaciones

`scripts/deploy.sh`: **exit 0**, commit `c04c0bb`, backend reconstruido y frontend reutilizado; 46 migraciones sin pendientes. Worker iniciado **13 de octubre a las 14:29:20 Colombia**, salud local correcta a las 14:29:23. Dos respuestas vacías durante reinicio se recuperaron con los reintentos del script.

Salud pública a las **14:29:53**: HTTP 200, versión 2.46.6, base/OpenAI/worker `ok`, cero fallos consecutivos. Smoke `verify-release-https.cjs`, exit 0: autenticación admin correcta, 14 destinos HTTP 200, contratos de caja/servicios/inventario, parámetros ambiguos 400, acceso anónimo 401 y POST de páginas/acciones 405. Sin escrituras de negocio ni mensajes salientes.

La instalación temporal de tooling Prisma sigue mostrando cuatro vulnerabilidades altas en sus dependencias completas, como en 2.46.5; se elimina `/app/node_modules` al construir. Dependencias de producción auditadas sin vulnerabilidades en CI y en la instalación backend. Este ajuste no declara resuelto el tooling de desarrollo.

Se pidió reenviar la cancelación explícita de Matías y confirmar solo la cita correcta. No se borra su sesión manualmente: la recuperación de selección anterior debe verificarse en el recorrido real. Cancelación y liberación aún pendientes.

Observador de 2.46.6 iniciado con ventana separada: `.cache/stability/ventana-2.46.6-20261013T193040Z.jsonl`, PID inicial `37796`. Primera muestra **13 de octubre a las 14:30:40 Colombia**, salud correcta. Final previsto **15 de octubre a las 14:30:40**, condicionado a continuidad del equipo/proceso; no se promete una notificación automática ni se declara estabilización completa.

**Recuperación real verificada a las 14:31:19:** repetir la solicitud a las 14:30:48 produjo confirmación específica de Matías a las 14:30:52, sin aviso sobre Akiles. Sesión `awaiting_management_confirm`, ID `cmv722z0b003c0itful0yiy9w`, selección vieja y datos del borrador en `null`. Cuatro trabajos `done/complete`, cero errores, respuesta `sent/delivered/read`. Matías sigue `confirmed` hasta consentimiento; las 13 todavía ocupadas. No confundir esta recuperación con cancelación completada.

**Cierre real a las 14:34:** consentimiento del propietario a las 14:31:27 y confirmación de cancelación a las 14:31:29. Akiles y Matías `cancelled`, mismos IDs y fechas, doce y trece libres; sesión sin selección ni borrador. Ambas filas verificadas en calendario mediante proxy HTTPS autenticado (HTTP 200). Desde el arranque: dos entrantes y seis recibos completos, cero errores/leases vencidos; respuesta final `sent/delivered/read`. Logs breves sin firmas de error. Evidencia detallada en el registro del paso 8; no equivale a 48 horas de estabilidad ni abre beta externa.
