# Recepción de peluquería cada 20 minutos — verificación local

19 de octubre de 2026. [ADR 026](../decisions/026-recepcion-peluqueria-cada-20-minutos.md) y [diseño previo](../architecture/grooming-twenty-minute-slots-20261019.md).

La política compartida `reservation-slot.js` define 20 minutos de recepción para el bucket de peluquería. Disponibilidad, sugerencia del próximo turno, creación atómica, reprogramación y asignación del peluquero usan ese intervalo. La generación y secuencia usan minutos enteros; los contratos existentes conservan horas decimales y la UI conserva HH:mm. Google Calendar representa ese bloque para eventos nuevos/actualizados, sin activar el proveedor ni modificar eventos existentes.

La duración de catálogo permanece intacta, al igual que citas, precios y comisiones guardados. Veterinaria mantiene su capacidad y la duración real de servicio al asignar staff. Cierres, festivos, ausencias, habilitaciones, Tenant, anticipación de 30 minutos y secuencia de huecos futuros se conservan. No hay migración nueva.

## Evidencia ejecutada

```text
Backend Jest completo (node node_modules/jest/bin/jest.js --runInBand --silent):
Test Suites: 206 passed, 206 total
Tests:       1688 passed, 1688 total
Time:        56.419 s

ESLint sobre los diez archivos JS/CJS de código y pruebas del cambio:
  --no-config-lookup
  no-unreachable, no-dupe-args, no-dupe-keys, valid-typeof: error
  exit_code 0
node --check de política y servicios principales: exit_code 0

verify-onboarding-local.cjs --grooming-transport:
  PASS grooming starts at :00/:20/:40 with the same groomer;
       concurrent duplicate and 10-minute overlap are blocked,
       reschedule preserves identity and catalogue duration
  Onboarding integration: 35 passed, 0 failed
  PASS own temporary PostgreSQL container removed
git diff --check: exit_code 0
```

Seis regresiones unitarias adicionales comprueban los 18 turnos de una ventana 11–17 sin acumulación decimal, sugerencias con :20/:40, cruces menores de 20 minutos, apertura a las 10:30 y cierre parcial, peluquero único con duración de catálogo de 60 minutos, veterinaria sin cambio y ventana atómica de reprogramación. Las expectativas anteriores de una hora en peluquería se ajustaron al requerimiento nuevo.

Chrome, NextAuth y proxy reales verificaron creación a los 20 minutos, filtrado por peluquero, carrera de dos reservas del mismo turno (201/409), rechazo de creación interna a los 10 minutos, reprogramación con identidad conservada y duración de catálogo de 60 minutos intacta. El recorrido completo posterior conservó transporte, pago único, productos, inventario, comisión sobre peluquería y anulaciones inmutables. Las 59 migraciones se aplicaron desde cero en PostgreSQL desechable. No se alteraron fichas reales ni se enviaron mensajes o cobros externos.

Dos ejecuciones iniciales del ensayo se corrigieron únicamente en sus fixtures: la comprobación interna omitía petName/petType obligatorios y el lunes de reemplazo coincidía con el festivo del 2 de noviembre. El código rechazó correctamente ambos casos. La ejecución final usa un lunes hábil. Permanece el aviso previo del reactor EventDelivery, ya documentado en el lote financiero.

El frontend no recibió cambios en este ajuste; el ensayo reutilizó su build aislado previamente aprobado. Búsqueda de capacidad/intervalos ejecutada sobre backend, frontend y scripts: la hora restante en sugerencias corresponde a veterinaria; los 60 minutos de seeds son duración de catálogo y permanecen deliberadamente.

Sin commit/push/despliegue. Producción y versión declarada continúan en 2.49.0; el lote candidato 2.50.0 mantiene las seis migraciones pendientes anteriores. WhatsApp sigue pausado.
