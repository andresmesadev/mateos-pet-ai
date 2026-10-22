# Vacunación y Otros agendables — verificación local del 22/10/2026

## Causa comprobada

Lectura productiva sin escrituras: Vacunación está activa, con
requiresAppointment true y categoría other. Nueva cita filtraba esa categoría;
la API de disponibilidad y el POST también rechazaban su reserva. No faltaba
activar nuevamente el indicador ni importar datos.

## Corrección

[Diseño en cinco etapas](../architecture/bookable-other-services-20261022.md).
La respuesta del catálogo declara bookingCategory; el formulario y los dos
endpoints de Agenda aplican la misma clasificación operativa. Otros con cita
reutiliza Veterinaria, su horario real y profesionales habilitados. La categoría
comercial y el reparto de comisión permanecen configurados por servicio.
No se muestra un servicio retirado, sin cita o de un módulo deshabilitado.
Las reservas se conservan en la vista del veterinario y admiten iniciar atención.
Sin migración ni modificaciones de configuración o reservas productivas.

## Evidencia ejecutada

- Backend completo: **216 suites / 1804 tests aprobados**; incluye Vacunación en
  Otros, disponibilidad/creación con bucket vet, módulo deshabilitado y comienzo
  de atención por veterinario. `.cache/bookable-other-jest-final.log`.
- Chrome y PostgreSQL desechables: **18 comprobaciones aprobadas**, con
  `verify-onboarding-local.cjs --pet-grooming-sync --bookable-other-services`.
  Selector real, exclusión de retirados/sin cita, elección de veterinario,
  horario, creación, relectura en Calendario, duplicados, referencias ajenas y
  módulo deshabilitado; conserva el recorrido anterior de sincronización de
  expediente. `.cache/bookable-other-browser-final.log`.
- ESLint completo y build Next/TypeScript: exit 0; logs privados
  `.cache/bookable-other-lint.log` y `.cache/bookable-other-build.log`.
- El primer intento de Chrome se detuvo porque Docker estaba apagado. Se inició
  Docker Desktop y se repitió el ensayo correctamente; la base desechable propia
  se retiró al finalizar. No se usaron cobros, mensajes ni datos reales de prueba.

## Estado de publicación

Lote local junto al guardado conjunto de peluquería/expediente. Producción sigue
en 2.54.0; este informe no certifica commit, push ni despliegue del nuevo lote.
Correcciones candidatas a patch 2.54.1 al publicar, sin abrir una fase nueva.
