# 2.46.6 — Gestión después de cancelar una reprogramación

**Fecha:** 13 de octubre de 2026, hora Colombia. **Estado:** candidata verificada por regresiones; publicación/CI y despliegue pendientes. El paso 8 permanece abierto hasta cancelar Matías por WhatsApp y comprobar liberación.

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

Grep del repositorio: una sola llamada operativa a `sendWhatsAppMessage`, dentro del proveedor de Comunicación; sin nuevos envíos directos. Las pruebas usan dobles de I/O y no escriben citas ni envían mensajes a producción. Los errores deliberados de esos dobles no son logs del servidor.

## Preparación de despliegue

Respaldo cifrado previo: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261013T192242Z`, servicio `Result=success`, `ExecMainStatus=0`. Código y lockfile declaran `2.46.6`. No se genera un tag de cierre de fase: mantenimiento del alcance existente, aún en comprobación real.

La ventana de 2.46.5 debe detenerse antes de reiniciar y conservarse como incompleta. Sus muestras no se mezclan con la observación de 2.46.6; la ventana completa de 2.46.4 sigue preservada. Repetir por el chat la cancelación de Matías después de CI/despliegue; no cancelar esa reserva desde un script.
