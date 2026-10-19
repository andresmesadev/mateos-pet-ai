# Barrio del propietario y formulario reorganizado

17 de octubre de 2026. [Diseño previo, cinco etapas y revisión visual](../architecture/client-neighborhood-form-20261017.md), usando la guía frontend-design y los tokens existentes del dashboard.

La ficha del propietario conserva una superficie principal y agrupa contacto, ubicación y notas mediante divisores. Nombre/correo y teléfonos se alinean en dos columnas; Dirección tiene mayor ancho que Barrio; móvil usa una columna. Los campos opcionales siguen visibles, las notas conservan su texto y tienen altura inicial contenida, y Guardar/Cancelar mantienen el footer fijo y la protección de borrador.

Barrio es opcional en edición, consulta y alta conjunta. Se guarda en `User.neighborhood` separado de la dirección. La ficha de mascota recibe también la ubicación del propietario, incluso al abrirla desde Cliente. Un traslado nuevo propone ese barrio; un traslado ya configurado mantiene su snapshot y permite que Barrio quede deliberadamente vacío. No se extraen barrios de direcciones históricas ni se modifican citas por editar el contacto.

```text
Prisma local, 127.0.0.1:5433/mateos_dev:
  Applied 20261017220000_client_neighborhood
  All migrations have been successfully applied (59 total)
prisma generate: Prisma Client v7.10.0 generado correctamente
Backend Jest completo:
Test Suites: 205 passed, 205 total
Tests:       1679 passed, 1679 total
Time:        41.321 s
ESLint de los siete archivos frontend modificados: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --client-pet-names --new-owner-prices:
  Onboarding integration: 15 passed, 0 failed
verify-onboarding-local.cjs --grooming-transport:
  Onboarding integration: 33 passed, 0 failed
git diff --check: exit_code 0
```

Los ensayos Chrome/NextAuth/proxy/PostgreSQL verificaron guardado/reapertura, borrado explícito, omisión conservadora de consumidores anteriores, borrador protegido ante Escape, altas con barrio, rechazo de tipo/longitud inválidos y acceso a cliente de otro Tenant. Tras editar Barrio, la dirección y las notas mantuvieron sus valores. La prueba de peluquería mostró el barrio del propietario en la mascota y lo propuso al configurar el traslado. Conservó el recorrido financiero completo, inventario y comisiones. Las pantallas 320/390/768/1440 no desbordaron horizontalmente.

Seis pruebas de integración nuevas cubren el contrato de contacto, conservación/borrado, entradas inválidas, Tenant y acceso operativo sin notas privadas. Una expectativa anterior del DTO de mascota se actualizó para incluir el nuevo campo nullable; después pasó la suite completa.

Capturas de escritorio/móvil revisadas: `.cache/onboarding-verification/29-client-neighborhood-form-desktop.png` y `30-client-neighborhood-form-mobile.png`. La captura móvil incluye avisos temporales de los guardados consecutivos del ensayo; los botones y la distribución no cambian por este ajuste.

Las 59 migraciones existentes se aplicaron desde cero en PostgreSQL desechable; ambos contenedores fueron eliminados. La base local recibió solo la columna nullable aditiva, sin modificar fichas reales. Sigue el aviso previo del reactor `EventDelivery_domainEventId_fkey` documentado en el cierre financiero, fuera de esta mejora de contacto.

Sin commit/push/despliegue ni VPS modificada. Producción/declaración sigue en 2.49.0, lote menor local candidato 2.50.0. Son seis migraciones del lote pendientes de publicación.
