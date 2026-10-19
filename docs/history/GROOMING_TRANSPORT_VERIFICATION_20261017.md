# Peluquería, domicilio e importación — verificación local

Fecha: 17 de octubre de 2026. Alcance: mejoras solicitadas para la veterinaria propia antes del siguiente lote de publicación. Diseño: [cinco etapas](../architecture/grooming-transport-implementation.md), [ADR 023](../decisions/023-precio-peluqueria-transporte.md). **Implementado y comprobado localmente; sin commit, push, despliegue ni importación real de este lote.**

## Comportamiento comprobado

- Complementos sin reserva permiten duración nula y precio pendiente; servicios que reservan conservan duración positiva. Vacío no se convierte en gratuito.
- La mascota conserva peluquería en centro y total individual con recogida/entrega. El acuerdo particular tiene prioridad sobre una referencia de zona. Un total con domicilio sin base individual exige confirmar el desglose antes de cerrar.
- La atención permite centro, recogida/entrega, solo recogida, solo entrega y transporte cobrado en otra cita. Zona, dirección, alcance e importe confirmado quedan registrados por establecimiento. Recepción solicita pendiente; el permiso de precio confirma. No hay división automática por trayecto ni multiplicación por mascota.
- Compartir exige otro cobro confirmado del mismo propietario y día, sin cadenas ni autorreferencia. Se completa primero la cita principal. Cancelación y reprogramación protegen las citas cubiertas; una reprogramación individual retira la confirmación anterior.
- Completar congela el desglose y conserva comisión y cobro en la transacción existente. Las comisiones permanecen inmutables. El endpoint antiguo de tarifa de mascota rechaza atenciones con transporte; una actualización concurrente no sobrescribe el precio de una atención que cambió.
- Importación distingue especie por mascota y conserva ambos precios. Los cambios de domicilio o tarifas sin guardar participan en la protección de cierre del diálogo; Cancelar recupera el domicilio guardado.

## Evidencia ejecutada

Con Node 24.19 del runtime de Codex, desde la carpeta indicada:

| Comando | Resultado real |
| --- | --- |
| `node node_modules/jest/bin/jest.js --runInBand --silent` en `backend` | `Test Suites: 198 passed, 198 total`; `Tests: 1616 passed, 1616 total`; 44.921 s |
| `node scripts/contact-import-species.test.cjs` | 8 pruebas aprobadas, 0 fallidas |
| `node scripts/grooming-transport-postgres.test.cjs` | PostgreSQL real: 9 comprobaciones; 1 test aprobado, 0 fallidos; fixtures revertidos |
| `NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build` en `frontend` | Compilación y TypeScript correctos; 32 páginas generadas |
| `node node_modules/eslint/bin/eslint.js .` en `frontend` | Salida vacía, código 0 |
| `node scripts/verify-onboarding-local.cjs --grooming-transport` | 13 comprobaciones aprobadas, 0 fallidas; Chrome real, NextAuth, proxy autenticado y PostgreSQL temporal |
| Migraciones y diferencia de schema dentro del recorrido anterior | Todas las migraciones aplicadas desde una base vacía; sin diferencias con Prisma |
| `git diff --check` | Código 0; avisos de conversión LF/CRLF del checkout |

La prueba de PostgreSQL confirmó peluquería de 95.000, domicilio de 8.000 y cobro único de 103.000. Con tasa ficticia de comisión del 50 %, registró 47.500 para el peluquero, conservando el resultado ante reintento. También probó traslado compartido cobrado una vez, precio pendiente, aislamiento, permisos y conservación del cobro tras cambiar una tarifa de zona.

El recorrido de navegador creó una zona de 16.000 y confirmó que el acuerdo de la mascota seguía dando 8.000; creó un complemento sin duración/precio e importó un propietario ficticio con gato y perro. Escape permitió seguir editando sin perder la dirección; Cancelar recuperó el valor guardado. Se comprobaron anchos 320/390/768 sin desbordamiento horizontal. Capturas privadas: `.cache/onboarding-verification/10-grooming-transport-desktop.png` y `11-grooming-transport-mobile.png`. El contenedor temporal se eliminó al terminar.

Los fixtures de navegador no siembran el catálogo de eventos de Servicios: la creación ficticia registra un aviso de certificación no propagado por `ServicioCreado`; no certifica automatizaciones de ese evento. El cliente PostgreSQL emite un aviso de deprecación por consultas concurrentes en una misma transacción; no produjo fallos. La suite usa fallos simulados y genera sus logs esperados. No se ejercitaron proveedores externos, WhatsApp ni pagos reales.

## Copia privada para importar después del despliegue

Archivo: `.cache/import-review/hotmail-limpieza-20261016/etapa-7/base-2026-importacion-completa.csv`. Sustituye para la carga al archivo de etapa 6; ambos y el origen revisado se conservan privados y fuera de Git.

Validación contra Artifact Tool y el parser real de la aplicación:

```json
{"result":"PASS","records":291,"columns":19,"petFields":{"dog":277,"cat":27},"comparedCells":5548,"sourceUnchanged":true,"namesAndGroupsPreserved":true,"applicationParser":"PASS","databaseWrites":0}
```

Son 291 registros de contacto y 304 campos de mascota, con grupos conservados por indicación del responsable; no son un censo de animales individuales ni de propietarios deduplicados. Se identificaron 24 pares inequívocos centro/con domicilio, 4 totales con domicilio sin base, 8 precios solo de centro y 11 textos ambiguos conservados en notas. No se reparten precios de grupos ni se asignan importes de otro servicio a peluquería. Los cuatro totales aislados permiten importar, pero requieren confirmar la parte de peluquería antes de generar comisión.

SHA-256 del origen revisado: `85f271610a7a81baa7931b0da0a68a47de3d3c50df08e9ea2e62e531d571f564`. SHA-256 de la copia de etapa 7: `b7e1e1d889b8ebf940750bfd10faa4dc25d5d124a572b7e13a76adb4d090eb0c`.

## Revisión de cierre y publicación

Se contrastaron los cinco pasos del diseño con dominio, precio único, aislamiento, comisión inmutable y proxy autenticado. Búsqueda de consumidores de los campos nuevos en backend/frontend/Prisma/scripts: la diferencia entre total pactado y servicio se calcula exclusivamente en el resolver central; frontend presenta el resultado. `git diff --name-only` sobre `whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js` y `availability-db.service.js` no devuelve cambios. La solicitud de recogida ya existente se persiste como recogida/entrega pendiente desde el adaptador de citas; no se añade un segundo wizard ni se reactiva WhatsApp.

Versionado evaluado: es una capacidad funcional nueva, corresponde una versión menor para el lote (siguiente candidata: 2.50.0). Se conserva 2.49.0 mientras no se prepare su commit de publicación; no se crea tag ni se declara una versión productiva diferente. La siguiente publicación debe incluir los archivos del lote, generar Prisma y aplicar la migración `20261016220000_grooming_transport_prices`; primero respaldo y verificación del entorno de destino. Los datos reales, zonas y precios se cargan después. No se certifican aquí logística de transporte, prueba real de WhatsApp, accesibilidad manual ni apertura definitiva de la beta.

## Simplificación posterior — 17 de octubre, 12:17 Colombia

Solicitud del responsable después de revisar las pantallas: retirar el bloque extenso de Nueva cita, usar dos valores en la ficha y evitar alertas vacías. [Cinco etapas del ajuste](../architecture/grooming-transport-simplification.md).

- Nueva cita conserva reserva, cliente, mascota, servicio y profesional opcional. No contiene campos, selección ni validación obligatoria de transporte. La tarifa guardada en Mascota no genera un cargo de domicilio automático.
- La pestaña existente Tarifas acordadas edita **Valor del servicio (COP)** y **Valor del domicilio (COP)**. El domicilio es recargo independiente de recogida y entrega; puede quedar pendiente sin inventar importe. La comisión continúa excluyéndolo.
- Los pares históricos centro/total se muestran como servicio/diferencia usando exclusivamente el resolver central. No se modifica el archivo de datos. Al guardar los nuevos valores explícitos se sustituye la referencia anterior. Un total aislado sigue visible y exige confirmar ambos valores antes de reemplazarlo.
- La ficha completa no abre un editor de alertas sobre el encabezado; tampoco muestra Cuidados importantes cuando ambos textos están vacíos. Indicaciones guardadas permanecen visibles. El editor de manejo se ofrece en Datos y cuidados al utilizar el control Editar existente; no se agrega otro botón a la ficha.
- Migración aditiva `20261017180000_pet_grooming_transport_fee`: columna nullable con restricción no negativa, sin reescribir la migración anterior ya aplicada localmente. Prisma regenerado y migración aplicada a `mateos_dev`; sin VPS.

Resultados reales posteriores al ajuste:

```text
Test Suites: 199 passed, 199 total
Tests:       1627 passed, 1627 total
Time:        55.511 s
Onboarding integration: 15 passed, 0 failed.
PostgreSQL: PASS, checks=10, customerCharge=103000, groomerCommission=47500, fixtureRollback=true
Frontend: build + TypeScript correctos, 32 páginas; ESLint código 0
```

Chrome comprobó los dos campos con valores heredados 95.000/8.000, guardado independiente en PostgreSQL, creación y eliminación de una alerta real, desaparición del aviso al vaciarla y creación de una cita sin datos logísticos ni cargo implícito de traslado. Después verificó nuevamente el botón de domicilio, tarifa particular, cierre de sesión y vista de atención en anchos 320/390/768. Capturas privadas revisadas: `12-pet-prices-simplified.png` y `13-new-appointment-simplified.png` en la misma carpeta de verificación. Las 55 migraciones se aplicaron desde una base temporal vacía y el diff con Prisma no encontró diferencias. Los avisos de fixtures y deprecación descritos antes siguen limitados al entorno de pruebas.

La prueba financiera ahora guarda primero el recargo explícito por el endpoint autenticado, luego confirma transporte y completa: se conservan 95.000 para servicio, 8.000 para domicilio, cobro de 103.000 y comisión ficticia del 50 % de 47.500. Todos los fixtures se revirtieron. Sin importación de clientes reales, commit, push ni despliegue. La publicación del lote requiere **ambas migraciones** y regenerar Prisma.
