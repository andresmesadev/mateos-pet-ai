# Ficha de cita de Agenda — revisión visual local

20 de octubre de 2026. Solo presentación; pendiente de commit, push y despliegue.

La ficha compartida por Calendario, Agenda de hoy y Peluquería utiliza una
cabecera compacta con mascota, servicio y un único estado. Datos de la cita y
domicilio se muestran en dos columnas en escritorio, y se apilan en móvil. El
resumen conserva propietario, fecha/hora de Colombia, profesional y los valores
autorizados; el total tiene jerarquía propia. Las acciones de atención y cierre
permanecen en un pie fijo mientras se recorre el cuerpo.

Los editores de precio y domicilio mantienen sus contratos, permisos,
confirmaciones y protección de cambios sin guardar. El resumen compacto es
opcional: Historia clínica y Notas de peluquería conservan su disposición previa.
Sin cambios de backend, reglas de negocio, importes o persistencia.

## Validación ejecutada

- `NEXT_VERIFY_BUILD=1 node node_modules/next/dist/bin/next build` desde frontend:
  exit 0, compilación y TypeScript aprobados.
- `node node_modules/eslint/bin/eslint.js .` desde frontend: exit 0, salida vacía.
- Helpers de CI (sin suites PostgreSQL ni operational-cash-query):
  `tests 166`, `pass 166`, `fail 0`.
- `node scripts/verify-onboarding-local.cjs --grooming-transport --inventory-registration`:
  `Onboarding integration: 57 passed, 0 failed. Local disposable data only; no jobs, external messages or real charges.`
- `git diff --check`: exit 0.

El navegador verifica 320×568, 390×720, 768×800 y 1440×1000: márgenes, ausencia
de desbordamiento horizontal, estado único, columnas, cabecera/pie inmóviles y
botones de al menos 44 px. Confirma que Escape permite seguir editando un precio
sin perder el borrador. El escenario existente valida además edición y cancelación
de domicilio, estados, cobros, comisiones, inventario y cierre del día.

Capturas inspeccionadas: `.cache/onboarding-verification/49-appointment-detail-320.png`,
`49-appointment-detail-390.png`, `49-appointment-detail-768.png` y
`49-appointment-detail-1440.png`.

Logs: `.cache/appointment-detail-build.log`, `appointment-detail-lint.log`,
`appointment-detail-helper-tests.log` y `appointment-detail-browser-final.log`.
En el escenario que fuerza concurrencia/anulaciones se registró el aviso
asíncrono conocido de EventDelivery por clave foránea de un evento revertido;
no proviene de este cambio visual. No se declara saneado ese aviso del arnés.
Las 57 comprobaciones finalizaron correctamente y el contenedor temporal fue
eliminado. No se ejecutaron pruebas ni escrituras sobre producción.
