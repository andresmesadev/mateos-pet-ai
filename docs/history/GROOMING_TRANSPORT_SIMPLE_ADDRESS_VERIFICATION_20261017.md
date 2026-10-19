# Domicilio simplificado con barrio persistente

17 de octubre de 2026. [Diseño previo](../architecture/grooming-transport-simple-address-20261017.md).

El editor de Domicilio de peluquería conserva modalidad, Dirección confirmada, Barrio y Valor del domicilio (COP). Retira Zona, Observaciones/mascotas cubiertas y la casilla de confirmación. La ficha de consulta presenta dirección/barrio por separado y deja de mostrar zona/observaciones. Los datos anteriores de zona y alcance se conservan en el contrato y la persistencia.

Al abrir una modalidad se propone una vez la referencia existente del resolvedor; escribir un importe o cero lo prepara para aplicar al guardar. Borrarlo permite guardar precio pendiente sin que una respuesta posterior lo reponga. Guardar continúa siendo la acción explícita y autorizada que persiste la confirmación; el backend mantiene compatibilidad con su contrato previo. No se modifican reglas de precios, traslados compartidos, comisiones ni pagos históricos.

Se añade `Appointment.transportNeighborhood` nullable, validado como texto opcional de hasta 200 caracteres; omitirlo desde un consumidor anterior conserva el barrio existente, vacío explícito lo borra y modalidad en centro limpia los datos logísticos. No se infiere desde dirección o zona ni se modifica el domicilio del propietario.

```text
prisma migrate deploy, base local verificada 127.0.0.1:5433/mateos_dev:
  Applied 20261017213000_transport_neighborhood
  All migrations have been successfully applied (58 total)
prisma generate: Prisma Client v7.10.0 generado correctamente
Backend Jest completo:
Test Suites: 204 passed, 204 total
Tests:       1673 passed, 1673 total
Time:        42.268 s
ESLint de los cuatro archivos frontend: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --grooming-transport:
Onboarding integration: 33 passed, 0 failed
git diff --check: exit_code 0
```

Chrome/NextAuth/proxy/PostgreSQL comprobó ausencia de controles retirados, referencia propuesta de 8.000, borrador protegido ante Escape, barrio guardado y reabierto, dirección conservada al cancelar, cero gratuito (total 95.000), importe vacío pendiente, importe manual de 9.000 (total 104.000) y restauración a 8.000. El barrio actualizado quedó persistido y el domicilio original del cliente no cambió. Se conservaron los recorridos previos de importación, agenda, peluquero único/múltiple, pago único con adicionales, inventario y comisión final. Captura revisada: `.cache/onboarding-verification/28-grooming-transport-simple.png`.

Cuatro regresiones unitarias nuevas cubren normalización/limpieza del barrio, compatibilidad de consumidor anterior y tipo/longitud inválidos. La búsqueda de etiquetas retiradas en todo el repositorio solo encuentra la aserción negativa del escenario de pruebas; cero coincidencias en frontend. Las 58 migraciones se aplicaron desde cero en PostgreSQL desechable, cuyo contenedor se eliminó.

La base local recibió únicamente la migración aditiva, sin editar fichas ni citas reales. La prueba de escritura utilizó datos ficticios en PostgreSQL temporal. Sigue el aviso previo del reactor `EventDelivery_domainEventId_fkey` documentado en la verificación financiera; este cambio no certifica automatizaciones.

Sin cambios de VPS ni commit/push/despliegue. Producción/declaración continúa en 2.49.0; lote local menor candidato 2.50.0. Quedan cinco migraciones del lote pendientes de publicación, incluida la de barrio.
