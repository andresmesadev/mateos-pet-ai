# Tres pruebas de seguridad de agenda desde WhatsApp

**Fecha:** 10 de octubre de 2026, hora Colombia. **Versión al comenzar:** 2.46.1; versión vigente 2.46.5 publicada y desplegada tras la revisión del 13 de octubre. **Estado:** en ejecución interna supervisada. Continúa el paso 8; no certifica beta externa.

**Seguimiento del 13 de octubre:** la ventana de salud de 2.46.4 sí completó 48 horas, 577 muestras sin fallos/huecos/reinicios. La [revisión independiente de estabilidad](PRODUCTION_STABILITY_48H_REVIEW_20261013.md) encontró dos recordatorios rechazados por Meta y 35 peticiones de acciones inválidas en frontend. No cierra el paso 9 operativo ni las pruebas de agenda de este informe. El 13 de octubre ya es hoy: revisar las citas y horarios antes de reutilizar las instrucciones históricas.

Los hallazgos se corrigieron en [2.46.5](STABILITY_REMEDIATION_20261013.md): guard para los seis recordatorios y rechazo 405 de POST de páginas/acciones. CI con 1.467 pruebas, despliegue y smoke correctos. Comenzó una nueva observación; las pruebas humanas de este informe siguen pendientes y no se sustituyen por esa corrección.

El responsable autorizó probar negación, dirección de recogida y conservación de cita ante reprogramación fallida. Los mensajes los envía el operador desde los números de prueba verificados; las comprobaciones del servidor son de solo lectura. No se insertan fixtures directamente en producción ni se envían mensajes fabricados desde scripts.

## Criterios

1. **Negación:** «No confirmo la cita» no crea una reserva ni avanza como aceptación. Verificar respuesta, paso de sesión y ausencia de una cita nueva.
2. **Recogida:** preguntar la dirección, rechazar una respuesta insuficiente, mostrar la dirección utilizable en la revisión final y esperar consentimiento. No confirmar la recogida de prueba: la dirección ficticia no debe originar una cita real.
3. **Reprogramación fallida:** dos citas de prueba con consentimiento, en horarios distintos. Intentar mover una al horario ocupado de la otra debe conservar ID, fecha y estado de la original; ninguna reserva inexistente se presenta como confirmada. Cancelar después únicamente las citas de esta prueba, mediante los chats de sus propietarios.

## Punto de partida — 16:08 de Colombia

La sesión de Matías está en `awaiting_grooming_slot_confirm`, peluquería, martes 13 a las 11:00, especie `dog`. No hay cita de Matías para ese día. La única fila del martes encontrada es la cita veterinaria de Benji de la prueba anterior, ya `cancelled`; no debe borrarse su historial. Las 12:00 y 13:00 de veterinaria se revisarán de nuevo antes de preparar el caso de reprogramación.

## Resultados

### Dos recorridos finales para retomar el paso 8

El responsable recordó que el paso 8 ya estaba muy avanzado. Se retoma con **dos recorridos de comprobación final**, sin reiniciar la matriz completa:

1. **Recogida y negación en un mismo flujo:** repetir «Quiero que lo recojan en casa», comprobar pregunta y resumen de dirección, y terminar con «No confirmo la cita». La seguridad de dirección/negación ya pasó; falta la repetición de las frases corregidas sin bucles ni reserva.
2. **Reprogramación a turno ocupado:** comprobar aviso claro y conservación de la cita original con la corrección desplegada; después cancelar únicamente las reservas de prueba y comprobar liberación. La limpieza forma parte de este recorrido, no es una tercera prueba independiente.

Las pruebas aprobadas de días, festivos, horarios, reservas, concurrencia y cancelación conservan su evidencia. Estos dos recorridos siguen pendientes de resultados reales; agruparlos no significa darlos por aprobados. La observación de 48 horas pertenece al paso 9 y continúa por separado.

| Caso | Estado | Evidencia |
| --- | --- | --- |
| Negación | Seguridad aprobada desde WhatsApp; reconocimiento final corregido y desplegado, repetición pendiente | Rechazo en oferta y en revisión final: cero citas nuevas. La respuesta final de 2.46.2 reofreció turno; se corrigió para reconocer la negación. |
| Dirección de recogida | Validación/revisión aprobadas; variante de solicitud corregida y desplegada, repetición pendiente | Rechaza «No sé todavía», muestra dirección ficticia completa y exige consentimiento. «Que lo recojan» no se reconocía; corrección 2.46.3 publicada, falta repetir esa frase. |
| Reprogramación a destino ocupado | Conservación aprobada; respuesta defectuosa corregida, repetición pendiente | El primer destino produjo saludo, sin mover ni duplicar citas. Corrección 2.46.4 desplegada; repetir rechazo y cancelar solo las dos citas nuevas. |

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

Publicación de 2.46.3: commit `03513b586cd72826ea69267f473be6e6031ca3cb`. [CI 38087940815](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38087940815): cuatro jobs `success`. Evidencia final del job `test`: **180 suites / 1.437 pruebas**, 14,45 s. Lint/build y pruebas de PostgreSQL aprobados. Respaldo cifrado previo: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261010T213233Z`, servicio con resultado correcto.

Se detuvo el monitor identificado de 2.46.2 antes de desplegar: tres muestras, diez minutos, cero fallos/huecos/reinicios, ventana incompleta. No sumar esos minutos a la observación de la versión corregida. Aún no llegaron las dos solicitudes nuevas para preparar el caso de reprogramación en la revisión previa al despliegue; cero trabajos activos y cero citas nuevas desde el inicio de estas tres pruebas.

Despliegue de 2.46.3: `scripts/deploy.sh`, exit 0, commit `03513b5`, 46 migraciones aplicadas sin pendientes; worker iniciado a las **16:35:21 de Colombia**. Salud pública a las **16:35:57**: base/OpenAI/worker `ok`, versión 2.46.3 y cero fallos consecutivos. Smoke HTTPS autenticado: 14 destinos HTTP 200, contratos de caja/servicios/inventario aprobados, parámetros ambiguos HTTP 400 y acceso anónimo HTTP 401; exit 0, sin escrituras de negocio ni mensajes salientes.

Monitor vigente: `.cache/stability/ventana-2.46.3-20261010T213557Z.jsonl`, PID inicial 39964. Inicio **10 de octubre a las 16:35:57**, final previsto **12 de octubre a las 16:35:57**, hora Colombia, condicionado al equipo/proceso disponible. Las ventanas anteriores permanecen incompletas; no se declara beta externa ni estabilización completada.

### Revisión posterior y siguiente acción humana

Después del despliegue: **79 trabajos entrantes y 38 registros de entrega, todos `done/complete`, cero leases vencidos**. En estas pruebas hubo ocho respuestas con ID de Meta; siete tienen recibo `read` en esa revisión. No equiparar el resto a fallo ni afirmar que todas fueron leídas. Logs del nuevo arranque: seis líneas, cero firmas de error; todavía no hay una ventana representativa.

No existen citas creadas desde el inicio de estas tres pruebas. Las dos peticiones de veterinaria para preparar la reprogramación aún no llegaron al revisar la base; por ello no hay originales ni destino ocupado nuevos que certificar. Se pidió al operador elegir entre dos chats (Akiles a las 12/Benji a las 13) o su único chat con Akiles/Matías. No crear citas directamente por script para sustituir esta comprobación del canal real.

Cuando estén disponibles las citas de prueba: registrar IDs y propietarios, seleccionar explícitamente la cita original, solicitar el turno ocupado, verificar rechazo y conservación de ambas filas, y cancelar mediante los chats únicamente esos IDs. También repetir «que lo recojan» y el reconocimiento de negación final en 2.46.3. Estas comprobaciones permanecen pendientes; las pruebas automatizadas aprobadas no las sustituyen.

Seguimiento de la versión y prueba anterior: [2.46.1](../history/RELEASE_2_46_1_ASSISTANT_TRIAL_20261010.md). Estado global: [plan de beta](CLOSED_BETA_READINESS_PLAN_20260919.md).

### Preparación real de la reprogramación — 16:39–16:43

La revisión de las 16:43:39 confirmó las dos reservas nuevas, tras solicitudes explícitas y «Si confirmo» en ambos chats:

| Mascota | Cita nueva | Propietario | Fecha UTC | Estado |
| --- | --- | --- | --- | --- |
| Akiles | `cmv2x4pox001m0in5qo5jt7ys` | `cmuedexmz000e0ipnccgf757b` | `2026-10-13T17:00:00Z` (12:00 Colombia) | `confirmed` |
| Benji | `cmv2x4p84001a0in5l8nzn9of` | `cmv1cl82g000g0inqykc185kk` | `2026-10-13T18:00:00Z` (13:00 Colombia) | `confirmed` |

Ambas son de veterinaria (`vet`), especie `dog`; los resúmenes y confirmaciones mantuvieron separados mascota, servicio y hora. La cita cancelada de Benji de la prueba anterior conserva su estado e historial. Las sesiones nuevas terminaron en `completed`.

Hallazgo adicional: «Si por favor» de Akiles a las 16:39:52 repitió la revisión final; «Si confirmo» a las 16:40:42 sí creó la cita. No hubo duplicado, pero queda registrado un problema de reconocimiento de aceptación, pendiente de diagnóstico y regresión. No se declara corregido.

Se pidió reprogramar explícitamente la cita de Akiles del martes 13 y, cuando el asistente solicite destino, responder martes 13 a las 13:00. Si hay selección entre citas, identificar primero la fila nueva. Todavía no se certifica el rechazo ni la conservación de la reserva: falta el intercambio real.

### Incidente real de reprogramación — 16:44–16:45

«Quiero reprogramar la cita veterinaria de Akiles del martes 13 de octubre» a las 16:44:26 seleccionó correctamente la original y preguntó destino. «El martes 13 de octubre a las 13:00» a las 16:44:46 produjo un saludo genérico a las 16:44:48, en vez de rechazo de horario ocupado. La sesión perdió el paso (`null`), pero conservó `reschedule_appointment_id`. A las 16:45:09, Akiles seguía confirmado a las 12 y Benji a las 13, mismos IDs, propietarios y tres filas del martes (incluida la cancelada anterior). No se movió ni duplicó ninguna cita. Las dos respuestas tienen recibos `sent`, `delivered` y `read`; los 24 trabajos desde las 16:39 terminaron `done/complete`, sin errores.

La regresión del recorrido real reproduce el saludo cuando el modelo interpreta el destino como `reschedule_appointment`; se estaba excluyendo del recorrido de reserva pese a tener una cita seleccionada. Se corrige esa continuación únicamente cuando hay selección y fecha/hora explícita, sin nueva orden de gestión. Los destinos rechazados recuerdan que la original sigue reservada. También se corrige el sufijo cortés de aceptación en el control de mascota.

Antes de corregir: **2 regresiones fallidas / 17 aprobadas**, después de completar el doble de alternativas de disponibilidad. Después: **53 pruebas dirigidas** aprobadas. Suite completa de la candidata **2.46.4: 180 suites / 1.446 pruebas**, exit 0, 46,732 s. Lint frontend exit 0; comprobación de sintaxis de los tres servicios y `git diff --check`, exit 0. Los errores deliberados de dobles de prueba no son logs de la VPS. Respaldo cifrado previo `/var/backups/mateos-pet-ai/mateos-pet-ai-20261010T214809Z`, `Result=success`, `ExecMainStatus=0`. Sin cambios de schema ni migraciones nuevas. Publicación, CI, despliegue y repetición real pendientes; conservar las dos citas para el ensayo.

### Publicación y despliegue 2.46.4 — 16:49–16:53

Commit de código `ad422ed811ac22c3cf56e3a9695e2dd6240ba6ff`, publicado en `main`. [CI 38089080257](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38089080257): `test`, `lint`, `inbound-postgres` y `administration-postgres`, todos `success`. Resumen real del job de pruebas: **180 suites / 1.446 pruebas**, 14,347 s.

Antes del reinicio se verificaron por el dashboard autenticado las mismas dos filas: Akiles confirmado a las 12 y Benji a las 13. La ventana identificada de 2.46.3 se detuvo y preservó: cuatro muestras, quince minutos, cero fallos/huecos/reinicios; incompleta. No cuenta para la versión siguiente.

`scripts/deploy.sh`, exit 0, `ad422ed`: backend reconstruido, frontend reutilizado, 46 migraciones sin pendientes. Salud local a las 16:52:57: versión 2.46.4, worker iniciado 16:52:54, base/OpenAI/worker `ok`. Los resets transitorios de reinicio se recuperaron dentro del script. Smoke HTTPS exit 0: 14 destinos autenticados HTTP 200; contratos y rechazo de acceso anónimo aprobados. No hizo escrituras de negocio ni envíos salientes.

Monitor nuevo: `.cache/stability/ventana-2.46.4-20261010T215319Z.jsonl`, PID inicial 43912; primera muestra **10 de octubre a las 16:53:20**, final previsto **12 de octubre a las 16:53:20**, Colombia, condicionado al equipo/proceso disponible. Muestra pública de las 16:53:20: `ok`, cero fallos consecutivos. No se declara completa la estabilización.

Se pidió repetir selección de la cita veterinaria de Akiles y destino martes 13 a las 13:00, sin aceptar alternativas. Después verificar mismos IDs, rechazo, cola y entrega, cancelar solo las dos citas nuevas y repetir recogida/negación final. Esta sección registra despliegue; aún no sustituye el resultado del nuevo intercambio humano.

Revisión de las **16:55:09**: todavía no llegaron mensajes posteriores al despliegue; las dos citas siguen `confirmed`, Akiles a las 12 y Benji a las 13. No se cancela ninguna desde un script para sustituir la prueba del canal. El operador tiene pendiente la instrucción de repetir el intercambio. La aceptación cortés está verificada por regresión y CI, pero su repetición desde WhatsApp sigue pendiente. Este informe conserva esos pendientes y no declara completados los tres casos ni el paso 8.
