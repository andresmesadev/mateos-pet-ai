# Contacto importado y formulario del propietario — verificación

19 de octubre de 2026. [Cinco etapas y alcance](../architecture/owner-contact-import-cleanup-20261019.md).

Correo de contacto retirado de ClientSheet, NewOwnerPetsSheet, el alta simple NewClientSheet y el resumen de contacto del panel de conversaciones. Los correos existentes del backend y las credenciales administrativas no se eliminan. Ver expediente/Nueva cita tienen el mismo alto de 44 px y ancho en una cuadrícula de dos columnas. Otros teléfonos muestra cada número por separado y admite varios en alta/edición.

El adaptador de importación detecta solo el envoltorio legado `Registro original: R...`, recupera teléfonos individuales desde sus campos originales/normalizados y conserva observaciones reales sin IDs, tarifas o listas de fechas. Notas normales ajenas a ese formato no se limpian automáticamente. Reimportar mezcla teléfonos sin duplicar el principal, mantiene observaciones ya editadas y no duplica visitas. También conserva los teléfonos de propietarios con placeholder sin teléfono principal.

## Evidencia ejecutada

```text
Backend Jest completo:
Test Suites: 208 passed, 208 total
Tests:       1695 passed, 1695 total
Time:        50.077 s
ESLint de los cuatro componentes frontend: exit_code 0
ESLint de código/pruebas JS/CJS del cambio (reglas base explícitas): exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript y 32 páginas correctos
verify-onboarding-local.cjs --client-pet-names --new-owner-prices:
  Onboarding integration: 15 passed, 0 failed
verify-onboarding-local.cjs --grooming-transport:
  Onboarding integration: 36 passed, 0 failed
git diff --check: exit_code 0
```

Siete regresiones nuevas cubren metadatos, observaciones, notas normales con fechas, teléfonos móviles/fijos y mezcla idempotente; planificación con Tenant explícito, comparación optimista y rechazo de Tenant ajeno; recuperación desde filas repetidas del CSV sin alterar notas ordinarias. Chrome/NextAuth/proxy/PostgreSQL comprueba importación/reimportación real, teléfonos adicionales, visitas sin duplicación, edición/alta con varios teléfonos, protección de borrador y precios individuales. La comprobación de dimensiones confirmó botones iguales a 390 y 1440 px. Se revisó la captura `34-owner-pet-actions.png` y se conservan capturas de formularios de escritorio/móvil en `.cache/onboarding-verification/`.

Las expectativas antiguas de correo de los ensayos de formularios se sustituyeron por validación de teléfono y conservación del borrador. El primer ensayo del alta comparaba espacios de phoneAlt contra el formato anterior del endpoint (que los elimina); se corrigió la expectativa conservando los dos números. Se corrigió asimismo un selector de prueba anidado antes de la comprobación final de botones.

Los ensayos fueron desechables y eliminaron sus contenedores. Sigue el aviso previo del reactor EventDelivery documentado en el lote financiero; esta tarea no altera ese componente.

## Reparación de la base local existente

Script `scripts/repair-imported-owner-contact.cjs`: dry-run por defecto, Tenant explícito, solo PostgreSQL local y respaldo antes de escribir. Consulta el CSV fuente sin modificarlo; mezcla también teléfonos de filas con el mismo número principal. La transacción actualiza únicamente phoneAlt/notes y compara los originales para abortar si alguien cambia una ficha durante la reparación.

Aplicado a la clínica local después de validar el plan:

```text
owners reparados: 256
propietarios con teléfonos recuperados: 26
notas limpiadas: 256 (188 vacías; 68 conservan observaciones)
verificación posterior: primaryPhonesUnchanged=true; appliedValuesMatch=true
segunda ejecución dry-run: owners=0; phonesRecovered=0; notesCleaned=0

Conteos antes y después, sin variaciones:
  propietarios: 260
  mascotas: 308
  registros de visita: 4927
  citas: 9
```

Respaldo privado, ignorado por Git: `.cache/private-contact-backups/owner-contact-2026-10-19T17-24-27-953Z.json`, 256 originales con sus valores aplicados. SHA-256: `e2c6efd90639eb5ab4975b6ee8f84f063f38c597025c827f7a9aafa3e1e3be8a`. Los conteos corresponden al estado local existente, incluyendo registros manuales previos; esta tarea no reimportó la base real ni creó clientes/mascotas/visitas nuevas.

Sin migración, commit/push/despliegue ni modificaciones en la VPS. Producción sigue en 2.49.0 y el lote candidato 2.50.0 mantiene sus seis migraciones anteriores pendientes. WhatsApp sigue pausado.
