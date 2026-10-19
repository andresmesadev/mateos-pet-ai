# Lista de clientes con nombres de mascotas — verificación local

17 de octubre de 2026. [Diseño previo](../architecture/client-list-pet-names-20261017.md).

La vista Clientes presenta Cliente (nombre/teléfono), Mascotas (todos sus nombres) y Acciones. Retira Citas y Última actividad de la tabla y las tarjetas móviles. Los nombres se distribuyen en etiquetas con ajuste de línea, sin recorte ni límite de cinco mascotas; un cliente sin mascotas muestra un estado explícito. Ver/Editar y la eliminación autorizada conservan sus controles.

El resumen paginado incluye la relación `pets` con solo id, nombre y especie, filtrada por Tenant y ordenada por nombre/id. No agrega solicitudes por fila ni cambia el historial. Los contadores y fechas permanecen en el contrato para otros consumidores. Sin migraciones ni modificación de registros reales.

## Resultado real de comandos

```text
Backend Jest completo:
Test Suites: 203 passed, 203 total
Tests:       1659 passed, 1659 total
Time:        48.282 s
ESLint clients-table.tsx y lib/clients.ts: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --client-pet-names:
Onboarding integration: 11 passed, 0 failed
git diff --check: exit_code 0
```

Chrome/NextAuth/proxy/PostgreSQL verificó dos propietarios homónimos con mascotas diferentes; los siete nombres del primero, uno muy largo; un cliente sin mascotas; exclusión de propietario/mascota de otro Tenant; y apertura de la ficha correcta desde móvil. La respuesta autenticada devolvió solo los tres campos previstos por mascota. Las pantallas 320, 390, 768 y 1024 no tuvieron desbordamiento horizontal. Capturas de escritorio y móvil revisadas: `.cache/onboarding-verification/21-clients-pet-names-desktop.png` y `22-clients-pet-names-mobile.png`.

Se aplicaron las 57 migraciones existentes desde cero en PostgreSQL desechable; el contenedor fue eliminado. Sin datos reales alterados, pagos ni mensajes externos. Versión declarada/productiva 2.49.0; mejora acumulada en el lote local candidato 2.50.0, pendiente de commit/push/despliegue. Las cuatro migraciones pendientes del lote anterior siguen iguales.
