# Alta con contacto visible y precios por mascota

17 de octubre de 2026. [Diseño previo en cinco etapas](../architecture/new-owner-pet-grooming-prices-20261017.md).

Nuevo propietario + mascota(s) reúne teléfono alternativo, correo, dirección y notas autorizadas dentro de Contacto del propietario, visibles sin desplegable y conservando su opcionalidad. Cada mascota incorpora Peluquería y domicilio con dos importes opcionales independientes. Vacío se guarda pendiente (`null`); cero permanece gratuito. El borrador protegido incluye también los precios aunque no se haya completado el nombre.

El POST `/clients/with-pets` persiste los dos campos existentes de precio dentro de la misma transacción de creación. Valida toda la lista antes de comenzar, reutiliza el validador monetario y el resolvedor de precios para el máximo total, y rechaza asignación de precios por operadores sin administración. El Tenant procede de la identidad autenticada. No agrega migraciones, total combinado ni modificaciones a precios históricos/comisiones.

```text
Jest específico del alta: 10 passed, 10 total
Backend Jest completo:
Test Suites: 204 passed, 204 total
Tests:       1669 passed, 1669 total
Time:        43.304 s
ESLint new-owner-pets-sheet.tsx: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --new-owner-prices:
Onboarding integration: 11 passed, 0 failed
git diff --check: exit_code 0
```

Chrome/NextAuth/proxy/PostgreSQL verificó los opcionales dentro del grupo Contacto del propietario, borrador de precio protegido ante Escape, rechazo visual de importe negativo y alta real de tres mascotas con importes `[60000,12000]`, `[0,null]` y `[null,null]`. Leyó los campos persistidos del propietario y las mascotas, incluidos Tenant y asociación. Una segunda petición con precio inválido en la segunda mascota no creó ningún propietario ni mascota. Pantallas 320/390/768/1440 sin desbordamiento horizontal. Capturas revisadas: `.cache/onboarding-verification/26-new-owner-contact-visible.png` y `27-new-owner-pet-prices.png`.

Las pruebas de endpoint cubren precios por mascota, cero, ausencia, números negativos, cadenas, booleanos, exceso de decimales, importes/total fuera del máximo, Tenant autenticado y denegación de precios incluso cero a operadores básicos. El alta básica con alertas operativas conserva compatibilidad. El escenario de feedback con fixtures se actualizó a campos siempre visibles; ese recorrido amplio no se volvió a ejecutar, usando para este cambio el ensayo autenticado real anterior.

Las 57 migraciones existentes se aplicaron desde cero en PostgreSQL desechable y su contenedor se eliminó. Sin datos reales alterados, mensajes externos ni VPS modificada. Sin commit/push/despliegue; versión declarada/productiva 2.49.0, lote menor local candidato 2.50.0 y cuatro migraciones anteriores pendientes de publicación.
