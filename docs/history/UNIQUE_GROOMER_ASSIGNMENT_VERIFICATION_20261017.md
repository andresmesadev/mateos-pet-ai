# Peluquero único — verificación local

17 de octubre de 2026. [Diseño en cinco etapas](../architecture/unique-groomer-assignment-20261017.md). Petición del responsable: no preguntar por empleado si solo hay un peluquero; permitir elegir con varios candidatos.

## Comportamiento

Nueva cita muestra el nombre del único peluquero activo y consulta sus horarios sin pedir selección redundante. La reserva del dashboard también resuelve la asignación cuando el cliente HTTP omite `staffId`. Las citas pendientes anteriores se asignan al registrar llegada si hay un único candidato, o al iniciar. Con dos o más candidatos disponibles, iniciar/cerrar una atención sin responsable solicita la elección mediante el diálogo existente; guardar continúa la acción pendiente.

El selector backend reutiliza reglas de capacidad, rol, Tenant, horario, ausencia y cruce, y revalida bajo el lock del profesional. Conserva una asignación explícita y la autoasignación del profesional que inicia su propia atención. No escribe durante lecturas ni modifica citas cerradas. Una reserva sin candidatos puede quedar pendiente de asignar; iniciar/cerrar peluquería exige resolver un responsable disponible.

Para atenciones antiguas ya iniciadas sin responsable, Completar Cita resuelve el candidato antes del evento que registra comisión y obligación de cobro, dentro de la misma transacción. El orden de bloqueo es profesional y luego cita; la fecha/servicio se vuelven a comprobar antes de asignar. No se cambia el motor conversacional, la resolución de precios ni los importes históricos de comisiones.

## Evidencia ejecutada

```text
Backend Jest: Test Suites: 202 passed, 202 total
Backend Jest: Tests: 1654 passed, 1654 total
Backend Jest: Time: 37.26 s
ESLint de los siete archivos frontend modificados: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --grooming-transport:
  Onboarding integration: 29 passed, 0 failed
PostgreSQL temporal desde cero: 57 migraciones aplicadas; diff Prisma correcto
git diff --check: exit_code 0
```

La prueba real Chrome/NextAuth/proxy/PostgreSQL verificó formulario sin selector con un peluquero, reserva con asignación persistida, petición de reserva sin `staffId`, llegada de una cita antigua sin responsable y cierre residual con comisión del peluquero único. Luego creó un segundo peluquero ficticio: En atención abrió el selector con ambos; la cita permaneció sin asignación hasta elegir. Guardar reanudó el inicio y completar registró la comisión del segundo seleccionado. Capturas privadas revisadas en `.cache/onboarding-verification/`: `13-new-appointment-simplified.png` y `19-groomer-choice-two.png`.

Nueve pruebas unitarias nuevas cubren candidato único, varios, retirado, Tenant ajeno, otra área, falta de capacidad, ausencia, cruce, servicio veterinario y asignación previa a la publicación financiera. La suite completa conservó las regresiones de agenda, staff y caja. Se corrigió una primera regresión de mocks del PATCH veterinario limitando la nueva selección al área grooming; no se cambió la transición veterinaria.

No se introdujeron migraciones. El contenedor de pruebas fue eliminado; no se modificaron datos reales del ensayo, ni VPS ni mensajes externos. Sigue vigente el aviso preexistente del reactor de automatizaciones documentado en la [verificación financiera](APPOINTMENT_PENDING_PAYMENT_VERIFICATION_20261017.md), fuera del alcance de este ajuste.

Sin commit, push, tag ni despliegue. Versión productiva/declarada 2.49.0; la capacidad se integra al lote menor pendiente de publicación, candidato 2.50.0. Se conservan las cuatro migraciones pendientes de las mejoras anteriores. No se declara apertura de beta.
