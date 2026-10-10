# Tres pruebas de seguridad de agenda desde WhatsApp

**Fecha:** 10 de octubre de 2026, hora Colombia. **Versión al comenzar:** 2.46.1. **Estado:** en ejecución interna supervisada. Continúa el paso 8; no certifica beta externa.

El responsable autorizó probar negación, dirección de recogida y conservación de cita ante reprogramación fallida. Los mensajes los envía el operador desde los números de prueba verificados; las comprobaciones del servidor son de solo lectura. No se insertan fixtures directamente en producción ni se envían mensajes fabricados desde scripts.

## Criterios

1. **Negación:** «No confirmo la cita» no crea una reserva ni avanza como aceptación. Verificar respuesta, paso de sesión y ausencia de una cita nueva.
2. **Recogida:** preguntar la dirección, rechazar una respuesta insuficiente, mostrar la dirección utilizable en la revisión final y esperar consentimiento. No confirmar la recogida de prueba: la dirección ficticia no debe originar una cita real.
3. **Reprogramación fallida:** dos citas de prueba con consentimiento, en horarios distintos. Intentar mover una al horario ocupado de la otra debe conservar ID, fecha y estado de la original; ninguna reserva inexistente se presenta como confirmada. Cancelar después únicamente las citas de esta prueba, mediante los chats de sus propietarios.

## Punto de partida — 16:08 de Colombia

La sesión de Matías está en `awaiting_grooming_slot_confirm`, peluquería, martes 13 a las 11:00, especie `dog`. No hay cita de Matías para ese día. La única fila del martes encontrada es la cita veterinaria de Benji de la prueba anterior, ya `cancelled`; no debe borrarse su historial. Las 12:00 y 13:00 de veterinaria se revisarán de nuevo antes de preparar el caso de reprogramación.

## Resultados

| Caso | Estado | Evidencia |
| --- | --- | --- |
| Negación | Parcial: oferta de turno aprobada; confirmación final pendiente | «No confirmo la cita» a las 16:09:26; oferta repetida a las 16:09:28, paso `awaiting_grooming_slot_confirm`, mismo turno y cero citas nuevas. No avanzó como aceptación. |
| Dirección de recogida | Incidente detectado; corrección local en verificación | «Si acepto a las 11» volvió a ofrecer el mismo turno, sin avanzar a modalidad de atención. No se creó cita. |
| Reprogramación a destino ocupado | Pendiente | Se preparará después de comprobar recogida. |

La cola completa o una respuesta textual por sí solas no demuestran que la operación sea correcta. Cada caso debe relacionar mensajes, estado y agenda persistida; registrar también entrega, errores y limpieza de las citas de prueba.

### Observación de conversación

Ante la negación, el asistente repitió la oferta en vez de reconocer expresamente que el cliente no confirmó. No hubo operación indebida, pero es una oportunidad de mejorar el mensaje de rechazo; no confundirla con consentimiento ni declararla corregida sin cambios y verificación.

### Incidente al aceptar la hora — 16:11 de Colombia

«Si acepto a las 11» llegó a las 16:11:04 y produjo la oferta repetida a las 16:11:06. Trabajo `done/complete`, sin `lastError`, cero citas nuevas: fallo de transición de conversación, no caída de OpenAI ni del worker.

La regresión previa a corregirlo falló en cuatro comprobaciones: tres aceptaciones que repiten hora/fecha y reconocimiento de negación; diez pruebas de esa suite sí pasaban. Se ajustó la comparación de fecha/hora para invalidar solo un turno distinto y se añadió reconocimiento del rechazo explícito. Diseño: [ajuste del ADR 019](../decisions/019-asistente-contexto-y-operaciones-seguras.md). Candidata `2.46.2`; las tres suites dirigidas pasan: 53 pruebas, exit 0. Publicación, despliegue y repetición real todavía pendientes.

Verificación local completa de la candidata:

```text
node node_modules/jest/bin/jest.js --runInBand --silent --shard=1/3
60 suites / 473 pruebas, exit 0
node node_modules/jest/bin/jest.js --runInBand --silent --shard=2/3
60 suites / 501 pruebas, exit 0
node node_modules/jest/bin/jest.js --runInBand --silent --shard=3/3
60 suites / 452 pruebas, exit 0
Total: 180 suites, 1426 pruebas
node node_modules/eslint/bin/eslint.js . (frontend): exit 0
node --check (dos archivos JS modificados): exit 0
git diff --check: exit 0
```

El primer intento del segundo shard terminó con exit 9, sin resumen; no se cuenta como aprobado. Su repetición mediante Node en la terminal pasó con el resultado indicado. Los logs de errores de los casos con dependencias simuladas no son errores del servidor de producción.

Respaldo previo a publicar: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261010T211614Z`, `mateos-pet-ai-backup.service`, `Result=success`, `ExecMainStatus=0`. No se modificó el schema ni hay migraciones nuevas.

Seguimiento de la versión y prueba anterior: [2.46.1](../history/RELEASE_2_46_1_ASSISTANT_TRIAL_20261010.md). Estado global: [plan de beta](CLOSED_BETA_READINESS_PLAN_20260919.md).
