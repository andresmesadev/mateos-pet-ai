# Jornada manual y pausa local de WhatsApp

19 de octubre de 2026. [Diseño previo](../architecture/manual-agenda-and-whatsapp-pause-20261019.md), [ADR 027](../decisions/027-agenda-manual-sin-anticipacion-ni-secuencia.md).

El dashboard fija `manual: true` al consultar y validar el turno; el cliente HTTP no decide esa política. Muestra todos los turnos libres de hoy/futuro, sin secuencia obligatoria ni anticipación de 30 minutos. Una cita de hoy con hora ya pasada se crea como arrived para conservar la llegada frente al barrido de ausencias. Las citas futuras siguen confirmed. Se respetan Tenant, cierre/excepciones, profesional, capacidad y alineación de 20 minutos en peluquería. La resolución de horario usa área válida, habitual del día y solo después legado; un área explícitamente cerrada no se reabre por fallback.

La opción manual es interna y su valor por defecto es false. Se revisaron todos los consumidores: conversación, scheduling, validación de confirmación, reprogramación pública y API pública no reciben manual=true. Sus reglas autónomas permanecen. No se edita el motor de conversación ni se cambia su identidad o flujo.

## Verificación

```text
Backend Jest completo:
Test Suites: 209 passed, 209 total
Tests:       1703 passed, 1703 total
Time:        47.304 s
ESLint del formulario: exit_code 0
ESLint de los diez archivos JS principales (reglas base explícitas): exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript y 32 páginas correctos
verify-onboarding-local.cjs --grooming-transport:
  Onboarding integration: 37 passed, 0 failed
  PASS manual agenda exposes all open receptions and records a past time
       today as arrived; the no-show sweep preserves its arrival
  PASS own temporary PostgreSQL container removed
git diff --check: exit_code 0
```

Tres pruebas de disponibilidad nuevas cubren horas pasadas de hoy frente a regla autónoma, días anteriores rechazados, todos los turnos, prioridad de área, fallback por área ausente/inválida, cierre explícito, alineación, colisiones y cierre. Una prueba de ruta confirma que status/manual del body no deciden el comportamiento. Cuatro pruebas de pausa comprueban texto y plantillas sin HTTP, webhook sin encolado, worker sin reclamar trabajos, compatibilidad sin flag y salud de pausa sin éxito ficticio. Jest inicia la configuración de proveedores mock independientemente del .env local; las pruebas de pausa optan por false explícitamente.

El ensayo Chrome/NextAuth/proxy/PostgreSQL desechable mantiene el recorrido previo de importación, ficha, reserva cada 20 minutos, pago único, inventario y comisión. Añade una apertura ficticia para registrar hoy a las 00:00, comprueba arrived y ejecuta el barrido de no-show sin alterar esa llegada; después retira su fixture. Se aplicaron desde cero las 59 migraciones. No se crearon citas o clientes reales para verificar.

## Aplicación local efectiva

Se encontró que backend/.env conservaba credenciales de Meta. Se mantuvieron intactas y se añadió `WHATSAPP_ENABLED=false`, documentado también en .env.example. Ingress devuelve 503, salida de texto/plantilla se bloquea antes del HTTP, no se reclaman trabajos entrantes y no se programan inbound/recordatorios/abandono en el arranque pausado. Las colas y los datos existentes no se borran. La salud reconoce la pausa intencional, sin reportar un worker que nunca arrancó como error.

El supervisor nodemon local recargó el backend con los cambios. Un intento de reinicio explícito se canceló antes de detener procesos al detectar que el PID ya había cambiado por esa recarga; no se inició un segundo backend ni se afectó otro proceso. Comprobación real: raíz HTTP 200; GET /webhook HTTP 503; /api/health HTTP 200, status=ok, inboundWorker=paused, healthy=true.

Lectura de la clínica local, sin modificar sus horarios: 19 de octubre, ventana efectiva guardada para ambas áreas 10:35–17:00. Peluquería tiene 18 turnos libres, desde 10:55 hasta 16:35; el inicio 10:35 ya estaba ocupado. Veterinaria tiene 11 turnos libres desde 10:35 hasta 15:35. Los minutos se conservan según configuración, sin redondear a horas enteras.

Sigue el aviso previo del reactor EventDelivery documentado en el lote financiero, fuera de esta precisión de agenda. La pausa es global al entorno local; reactivar requiere revisar cola y canal, y cambiar configuración/reiniciar conscientemente. No se cambia Meta, la VPS ni la pausa productiva ya documentada. Sin migración nueva, commit/push/despliegue. Producción declarada sigue 2.49.0; lote candidato 2.50.0 con seis migraciones anteriores pendientes.
