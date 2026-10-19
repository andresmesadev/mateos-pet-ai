# Agenda propia y Todos — verificación local parcial

Registro histórico parcial. Las respuestas posteriores y el carrito completo se implementaron y verificaron en [la continuación del mismo día](APPOINTMENT_MIXED_CHECKOUT_VERIFICATION_20261017.md).

17 de octubre de 2026. [Diseño y decisiones pendientes](../architecture/home-agenda-and-checkout-20261017.md).

Agenda de hoy ocupa una fila completa antes de Necesita atención para todos los perfiles con Agenda. Se retiró la altura artificial compartida y la antigua regla de dos columnas por perfil. Los botones y filtros conservan sus permisos y comportamiento.

Todos muestra los catálogos de productos y servicios juntos cuando ambas áreas están habilitadas. Conserva las vistas independientes, búsquedas, precios resueltos, existencias y edición del carrito. El grupo de botones se adapta al ancho móvil.

```text
node --test scripts/home-workspace.test.cjs scripts/home-adaptability.test.cjs scripts/pos-checkout.test.cjs
tests 25; pass 25; fail 0
ESLint de los cinco archivos frontend modificados: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-home-adaptability.cjs: exit_code 0; cuatro perfiles, 320/768/1440 px,
  filtros, permisos, navegación, actualización y recuperación de conexión correctos
verify-onboarding-local.cjs --grooming-transport:
  Onboarding integration: 21 passed, 0 failed
git diff --check: exit_code 0
```

La prueba real con PostgreSQL temporal comprobó ancho completo y prioridades debajo, Todos y vuelta a Productos, y ausencia de desbordamiento horizontal en Agenda/POS a 320, 390 y 768 px. Volvió a verificar el pago pendiente del ADR 024 sin cambios de reglas. Se revisaron las capturas privadas `16-home-full-width-agenda.png` y `17-pos-all-catalogues.png` en `.cache/onboarding-verification/`. El fixture habilita retail solo en el establecimiento ficticio. El contenedor se eliminó al terminar, sin modificar clientes reales ni VPS.

La compilación del navegador requiere `NEXT_VERIFY_BUILD=1` para su salida aislada; se corrigió la preparación tras un primer arranque fallido. Google Fonts requirió acceso de red durante ese build. El aviso conocido del reactor de eventos, documentado en [la verificación del pago](APPOINTMENT_PENDING_PAYMENT_VERIFICATION_20261017.md), sigue fuera del alcance.

**Pendiente funcional:** convertir el cobro de una cita en un carrito único con precio inicial de referencia y extras. Se consultaron la edición de peluquería/domicilio y el efecto de editar peluquería sobre la comisión. No se eligió una regla salarial sin la respuesta del responsable ni se modificó el comando financiero. El conjunto solicitado no se declara cerrado.

Sin migración nueva, commit, push, tag ni despliegue. El lote funcional pendiente corresponde a una versión menor al publicarse; producción y versión declarada continúan en 2.49.0.
