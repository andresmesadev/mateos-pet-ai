# Revisión de las 48 horas de estabilidad — 13 de octubre de 2026

## Resultado

**La ventana de salud de la infraestructura está aprobada. El paso 9 completo sigue abierto por dos fallos de entrega de recordatorios y por falta de una prueba representativa de carga.** El paso 8 conserva sus pruebas pendientes; esta revisión no lo ejecuta ni declara habilitada una beta externa.

**Seguimiento posterior del 13 de octubre:** las correcciones se publicaron y desplegaron en 2.46.5, CI y 1.467 pruebas aprobados. Se comprobó la omisión segura de los recordatorios vencidos y el rechazo 405 de peticiones de acción antes del parsing. Ver [implementación, evidencia y nueva ventana](STABILITY_REMEDIATION_20261013.md). Las cifras siguientes describen la ventana histórica de 2.46.4, que permanece preservada.

Versión observada y vigente: **2.46.4**. Código `ad422ed811ac22c3cf56e3a9695e2dd6240ba6ff`; checkout local y VPS `a322560adb87e4aee44015266c36e5c67e3a6ac7` al revisar, que añadió documentación sin cambiar el código. VPS limpia. Todas las comprobaciones del servidor fueron de lectura; no se enviaron mensajes, cambiaron citas, reiniciaron servicios ni modificaron credenciales.

## 1. Ventana terminada

| Medición | Resultado |
| --- | --- |
| Inicio, Colombia | 10 de octubre, 16:53:20 |
| Final, Colombia | 12 de octubre, 16:53:20 |
| Cobertura | 48,0000039 horas |
| Muestras, cada 5 minutos | 577 |
| Muestras fallidas / registros inválidos | 0 / 0 |
| Huecos superiores a la tolerancia | 0 |
| Versiones durante la ventana | Solo 2.46.4 |
| Reinicios o fallos registrados del worker | 0 |
| HTTP de salud / base / OpenAI / worker | Todas las muestras correctas |
| Latencia de salud, mediana / p95 / máxima | 1.650 / 2.376 / 3.311 ms |

Estas latencias incluyen la conexión desde el equipo del operador; no son tiempos de respuesta del asistente ni una prueba de carga. No se sumaron ventanas incompletas de versiones anteriores.

Evidencia local preservada: `.cache/stability/ventana-2.46.4-20261010T215319Z.jsonl`. SHA-256: `351071f7e9aeaab18c87f8e1672706bd4bd6d39ce0d81ff8c412b1846c257603`. El archivo está en caché local; este informe conserva el resumen verificable y su huella.

Salida real del comando:

```text
node scripts/observe-production.cjs --summarize .cache/stability/ventana-2.46.4-20261010T215319Z.jsonl
exit 0
verdict: health_window_passed
samples: 577
startedAt: 2026-10-10T21:53:20.025Z
endedAt: 2026-10-12T21:53:20.039Z
coverageHours: 48.00000388888889
gaps: 0
failedSamples: 0
restarts: false
recordedWorkerFailure: false
```

`health_window_passed` certifica las muestras de salud, no entrega de WhatsApp, corrección de agenda ni capacidad bajo tráfico intenso.

## 2. Cola y entrega en ese mismo período

Consulta limitada a los timestamps de la ventana; mensajes sin publicar contenido ni números de clientes:

| Evidencia | Resultado |
| --- | --- |
| Mensajes entrantes / trabajos `whatsapp` | 4 / 4, todos `done/complete` |
| Recibos `whatsapp_delivery` | 23, todos procesados `done/complete` |
| Trabajos con `lastError` / más de un intento | 0 / 0 |
| Respuestas del asistente | 4; las 4 con ID de proveedor y entrega o lectura |
| Mensajes automáticos del sistema | 5; 3 con entrega o lectura, 2 con recibo `failed` |
| Salientes sin recibo relacionado | 0 |

**Procesar un recibo fallido correctamente no convierte el mensaje en entregado.** Por eso una cola vacía y salud verde no permiten afirmar que todos los mensajes llegaron.

Revisión actual del 13 de octubre: 90 trabajos entrantes y 79 recibos históricos, todos `done/complete`; cero trabajos pendientes y cero leases vencidos. No se mezclan estas cifras acumuladas con el tráfico de la ventana.

### EST-01 — Recordatorios rechazados fuera de la ventana de atención

Los dos recibos fallidos llegaron el **12 de octubre a las 09:00:03 y 09:00:04 de Colombia**. Ambos contienen `errorCodes: [131047]` y corresponden a recordatorios de cita. El último mensaje de cada propietario había llegado unas **40,25 y 40,32 horas** antes. Se verificó por propietario, incluyendo sus distintos hilos, no solo por la conversación usada para el recordatorio.

El código actual de `sendReminder` invoca `sendMessage` con texto normal. El proveedor de Comunicación resuelve ese recorrido mediante `sendWhatsAppMessage`; la aceptación inicial devuelve un ID y el recibo posterior registra el rechazo. Esto explica por qué no aparece una excepción del worker ni `lastError` pese al fallo de entrega.

**Diagnóstico:** los tiempos, el tipo de mensaje y el código de rechazo apuntan al envío fuera de la ventana de atención. La [política oficial de WhatsApp, sección 2](https://whatsappbusiness.com/policy/) confirma que fuera de las 24 horas desde el último mensaje del usuario solo se pueden enviar plantillas aprobadas. La página técnica específica de códigos de Meta no pudo consultarse por limitación HTTP 429; no se presenta como una fuente leída para mapear el código.

**Trabajo recomendado antes de cerrar estabilidad operativa:** revisar el envío de recordatorios en Comunicación, consultar la última interacción del propietario y utilizar una plantilla aprobada fuera de ventana. Mientras el número de prueba no tenga una plantilla adecuada comprobada, omitir el envío incompatible con un resultado explícito y trazable. Conservar recibos y distinguir aceptación del proveedor de entrega efectiva; no reintentar automáticamente texto que seguirá siendo rechazado ni marcarlo como entregado. Repetir una prueba dentro y otra fuera de ventana. Reutilizar los casos de uso y el proveedor existentes; no introducir otra plataforma de mensajería.

No se implementó este cambio durante la revisión ni se asumió que una plantilla existente sea apta para estos recordatorios.

## 3. Logs y continuidad

Se analizaron los logs Docker retenidos para el mismo intervalo:

| Servicio | Líneas | Hallazgo |
| --- | --- | --- |
| Backend | 1.223 | Cero entradas de nivel error/warn y cero firmas de error de certificado, conexión a BD, lease vencido, `needs_review`, excepción no capturada o memoria agotada |
| Frontend | 105 | 35 errores del mismo tipo: `The Server Reference ID did not match the expected format. Received "x".` |
| PostgreSQL | 22 | Cero firmas de error/warning en la revisión |

### EST-02 — Solicitudes con identificador de acción inválido

Los 35 registros del frontend son errores de formato de solicitudes de acciones del servidor. No hubo reinicio del contenedor ni una caída detectada en las muestras de salud. El smoke autenticado actual pasó. **Su origen en tráfico automatizado es una hipótesis**, no una atribución demostrada por estos registros: no se conservaron encabezados suficientes para asociar cada petición con un cliente o emisor.

Se recomienda comprobar rutas/encabezados y el tratamiento de peticiones inválidas antes de decidir una corrección o filtro. No silenciar el log como sustituto del diagnóstico ni atribuirlo al flujo del asistente sin evidencia. No se demuestra una vulneración o acceso a datos por observar esa excepción.

Los logs compartidos de Nginx contienen 7.132 peticiones en el intervalo y ninguna respuesta 5xx registrada. Cubren otros sitios de la VPS y **no certifican por sí solos** las rutas de este proyecto ni explican las 35 excepciones. No se publican IPs, encabezados ni consultas.

Docker al revisar: backend, frontend y base `running`; PostgreSQL `healthy`. Los tres contenedores tienen `RestartCount=0` y `OOMKilled=false`. El backend sigue iniciado desde el despliegue del 10 de octubre; el worker conserva `startedAt=2026-10-10T21:52:54.735Z`.

## 4. Salud y capacidad actuales

Muestra del **13 de octubre a las 11:42:56 de Colombia**: HTTP 200, versión 2.46.4, base/OpenAI/worker `ok`, cero fallos consecutivos y `lastFailureAt=null`.

Fotografía de recursos tomada durante esta revisión:

- RAM del host: 11.941 MiB totales; 815 MiB usados; 10.869 MiB disponibles. El caché del sistema no es memoria perdida.
- Disco raíz: 194 GB, 54 GB usados, 141 GB disponibles, 28% de uso.
- Contenedores: backend aproximadamente 207 MiB; frontend 122 MiB; PostgreSQL 57 MiB. CPU entre 0% y 0,01% en esa lectura.
- PostgreSQL: 46 migraciones aplicadas, ninguna pendiente; una conexión activa en la consulta de diagnóstico.
- Última ejecución del backup en la VPS: 13 de octubre, 03:11:29 Colombia; `Result=success`, `ExecMainStatus=0`.

Son datos actuales, no un histórico de CPU/RAM/conexiones de las 48 horas ni una restauración nueva. Solo hubo cuatro mensajes entrantes durante la ventana: el **paso 2 sigue abierto para medición bajo carga representativa del piloto**.

## 5. Verificación y siguiente decisión

```text
node --test --test-reporter=tap scripts/observe-production.test.cjs
exit 0; tests 5; pass 5; fail 0; duration_ms 113.944

node node_modules/eslint/bin/eslint.js . (frontend)
exit 0

scripts/verify-release-https.cjs ejecutado por stdin en frontend de la VPS
exit 0
Autenticación de administrador: PASS
14 destinos autenticados: HTTP 200
Contratos de Caja/servicios/inventario: PASS
Parámetros ambiguos: HTTP 400
Acceso anónimo: redirección a login / HTTP 401
Sin escrituras de negocio ni mensajes salientes
```

No cambió el código, schema o versión. La suite completa de 2.46.4 ya aprobada en CI (1.446 pruebas) es evidencia de su publicación, no una ejecución nueva de esta revisión.

1. Dar por **completa la subcomprobación de 48 horas de salud** de 2.46.4 y conservar sus muestras; no reiniciar el monitor para borrar los hallazgos.
2. Mantener **abierto el paso 9 operativo**: resolver EST-01, diagnosticar EST-02 y verificar entregas con tráfico representativo. Si cambia el código, la nueva versión requiere su propia observación.
3. Retomar después el **paso 8**: repetición de reprogramación, recogida y negación, y revisión/limpieza de las citas de prueba. Las fechas preparadas el 10 de octubre corresponden al **13 de octubre, que ahora es hoy**; comprobar su estado y la hora antes de reutilizarlas. No ejecutar automáticamente las instrucciones antiguas.
4. Mantener el número de prueba de Meta y la base en la VPS conforme a las decisiones del responsable. Esta revisión no exige contratar Neon ni cambiar de número.

Seguimiento: [plan de beta](CLOSED_BETA_READINESS_PLAN_20260919.md) y [tres pruebas de agenda](ASSISTANT_BOOKING_SAFETY_TRIAL_20261010.md).
