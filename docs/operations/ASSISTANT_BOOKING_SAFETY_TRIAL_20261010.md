# Tres pruebas de seguridad de agenda desde WhatsApp

**Fecha:** 10 de octubre de 2026, hora Colombia. **Versión al comenzar:** 2.46.1; versión vigente 2.46.6 publicada y desplegada el 13 de octubre, con CI completo aprobado. **Estado actualizado 13 de octubre, 14:34 Colombia:** los dos recorridos finales y su limpieza están aprobados; **paso 8 del plan de preparación completado**. No certifica beta externa ni estabilización de la versión vigente. Los pendientes en apartados anteriores son registros históricos; el cierre siguiente es el estado actual.

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

Las pruebas aprobadas de días, festivos, horarios, reservas, concurrencia y cancelación conservan su evidencia. **Actualización del 13 de octubre, 14:02 Colombia:** el primer recorrido está aprobado; queda el segundo, incluida su limpieza. La observación de 48 horas pertenece al paso 9 y continúa por separado.

### Inicio del primer recorrido — 13 de octubre, 13:52 Colombia

Preparación de solo lectura en la VPS: el miércoles **14 de octubre de 2026** es hábil, horario de peluquería 11–17, primer turno consecutivo disponible **11:00**. No hay citas del propietario para ese día. La sesión anterior conserva Akiles/veterinaria; la petición nueva debe seleccionar explícitamente Matías/peluquería. Las dos reservas antiguas del martes 13 aparecen `no_show`; no se consideran cancelaciones verificadas ni se reutilizan para el conflicto futuro.

**Primer mensaje para enviar ahora, y después esperar:**

> Quiero peluquería para mi perro Matías el miércoles 14 de octubre

El operador debe esperar a la revisión de la respuesta antes de continuar. Después de comprobar mascota, servicio, fecha y turno, el recorrido será:

1. Aceptar únicamente el turno ofrecido y correcto; eso permite seguir con la modalidad, todavía no confirmar una reserva.
2. Responder exactamente «Quiero que lo recojan en casa» y comprobar que pida dirección.
3. Dar la dirección ficticia «Calle 10 #20-30, barrio Centro» y comprobar el resumen, que debe incluirla.
4. En la revisión final, responder **«No confirmo la cita»**. No enviar aceptación final con esa dirección ficticia.
5. Verificar reconocimiento del rechazo, ausencia de bucle, sesión, cola, entrega y cero citas nuevas. La prueba de dirección insuficiente ya aprobada no se repite como escenario independiente.

Se solicitó al operador el primer mensaje. Este apartado registra preparación e instrucciones; no afirma que el mensaje llegó ni que el recorrido terminó. El segundo recorrido se prepara después, con horarios futuros comprobados y limpieza de sus reservas.

**Primer intercambio verificado, 13:55–13:56 Colombia:** la solicitud llegó a las 13:55:50 (`cmv71k94300040itfbe68tjuj`). A las 13:55:54, el asistente ofreció mañana a las 11 para Matías (`cmv71kcdy000a0itfctt0ioi9`). Sesión `awaiting_grooming_slot_confirm`: Matías, `dog`, `bath_grooming`, `2026-10-14`, hora 11 y recogida todavía sin elegir. Cero citas del propietario para ese día. Cuatro trabajos desde la preparación, todos `done/complete`, sin errores; respuesta con ID de Meta y recibos `sent/delivered/read`.

Se pidió responder «Sí, acepto las 11:00» y, solo cuando pregunte la modalidad, «Quiero que lo recojan en casa». Esperar en la pregunta de dirección para verificar la transición. Todavía no se declara aprobada la variante de recogida ni el rechazo final.

**Recogida reconocida en WhatsApp, 13:57–13:59 Colombia:** «Sí, acepto las 11:00» llegó a las 13:57:46 y avanzó a la pregunta de modalidad a las 13:57:49, sin repetir la oferta. «Quiero que lo recojan en casa» llegó a las 13:59:07 y produjo la pregunta de dirección a las 13:59:10. Sesión `awaiting_domicilio_address`, Matías/perro/peluquería, 14 de octubre a las 11, recogida verdadera y dirección todavía vacía. Cero citas nuevas. Consulta desde las 13:55:55: 11 trabajos `done/complete`, sin errores; ambas respuestas con recibos `sent/delivered/read`. La variante «recojan» queda verificada con el canal/modelo reales.

Se pidió la dirección ficticia «Calle 10 #20-30, barrio Centro» y, solo ante el resumen correcto, «No confirmo la cita». El resultado real se verificó a las **14:02:29 de Colombia**:

- Dirección recibida a las 14:01:32 (`cmv71rlep001a0itfwwe6qiay`). La revisión de las 14:01:36 (`cmv71rnxp001g0itfvjyasqnz`) mostró Matías, peluquería, 14/10/2026, 11:00 AM, recogida y la dirección ficticia exacta; indicó «Aún no está guardada».
- «No confirmo la cita» llegó a las 14:02:12 (`cmv71sg40001o0itfxlkso8b0`). A las 14:02:14 (`cmv71shxu001u0itf3ke6ujev`) respondió: «De acuerdo, no he agendado la cita. Si quieres otro día, dime cuál. 🐾». No repitió la oferta ni avanzó como aceptación.
- Cero citas del propietario para el 14 de octubre. La sesión sigue en `awaiting_confirmation`, con el borrador de Matías y la dirección; no se afirma que el borrador haya sido eliminado.
- Los once trabajos consultados desde las 13:59:11 quedaron `done/complete`, sin errores. Tanto la revisión como el reconocimiento del rechazo tienen recibos `sent/delivered/read`.

**Primer recorrido aprobado en 2.46.5:** aceptación del turno, variante «recojan», dirección en revisión y rechazo final coherente, sin crear reserva.

### Preparación del segundo recorrido — 14:05–14:06 Colombia

Consultas de solo lectura: cero citas para el 14 de octubre y veterinaria disponible a las 12 y a las 13 en el establecimiento `cmued7q6200001anzpo2y1qtz`. Las reservas históricas del 13 de octubre (`cmv2x4pox001m0in5qo5jt7ys` y `cmv2x4p84001a0in5l8nzn9of`) están en `no_show`; no se reutilizan ni se presentan como canceladas.

El operador indicó que ahora tiene un solo número disponible. El recorrido se adapta a **Akiles/veterinaria a las 12 y Matías/veterinaria a las 13, miércoles 14**, en su mismo chat. Primero crear Akiles con consentimiento y verificar su ID; después crear Matías y verificar el suyo. Solo entonces seleccionar explícitamente Akiles e intentar moverlo a las 13, conservar ambas filas y cancelar exclusivamente las dos reservas nuevas mediante WhatsApp. Esto prueba destino ocupado; la concurrencia entre remitentes conserva su evidencia anterior y no se vuelve a certificar con un único número.

Esta sección registra disponibilidad e instrucciones, no reservas creadas ni rechazo de reprogramación aprobado.

**Primera reserva nueva verificada, 14:09:37 Colombia:** solicitud explícita de Akiles/veterinaria para el 14 a las 12 recibida a las 14:08:39 (`cmv720qvx00220itfghi3hydw`); revisión correcta a las 14:08:44 (`cmv720u9w00280itfme5db8d9`). «Sí, confirmo» a las 14:09:17 (`cmv721jwp002g0itfh7oircgf`) creó únicamente la cita `cmv721jxc002h0itf2r6jz0dr`, `confirmed`, Akiles/perro/`vet`, `2026-10-14T17:00:00Z` (12:00 Colombia). La confirmación final de las 14:09:18 (`cmv721kec002n0itfso2cd0fu`) coincide y contiene despedida.

Sesión `completed`, Akiles, consulta veterinaria y nueva fecha/hora; recogida y dirección anteriores en `null`. El nuevo pedido no conservó el borrador de Matías/peluquería. Ocho trabajos desde las 14:06:09, todos `done/complete`, sin errores. Se pidió preparar Matías/veterinaria para el 14 a las 13 en el mismo chat; esa segunda reserva y el intento de reprogramación todavía no están certificados.

GitHub y checkout de la VPS sincronizados en `3acc325` antes de esta consulta; solo documentación, sin reinicio ni reconstrucción. La observación de 2.46.5 continúa independiente de estos commits.

**Segunda reserva nueva verificada, 14:11:02 Colombia:** solicitud de Matías/perro/veterinaria para el 14 a las 13 a las 14:10:01 (`cmv722hkx002w0itf7nojndq5`); resumen correcto a las 14:10:03 (`cmv722jip00320itfgy3fjj27`). «Sí, confirmo» a las 14:10:23 (`cmv722yzu003a0itf5wt4ggmx`) creó la cita `cmv722z0b003c0itful0yiy9w`, `confirmed`, Matías/perro/`vet`, `2026-10-14T18:00:00Z` (13:00 Colombia). Confirmación correcta a las 14:10:24 (`cmv722zgd003i0itfenmhbmbv`), con despedida y atención en establecimiento.

Ambas filas nuevas persisten por separado; Akiles conserva su ID y las 12. La nueva conversación de Matías (`cmv722hku002v0itfa6jaotin`) terminó `completed`, sin dirección ni recogida anteriores. Resumen y confirmación con recibos `sent/delivered/read`; ocho trabajos desde las 14:09:37, todos `done/complete`, sin errores.

Se pidió seleccionar la cita veterinaria de Akiles del miércoles 14 mediante solicitud explícita de reprogramación y, cuando pregunte destino, responder el mismo día a las 13. Esperar ante selección ambigua; no aceptar alternativas ni cancelar todavía. **Intento y conservación posterior pendientes de mensajes reales.**

**Reprogramación a destino ocupado aprobada, 14:12:50 Colombia:** la solicitud de las 14:11:32 (`cmv724fqi003r0itfzjgjvc3o`) seleccionó Akiles/veterinaria, 14 a las 12. La respuesta de las 14:11:34 (`cmv724hzp003x0itfrw2imy7r`) mostró la original correcta y preguntó destino, aclarando que sigue reservada. El destino «El miércoles 14 de octubre a las 13:00» llegó a las 14:12:02 (`cmv7252z200450itf193zdlzi`). A las 14:12:04 (`cmv7254sj004b0itfpzj2zdsy`) rechazó la hora ocupada y ofreció alternativas, con «Tu cita original sigue reservada»; no produjo el saludo defectuoso anterior.

Las dos filas conservan ID, fecha y estado `confirmed`: Akiles `cmv721jxc002h0itf2r6jz0dr` a las 12 y Matías `cmv722z0b003c0itful0yiy9w` a las 13, sin duplicados. Sesión `awaiting_date_time` con selección de la original de Akiles y sin turno nuevo aceptado. Ambos mensajes del asistente tienen recibos `sent/delivered/read`; ocho trabajos desde las 14:11:02, todos `done/complete`, sin errores.

Se pidió cancelar primero únicamente la cita nueva de Akiles, con mascota/servicio/fecha/hora explícitos y consentimiento. Después se cancelará la de Matías y se comprobará liberación de las 12 y 13. **Limpieza pendiente: el paso 8 sigue abierto.**

**Cancelación de Akiles verificada, 14:14:03 Colombia:** solicitud explícita a las 14:13:19 (`cmv726qsw004j0itfqmsgml67`); pidió confirmar la cita correcta a las 14:13:22 (`cmv726spl004p0itfz89y3mdc`). «Sí, cancela esa cita» a las 14:13:32 (`cmv72710o004x0itf1rybkegh`) produjo reconocimiento con despedida a las 14:13:35 (`cmv7272ri00530itfjcnjg6om`). Solo `cmv721jxc002h0itf2r6jz0dr` cambió a `cancelled`; Matías sigue `confirmed` a las 13. Respuestas `sent/delivered/read`; ocho trabajos desde las 14:12:50, todos `done/complete`, sin errores.

La sesión quedó con paso `null` y todavía retiene `reschedule_appointment_id` de Akiles; no se afirma que esté vacía. Se pidió cancelar Matías con selección y consentimiento explícitos. Falta verificar esa segunda cancelación y disponibilidad efectiva de ambos turnos.

### Incidente de limpieza — 14:14–14:15 Colombia

La solicitud de cancelar Matías del 14 a las 13 llegó a las 14:14:56 (`cmv728tib005b0itf1vys7wnv`). A las 14:14:59 (`cmv728vwb005h0itfdz33l3ad`) el asistente respondió sobre cambiar la mascota de la reprogramación de Akiles, sin pedir consentimiento para cancelar Matías. Causa: selección antigua de Akiles retenida después de cancelarlo y guard de cambio de mascota antes del arbitraje de gestión.

Consulta de las 14:15:18: Akiles `cancelled`, Matías `confirmed`, doce libre y trece ocupado. Cuatro trabajos `done/complete`, sin errores; respuesta defectuosa `sent/delivered/read`. No fue pérdida de mensaje ni caída del worker. El paso 8 continúa abierto; no cancelar Matías desde un script ni declarar la agenda limpia.

Diseño acotado actualizado en [ADR 019](../decisions/019-asistente-contexto-y-operaciones-seguras.md). Regresión del diálogo real antes de corregir: **3 fallidas / 24 aprobadas**, exit 1. Después del ajuste inicial: **3 suites / 56 pruebas aprobadas**, exit 0, 2,885 s. Candidata **2.46.6**: gestión prioritaria sin sobrescribir el borrador con otra mascota, limpieza al cancelar la original y recuperación de selección inactiva en sesiones persistidas. Si la lista de citas alcanza el límite de 50, su ausencia no se toma como prueba de inactividad. No hay cambios de dominio, schema ni migraciones; verificación completa, publicación y repetición WhatsApp pendientes.

El paso de retorno guardado solo se aplica mientras hay una gestión pendiente; un `management_resume_step: null` de una gestión anterior no reemplaza el paso del borrador activo. Las regresiones también comprueban que rechazar la cancelación de otra mascota conserva la reprogramación y que confirmarla solo cancela su ID. Seguimiento de validación/publicación en [corrección 2.46.6](../history/RELEASE_2_46_6_MANAGEMENT_STATE_20261013.md).

**2.46.6 desplegada y recuperación real verificada, 14:31:19 Colombia:** CI final, 183 suites / 1.470 pruebas y cuatro jobs `success`; despliegue `c04c0bb`, exit 0, salud y smoke HTTPS correctos. La nueva solicitud de cancelar Matías llegó a las 14:30:48 (`cmv72t8ev00040impuhxwaq0m`). A las 14:30:52 (`cmv72tb15000a0imppy5y60ua`) pidió confirmar Matías/veterinaria, 14 a las 13. Sesión `awaiting_management_confirm`, ID exacto de Matías seleccionado y `reschedule_appointment_id: null`, sin borrador de Akiles. Cuatro trabajos completos, cero errores, respuesta `sent/delivered/read`. Recuperación aprobada; falta consentimiento y cancelación efectiva de Matías.

### Cierre de los dos recorridos — 14:32–14:34 Colombia

«Sí, cancela esa cita» llegó a las **14:31:27** (`cmv72u225000i0impp35z8k7q`). A las **14:31:29** (`cmv72u40a000o0impkxmg8zrw`) confirmó la cancelación de Matías/veterinaria del 14 a las 13, con despedida. Consulta de las **14:32:47**:

| Cita de esta prueba | Estado final | Horario original | Disponibilidad efectiva |
| --- | --- | --- | --- |
| Akiles `cmv721jxc002h0itf2r6jz0dr` | `cancelled` | 14/10/2026 a las 12:00 | Libre |
| Matías `cmv722z0b003c0itful0yiy9w` | `cancelled` | 14/10/2026 a las 13:00 | Libre |

Los registros permanecen como historial; no se borraron filas. La sesión queda con paso `null` y todas las claves de reserva/gestión/reprogramación en `null`, sin selección residual. Las dos reservas históricas del 13 conservan `no_show`; no se modificaron como parte de esta limpieza.

El proxy autenticado del calendario (`/api/proxy/dashboard/appointments/week?date=2026-10-14`) devolvió HTTP 200 a las **14:34:07** y ambos IDs `cancelled`, con sus fechas originales. Revisión de las **14:34:34** desde el arranque de 2.46.6: dos trabajos entrantes y seis recibos de entrega, todos `done/complete`, cero errores y leases vencidos. El mensaje final de cancelación tiene `sent/delivered/read`. Logs de backend/frontend: 99 líneas, cero firmas de error consultadas; es comprobación breve, no una ventana de 48 horas.

**Paso 8 completado:** recogida con resumen y negación aprobadas; destino ocupado rechazado con conservación; incidente de estado residual reproducido, corregido, publicado/desplegado y recuperación aprobada en WhatsApp; ambas reservas nuevas canceladas por el propietario, turnos libres y dashboard coherente. Se conserva la evidencia histórica de los demás casos, sin atribuir simultaneidad exacta ni múltiples procesos a la prueba de dos remitentes anterior.

El siguiente trabajo del plan es continuar el paso 9 con la ventana separada de 2.46.6 (13–15 de octubre, 14:30:40), junto con capacidad/carga representativa del paso 2 y documentación/cohorte pendientes. El número de prueba de Meta sigue vigente por decisión del operador; este cierre no abre automáticamente la beta externa.

| Caso | Estado | Evidencia |
| --- | --- | --- |
| Negación | Aprobada, incluida repetición final en 2.46.5 | El 13 de octubre a las 14:02 reconoció «No confirmo la cita» sin reofrecer ni crear reserva. |
| Dirección de recogida | Aprobada, incluida variante «recojan» y revisión final en 2.46.5 | Dirección ficticia exacta en resumen de Matías, peluquería, 14/10 a las 11; rechazo final y cero reservas. No valida ubicación geográfica. |
| Reprogramación a destino ocupado | Aprobada, incluida limpieza y recuperación de sesión en 2.46.6 | Rechazo y conservación a las 14:12; solo las dos reservas nuevas canceladas por el chat, doce y trece libres, sesión limpia y dashboard verificado a las 14:34. |

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
