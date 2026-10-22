# Guardado de cita y expediente — verificación local del 21/10/2026

Solicitud: modificar y guardar precio/domicilio en una cita debe persistir
también los habituales en el expediente, para cualquier mascota del Tenant.
[Definición en cinco etapas](../architecture/grooming-appointment-pet-sync-20261021.md).

## Resultado implementado

El guardado autorizado de precio o domicilio en una cita abierta de peluquería
coordina la cita, la mascota y el acuerdo de servicio ya existente dentro de la
misma transacción. Servicios conserva la escritura de PriceRule y publica
sus eventos después del commit. El comando explícito de precio acordado
mantiene su contrato; guardar habituales no crea overrides de servicio nuevos
que ocultarían una edición posterior del expediente.

Importe cero y pendiente son distintos. Solo recogida/entrega reutilizan el
importe guardado para esa misma modalidad; no se divide ni se deduce una tarifa
de otro trayecto. Recepción sin permiso monetario conserva los importes;
traslado compartido no convierte la tarifa habitual en gratuita. Dirección y
barrio siguen siendo datos de la visita, sin alterar la dirección de todas las
mascotas del propietario. La ficha abierta escucha el guardado, recarga sus
datos y protege cambios locales sin guardar.

No reescribe otras reservas con precio fijado, cobros, comisiones ni cierres;
no aplica una reparación masiva a citas anteriores. Sin esquema/migración nueva.

## Evidencia ejecutada

- Backend completo: **216 suites, 1800 tests aprobados**; log local privado
  `.cache/pet-sync-jest-final.log`.
- Chrome con PostgreSQL desechable, código final: **14 comprobaciones aprobadas**
  (`verify-onboarding-local.cjs --pet-grooming-sync`). Dos mascotas con importes
  y modos distintos, edición real desde Agenda, expediente tras navegación y
  recarga, cotización futura, edición posterior desde ficha sin regla oculta,
  rollback conjunto, históricos financieros intactos y rechazo de cita cerrada
  o inexistente. Log `.cache/pet-sync-directed.log`.
- Recorrido amplio anterior al último ajuste de no crear overrides: **57
  comprobaciones aprobadas**, incluyendo peluquería, contratos/comisiones,
  pagos, caja y los primeros controles de sincronización. El ensayo dirigido
  posterior verifica el comportamiento final refinado.
- Frontend ESLint completo exit 0 y Next/TypeScript build exit 0; logs privados
  `.cache/pet-sync-lint.log` y `.cache/pet-sync-build.log`.
- La expectativa histórica del arnés que recuperaba 8000 después de borrar el
  domicilio se cambió: el nuevo guardado persiste el pendiente en el expediente.
  Se conservan los avisos conocidos del catálogo mínimo/rollback del arnés;
  no se presentan como fallos resueltos de producción.

## Publicación

Cambios locales sobre 2.54.0; este informe no certifica commit, push ni despliegue
de este lote. Versionado evaluado: corrección funcional candidata a patch
2.54.1 al publicar, sin abrir una fase nueva. No se modificaron datos productivos
ni se repitieron reparaciones individuales, consumos o pagos históricos.
