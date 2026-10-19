# Búsqueda por propietario y mascota — verificación local

17 de octubre de 2026. [Diseño en cinco etapas](../architecture/appointment-owner-pet-search-20261017.md).

Nueva cita busca por propietario, teléfono o mascota mediante el autocomplete autenticado existente. Los resultados muestran propietario/teléfono y botones de sus mascotas. Pulsar una mascota carga el propietario y verifica la pertenencia actual antes de seleccionarla; pulsar el propietario conserva la elección entre sus mascotas y selecciona automáticamente si solo tiene una.

El filtro de mascotas respeta el Tenant resuelto y recupera coincidencias aunque sean anteriores a las cinco mascotas recientes. La respuesta conserva los campos consumidos por POS y agrega `matchingPets`; las búsquedas canceladas no reemplazan resultados actuales. Sin esquema nuevo ni cambios financieros.

## Evidencia real

```text
Jest backend completo:
Test Suites: 203 passed, 203 total
Tests:       1659 passed, 1659 total
Time:        40.493 s

Jest específico del buscador: 5 passed, 5 total
ESLint new-appointment-dialog.tsx: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --grooming-transport:
Onboarding integration: 30 passed, 0 failed
PostgreSQL temporal: 57 migraciones aplicadas desde cero; contenedor eliminado
git diff --check: exit_code 0
```

La prueba Chrome/NextAuth/proxy/PostgreSQL buscó Toby y verificó su selección con el propietario; buscó por nombre del propietario y por su teléfono persistido; creó seis mascotas recientes y encontró la Luna antigua; mostró dos Lunas de distintos propietarios y excluyó una tercera Luna de otro establecimiento. Eligió la Luna correcta y creó la cita. Se conservó el recorrido de peluquero único/múltiple, transporte, carrito con adicionales, pago único, inventario y comisión final.

Captura privada revisada: `.cache/onboarding-verification/20-appointment-owner-pet-search.png`. Una primera espera del ensayo no cambiaba el texto ya seleccionado del propietario; se corrigió la interacción de prueba para limpiar antes de volver a buscar. La segunda ejecución completa pasó.

Las comprobaciones usan datos ficticios y PostgreSQL desechable. No modifican clientes del ensayo local ni VPS. Sigue documentado el aviso previo del reactor `EventDelivery_domainEventId_fkey` en el recorrido financiero; no corresponde a este buscador ni certifica automatizaciones. Sin commit, push ni despliegue. Producción/declaración permanece en 2.49.0; se acumula en el lote menor candidato 2.50.0, con las cuatro migraciones anteriores pendientes de publicación.
