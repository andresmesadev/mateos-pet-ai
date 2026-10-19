# Agenda y Caja — pago pendiente verificado localmente

17 de octubre de 2026. Continúa la [verificación parcial](APPOINTMENT_CASH_USABILITY_PARTIAL_VERIFICATION_20261017.md) después de la respuesta explícita del responsable: «Sí, pendiente de pago hasta confirmar en Caja». [Diseño del conjunto](../architecture/appointment-cash-usability.md), [ADR 024](../decisions/024-cita-pendiente-hasta-confirmacion-de-pago.md).

## Resultado funcional

- Finalizar genera la obligación única de la atención con `paidAt = null`, dentro de la misma transacción que la cita y su comisión. No suma dinero recibido. La comisión mantiene como base exclusivamente el servicio; domicilio se cobra por separado en el total.
- Agenda de hoy, detalle de cita y peluquería muestran el acceso de Caja autorizado. Para una atención pendiente, Registrar pago abre directamente su confirmación, sin buscar de nuevo al propietario ni crear una venta manual adicional.
- Confirmar pago recibido fija la fecha del servidor, medio de pago y operador autenticado en la misma fila. Bloqueo de fila y transacción serializable evitan dos ingresos ante confirmaciones simultáneas. Repetir la misma confirmación recupera el pago; cambiar sus datos después de confirmar produce un rechazo explícito.
- Caja presenta pendientes separados de recibido; reportes e historial de ingresos excluyen obligaciones sin fecha de pago. El cierre diario permite pendientes si existe su obligación activa y no los suma al ingreso. Un pago posterior pertenece a su día real; un día con cierre oficial no admite otro pago nuevo.
- Los cobros históricos con fecha conservan fecha e importe. Su revisión pendiente no traslada ingresos a otro día. No se implementaron abonos ni se reclasificaron datos anteriores.
- Se conservan las mejoras ya verificadas: dirección y barrio del propietario en Mascota y transporte, acciones rápidas de estados, desglose de servicio/domicilio/total y scroll del buscador POS.

## Evidencia ejecutada

```text
Backend Jest: Test Suites: 200 passed, 200 total
Backend Jest: Tests: 1636 passed, 1636 total
Backend Jest: Time: 36.734 s
Frontend ESLint: exit_code 0, sin salida
Frontend Next build: exit_code 0; TypeScript correcto; 32 páginas generadas
PostgreSQL financiero real: 12 comprobaciones correctas
Chrome + NextAuth + proxy + PostgreSQL temporal: 19 passed, 0 failed
git diff --check: exit_code 0
```

El backend se verificó con su suite Jest completa. Frontend: CLI ESLint y Next build; financiero real: `scripts/grooming-transport-postgres.test.cjs`; navegador: `scripts/verify-onboarding-local.cjs --grooming-transport`. Se usó Node 24.19 y dependencias locales existentes.

La comprobación PostgreSQL utilizó servicio de 95.000 COP y domicilio de 8.000 COP: obligación pendiente de 103.000 COP, comisión de 47.500 COP, ingreso recibido cero y cierre diario posible sin sumar el pendiente. Sus fixtures se revirtieron.

El navegador completó una atención desde Inicio, comprobó el estado pendiente y ausencia de ingresos, pulsó el icono de Caja y confirmó el pago de 103.000 COP. Verificó una sola transacción y una sola comisión. Dos solicitudes HTTP concurrentes autenticadas para otra atención ficticia devolvieron el mismo pago y fecha; un tercer intento contradictorio fue rechazado con 422. La prueba también recorrió importación, especies, tarifas, dirección, estados rápidos y scroll de resultados. Captura privada revisada: `.cache/onboarding-verification/15-pending-appointment-payment.png`.

## Persistencia y límites

`20261017193000_appointment_payment_pending` permite `Transaction.paidAt` null exclusivamente en obligaciones de cita; no modifica filas existentes. Prisma regenerado y migración aplicada localmente. Las 56 migraciones se aplicaron a una base temporal vacía y la comprobación de diferencias con el esquema fue correcta. Al publicar el lote serán necesarias también `20261016220000_grooming_transport_prices` y `20261017180000_pet_grooming_transport_fee`.

Los datos de navegador fueron ficticios en un contenedor PostgreSQL propio eliminado al terminar. No se alteraron los clientes reales importados por el responsable, ni se enviaron mensajes o registraron pagos reales. WhatsApp y empleados del canal conservan su pausa.

La ejecución observó un aviso no bloqueante de `EventDelivery_domainEventId_fkey`: el reactor de automatizaciones usa un cliente fuera de la transacción de completado y no ve todavía el evento sin confirmar. El recorrido de cita y pago pasó; esta evidencia no certifica automatizaciones ni resuelve ese comportamiento preexistente. Las suites incluyen además logs de errores esperados en pruebas de rechazo y fixtures; su resultado final fue cero fallos.

Versionado evaluado: el lote incorpora cambios funcionales y corresponde una versión menor, candidata 2.50.0 al publicar. La versión declarada/productiva sigue en 2.49.0; no se creó commit, push, tag ni despliegue. Esta evidencia acredita el recorrido local solicitado, no la apertura de beta ni una verificación productiva.
