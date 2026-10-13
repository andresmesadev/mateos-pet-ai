# Ensayo interno de capacidad — 13 de octubre de 2026

**Estado:** ensayo interno de carga ligera completado y aprobado para su alcance observado; no constituye cierre de capacidad para cinco participantes ni apertura de beta externa.
**Versión:** 2.46.7. **Establecimientos:** uno. PostgreSQL permanece en la VPS; número de prueba de Meta vigente.

## Alcance confirmado

El responsable confirmó tres sesiones abiertas: su cuenta administradora y los accesos de ejemplo de veterinaria y peluquería preparados sobre las fichas existentes. Esas dos identidades fueron comprobadas por HTTPS antes del ensayo, con su tenant y permisos efectivos. El uso humano simultáneo se declara por el responsable; los logs HTTP actuales no registran identidad por solicitud y no permiten atribuir cada lectura a una persona.

Se solicitó navegar normalmente entre WhatsApp y agenda durante veinte minutos y enviar desde el WhatsApp de prueba una consulta sobre horarios. No se envían mensajes desde scripts ni se generan reservas ficticias para sustituir ese tráfico.

## Ventanas y evidencias

| Captura | Inicio Colombia | Fin | Estado |
| --- | --- | --- | --- |
| Preflight de recursos | 17:58:19 | 17:58:29 | Dos muestras completas |
| Recursos del ensayo | 18:00:21,995 | 18:20:21,995 | 81 muestras, 1.200 segundos completos, separación 15 s |
| Observación independiente de estabilidad | 15:33:35 del 13 de octubre | Previsto 15:33:35 del 15 de octubre | Continúa en 2.46.7; no reiniciada por este ensayo |

Archivos agregados privados, ignorados por Git:

- `.cache/capacity/pilot-preflight-2.46.7-20261013.jsonl`
- `.cache/capacity/pilot-real-2.46.7-20261013T230017Z.jsonl`
- `.cache/capacity/pilot-real-2.46.7-20261013T230017Z-checks.jsonl`

Las consultas auxiliares leen mensajes solo para derivar presencia y tiempos; no guardan cuerpos, teléfonos, cookies ni contraseñas. Los contadores HTTP provienen del access log de Nginx: rutas agregadas sin parámetros ni identificadores. No confundir lecturas automáticas del dashboard con conversaciones reales del asistente.

## Preflight y primeras comprobaciones

Preflight: RAM disponible mínima **10,63 GiB**, disco libre mínimo **71,01 %**, CPU observada máxima **2,75 %**, hasta once conexiones cliente. Cero cola pendiente/en revisión, leases vencidos, bloqueos, transacciones largas, deadlocks, OOM o reinicios observados. Respaldo existente terminado a las 15:19:19, `Result=success`, `ExecMainStatus=0`; timer activo.

Salud pública correcta a las 17:59:37: versión 2.46.7, base/OpenAI/worker `ok`, worker saludable y cero fallos consecutivos. Una consulta inicial a `/health` devolvió 404 porque esa ruta no existe; corregida a `/api/health`. La primera proyección de campos de primer nivel devolvió nulos; se repitió usando el contrato real `services`/`workers`. Ninguno de esos intentos se presenta como fallo de producción ni como validación de servicios aprobada.

A las **18:02:43**, Nginx registraba **36 solicitudes del dashboard, todas HTTP 200**, desde el inicio del bloque. Todavía no había webhooks ni mensajes/jobs nuevos; último mensaje persistido a las 14:31:29. Se pidió comprobar el chat de destino y si llegó respuesta. No se interpreta la afirmación de envío como recepción o entrega comprobadas.

**Primer intercambio real, 18:12:39–18:12:44:** llegó un saludo, no la consulta de horarios solicitada. Timestamp de Meta a las 18:12:39; trabajo creado a las 18:12:40,769 y completado a las 18:12:44,475: 1,769 s entre timestamp del proveedor y encolado, 3,706 s de creación a finalización. Mensaje entrante y respuesta persistidos, un remitente, un intento, cero errores; recibos `sent` y `read` sin códigos de error. No atribuir doce minutos de demora al motor ni afirmar que ese saludo recuperó la consulta anterior: son eventos distintos. El responsable comunicó que había enviado al mismo chat y no recibía respuesta; la consulta inicial sigue sin evidencia de recepción. Se solicitó repetir únicamente la pregunta de horarios.

A las 18:14:07 había 159 solicitudes del dashboard, todas HTTP 200, y tres llamadas a `/webhook`. Las lecturas observadas corresponden a conversaciones y permisos; aún no hay evidencia HTTP de navegación de agenda durante este bloque. Cero líneas de logs de backend/frontend en la comprobación previa a la llegada del saludo; no presentar ausencia de logs como una prueba de carga del motor.

**Consulta repetida, 18:15:09–18:15:12:** pregunta de horarios persistida, respuesta con 11:00 y 17:00, trabajo `done/complete`, un intento, cero errores. Duración creación→finalización **2,707 s**; respuesta persistida a las 18:15:12,227. Recibos `sent`, `delivered` y `read` correlacionados con el ID de esa respuesta, sin errores. Los recibos del saludo también coinciden con su respuesta. Acumulado: dos entrantes y cinco recibos completos, un remitente; máximo creación→finalización 3,706 s. Con dos observaciones no se estima la cola de distribución ni se acredita una ráfaga de cinco remitentes.

## Resultado final

| Criterio | Resultado |
| --- | --- |
| Duración, número de muestras y continuidad | 81 muestras, 1.200 segundos; separación máxima 15,126 s, sin huecos relevantes. Proceso terminado y stderr vacío |
| Recursos | CPU media 2,70 % (80 intervalos), máxima 11,00 %; RAM disponible mínima 10,61 GiB / 90,95 %; disco libre mínimo 71,01 % |
| PostgreSQL y cola | Conexiones cliente máximas 11/100, una consulta activa como máximo en las muestras; cero bloqueos, transacciones largas, deadlocks, trabajos pendientes/en revisión o leases vencidos observados |
| Contenedores | Cero OOM/reinicios observados en backend, frontend y PostgreSQL |
| Solicitudes HTTP durante el bloque | 243/243 HTTP 200; cero 429/5xx en las rutas del dashboard capturadas. Incluye lecturas automáticas y navegación, no 243 acciones manuales ni 243 clientes |
| Remitentes, mensajes y recibos | Un remitente, dos entrantes y sus dos respuestas; dos jobs entrantes y cinco recibos `done/complete`, un intento por entrante, cero errores |
| Latencias creación→finalización | 2,707 y 3,706 s; descriptivos n=2: p50 2,707 s, p95/máximo 3,706 s. Inferior al objetivo provisional de 30 s en estos dos intercambios, sin estimación fiable bajo ráfagas |
| Uso humano | Responsable confirmó perfiles correctos y WhatsApp/agenda sin errores ni cambio de cuenta en las tres sesiones |
| Logs del bloque | 94 líneas de backend/frontend, cero firmas de error o limitación detectadas; no auditoría exhaustiva de toda condición posible |
| Salud posterior, 18:21:16 | 2.46.7, base/OpenAI/worker `ok`, worker saludable |
| Cierre del paso 2 | Accesos y ensayo ligero aprobados. Abierto para contrastar el alcance propuesto de cinco remitentes reales; no sustituirlo por el benchmark aislado |

El conteo HTTP se acotó a los segundos 18:00:21–18:20:21 inclusive, por la resolución del access log. Navegación observada: agenda, consultas, peluquería, caja e inventario, además de WhatsApp y permisos. La atribución a tres identidades proviene del ingreso verificado previo y la confirmación humana; Nginx no registra el actor autenticado. Tampoco prueba una conversación nueva de cada operador ni concurrencia de cinco clientes. La instrumentación de solo lectura comparte recursos con el servicio y los intervalos de quince segundos pueden omitir picos breves.

Recibos del saludo: `sent/read`; consulta de horarios: `sent/delivered/read`, todos correlacionados por ID de respuesta. La consulta repetida menciona ambos servicios, lunes a sábado, 11:00–17:00 y festivos. La consulta inicialmente declarada no apareció; no hay evidencia suficiente para atribuir su ausencia a Meta, al cliente o al motor. No se cambió configuración ni se rotó el token para hacer funcionar la repetición.

Huella SHA-256 de recursos: `7922177936bcea285582042ed65266921eab352c26a88989d5c40440a4773327`. Huella de comprobaciones agregadas: `e2543ffa3ccd95032f742eca7461964388941509e5a5252851fb4df9ba48deb6`. Archivos privados conservados; contraseñas fuera de Git.

**Validación de herramientas y documentación:** `node --test scripts/capacity-tools.test.cjs scripts/observe-production.test.cjs`: siete pruebas aprobadas, cero fallidas, exit 0, 313,879 ms. Lint frontend exit 0; `git diff --check`, exit 0. No hubo cambio de código, despliegue ni reinicio por este ensayo. La ventana independiente de estabilidad tenía 34 muestras y 2 h 45 min a las 18:18:35, sin fallos; todavía no 48 horas.

**Siguiente verificación de capacidad:** coordinar los remitentes verificados realmente disponibles para una ráfaga moderada durante uso del dashboard; registrar número real, cola, tiempos y entregas. Conservar este ensayo aprobado, no repetir la matriz completa del paso 8. No ampliar automáticamente el cupo ni activar workers adicionales. Los documentos y condiciones del piloto pueden avanzar en paralelo mientras se reúne ese tráfico.

Referencias: [guía del piloto](INTERNAL_PILOT_RUNBOOK.md), [capacidad técnica y límites](VPS_CAPACITY_VERIFICATION_20261013.md), [plan de beta](CLOSED_BETA_READINESS_PLAN_20260919.md). El paso 8 conserva su cierre; el paso 9 requiere su propia ventana completa y las demás condiciones del plan continúan independientes.
