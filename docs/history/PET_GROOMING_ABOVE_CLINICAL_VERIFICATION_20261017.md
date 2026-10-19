# Peluquería y domicilio en la ficha principal

17 de octubre de 2026. [Diseño previo](../architecture/pet-grooming-above-clinical-20261017.md).

En Datos y cuidados, la ficha de mascota muestra Peluquería y domicilio antes de Datos clínicos, tanto en consulta como al editar. Incluye Valor del servicio y Valor del domicilio y el botón de guardado existente. La identificación se mantiene encima durante la edición. Tarifas acordadas conserva los acuerdos específicos por servicio.

Se trasladó la única instancia de `PetGroomingPrices`, sin duplicar estados, lógica de precios ni formularios. Se conserva montada al entrar/salir de edición; su borrador y la protección ante cierre permanecen activos. Misma autorización administrativa y endpoint autenticado; no se alteran precios importados, historial ni comisiones.

```text
ESLint pet-medical-sheet.tsx: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --grooming-transport:
Onboarding integration: 31 passed, 0 failed
git diff --check: exit_code 0
```

El ensayo Chrome/NextAuth/proxy/PostgreSQL abrió Datos y cuidados y encontró 95.000 de servicio y 8.000 de domicilio. Escribió un borrador de 9.000, entró/salió de Editar conservándolo y comprobó la posición del bloque antes de Datos clínicos a 1440 y 390 píxeles sin desbordamiento horizontal. Guardó ambos cambios de domicilio mediante el endpoint real y mantuvo los recorridos previos de agenda, importación, transporte, carrito, pago, inventario y comisiones. Captura revisada: `.cache/onboarding-verification/25-pet-grooming-above-clinical.png`.

Las 57 migraciones existentes se aplicaron en PostgreSQL desechable; contenedor eliminado. Sin cambio backend ni migraciones nuevas: no se repitió Jest; el resultado anterior del lote sigue siendo 203 suites/1.659 pruebas aprobadas. Persiste el aviso previo del reactor `EventDelivery_domainEventId_fkey` documentado en el cierre financiero, fuera de este ajuste de presentación.

Sin datos reales alterados ni VPS modificada. Sin commit/push/despliegue; versión declarada/productiva 2.49.0 y lote menor local candidato 2.50.0.
