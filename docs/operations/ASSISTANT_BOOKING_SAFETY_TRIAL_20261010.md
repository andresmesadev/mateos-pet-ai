# Tres pruebas de seguridad de agenda desde WhatsApp

**Fecha:** 10 de octubre de 2026, hora Colombia. **Versión al comenzar:** 2.46.1; corrección 2.46.2 publicada y desplegada. **Estado:** en ejecución interna supervisada. Continúa el paso 8; no certifica beta externa.

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
| Negación | Seguridad aprobada desde WhatsApp; reconocimiento final corregido localmente | Rechazo en oferta y en revisión final: cero citas nuevas. La respuesta final de 2.46.2 reofreció turno; se corrigió para reconocer la negación. |
| Dirección de recogida | Validación/revisión aprobadas; variante de solicitud corregida localmente | Rechaza «No sé todavía», muestra dirección ficticia completa y exige consentimiento. «Que lo recojan» no se reconocía; corrección 2.46.3 pendiente de publicación y repetición. |
| Reprogramación a destino ocupado | En preparación | Se solicitaron dos citas de prueba de veterinaria: Akiles a las 12 y Benji a las 13 del martes 13. |

La cola completa o una respuesta textual por sí solas no demuestran que la operación sea correcta. Cada caso debe relacionar mensajes, estado y agenda persistida; registrar también entrega, errores y limpieza de las citas de prueba.

### Observación de conversación

Ante la negación, el asistente repitió la oferta en vez de reconocer expresamente que el cliente no confirmó. No hubo operación indebida, pero es una oportunidad de mejorar el mensaje de rechazo; no confundirla con consentimiento ni declararla corregida sin cambios y verificación.

### Incidente al aceptar la hora — 16:11 de Colombia

«Si acepto a las 11» llegó a las 16:11:04 y produjo la oferta repetida a las 16:11:06. Trabajo `done/complete`, sin `lastError`, cero citas nuevas: fallo de transición de conversación, no caída de OpenAI ni del worker.

La regresión previa a corregirlo falló en cuatro comprobaciones: tres aceptaciones que repiten hora/fecha y reconocimiento de negación; diez pruebas de esa suite sí pasaban. Se ajustó la comparación de fecha/hora para invalidar solo un turno distinto y se añadió reconocimiento del rechazo explícito. Diseño: [ajuste del ADR 019](../decisions/019-asistente-contexto-y-operaciones-seguras.md). Versión `2.46.2`; las tres suites dirigidas pasan: 53 pruebas, exit 0. Publicación y despliegue completados; repetición real en curso.

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

Commit de código publicado: `bebc68319c342850b360b5ebb279e551ffc929f9`. [CI 38087005098](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38087005098): cuatro jobs aprobados (`test`, `lint`, `inbound-postgres`, `administration-postgres`). La observación de salud de 2.46.1 se detuvo tras verificar su proceso: diez muestras, 45 minutos de cobertura, cero fallos/huecos/reinicios, ventana incompleta. Se preservó su archivo.

Despliegue de `scripts/deploy.sh`: exit 0, commit `bebc683`, 46 migraciones aplicadas sin pendientes. Backend reconstruido y frontend reutilizado. Worker iniciado a las **16:20:30**, salud HTTPS a las **16:20:46**: versión 2.46.2, base/OpenAI/worker `ok`, cero fallos consecutivos. Los resets transitorios durante reinicio se recuperaron con los reintentos del script.

Ventana de salud de 2.46.2: `.cache/stability/ventana-2.46.2-20261010T212046Z.jsonl`, PID inicial 26832, inicio **10 de octubre a las 16:20:46 de Colombia**; final previsto **12 de octubre a las 16:20:46**, condicionado a disponibilidad del equipo/proceso. No se cuentan las muestras de versiones anteriores dentro de estas 48 horas.

### Recogida y negación final — 16:23–16:28

En 2.46.2, «Si acepto a las 11» a las 16:23:33 avanzó a modalidad de atención a las 16:23:36: corrección de aceptación validada con el modelo real. «Quiero que lo recojan en casa» a las 16:24:06 no fue reconocido; repitió la pregunta de modalidad. El detector no incluía «recojan» ni «recogida». «Lo recogen» a las 16:24:21 sí produjo la pregunta de dirección.

«No se todavía» a las 16:24:44 recibió «¿Cuál es la dirección exacta…?»; `awaiting_domicilio_address`, recogida verdadera, dirección vacía y cero citas nuevas. La dirección ficticia «Calle 10 # 20-30 barrio centro» a las 16:28:02 produjo revisión a las 16:28:04 con mascota, peluquería, fecha, hora, recogida y dirección; aclaró «Aún no está guardada». No es validación geográfica de la dirección.

«No confirmo la cita» a las 16:28:46 terminó en trabajo `done/complete`, sin `lastError`, cero citas nuevas. La respuesta reofreció turno y volvió a `awaiting_grooming_slot_confirm`; no creó reserva, pero la repetición es confusa. Se extendió el reconocimiento de negación a la revisión final.

### Candidata 2.46.3

Reconoce «recojan»/«recogida» y rechazos explícitos antes de palabras afirmativas; mantiene dirección y consentimiento final. Se fortaleció la prueba del adaptador con ambas frases reales. Antes de corregir el detector: una regresión fallida y trece aprobadas. Después: 37 pruebas dirigidas aprobadas; verificación completa local 180 suites / 1.436 pruebas (60/483, 60/501, 60/452), todos exit 0.

Después del ajuste adicional de reconocimiento de negación final: tres suites dirigidas, **64 pruebas aprobadas**, exit 0. La suite completa final se comprobará también en CI; no se atribuye la ejecución local anterior a ese último ajuste. Frontend sin cambios desde el lint aprobado de esta sesión. Persistencia y schema sin cambios.

Seguimiento de la versión y prueba anterior: [2.46.1](../history/RELEASE_2_46_1_ASSISTANT_TRIAL_20261010.md). Estado global: [plan de beta](CLOSED_BETA_READINESS_PLAN_20260919.md).
