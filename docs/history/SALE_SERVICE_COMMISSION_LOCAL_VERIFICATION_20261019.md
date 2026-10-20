# Comisión por servicio adicional — verificación local pendiente de publicación

Solicitud: cierre de Dayra muestra 99000; el responsable confirmó que también realizó Desenredada por 28000 y Corte de uñas por 8000 en una consulta veterinaria. Falta 50% de ambas líneas: 18000. Importe correcto esperado: 117000. Ingreso total observado: 494000; saldo tras reservar la parte profesional: 377000, sin gastos ni desembolso ficticio.

Desglose principal leído sin modificar producción: Milu 25000, Maximo 24000, Lulu 25000 y Luna 25000 = 99000. Más Desenredada 14000 y Corte de uñas 4000 = 117000. Los importes de productos, domicilios y servicios directos permanecen fuera del reparto.

## Alcance local

[ADR 029](../decisions/029-comision-servicios-adicionales-caja.md) completa las cinco etapas previas. Se conserva cada servicio de catálogo y su profesional en la línea nueva; el servidor valida establecimiento, área activa, compatibilidad/capacidades, check y contrato. El check del servicio manda independientemente del área de la cita principal. Una consulta directa conserva 100% para el centro y puede acompañarse de un corte de uñas repartido para otro profesional.

Registro inmutable Commission con origen exclusivo cita o línea, índice único parcial por línea activa, tasa congelada con cuatro decimales y anulación atómica con venta manual. Las asociaciones históricas exigen motivo explícito y jamás se infieren por nombre ni modifican un comprobante. Cierres oficiales y liquidaciones consolidadas bloquean nuevas atribuciones/correcciones.

Caja muestra profesional solamente en adicionales de catálogo con reparto. Si hay un único profesional del área se propone automáticamente; siempre puede revisarse. Un artículo manual sin identidad de catálogo avisa que no reparte comisión. El servidor no confía en el indicador visual del navegador.

## Evidencia

- Backend final: `Test Suites: 214 passed, 214 total`; `Tests: 1766 passed, 1766 total`.
- Grupo de integración PostgreSQL local repetido después de los ajustes de validación por área: `tests 16`, `pass 16`, `fail 0`. Helpers de POS/dashboard: `tests 166`, `pass 166`, `fail 0`.
- Lint completo exit 0 y build Next/TypeScript exit 0 después de agregar el selector y filtro de profesionales.
- Prisma generate correcto. Migración local número 62. Base recién migrada frente al schema: `No difference detected`. Se corrigió la semántica de borrado de la FK nullable de Commission a Restrict; MedicalRecord quedó intacto.
- Primer recorrido completo: 49 comprobaciones correctas. Segundo recorrido con consulta mixta y precisión 33,33%: `Onboarding integration: 50 passed, 0 failed`. Recorrido final: `Onboarding integration: 51 passed, 0 failed`, incluida la carrera entre atribución y anulación sin comisión activa sobre venta anulada. Se verificó además el origen Staff de los eventos de anulación, la precisión 33,33% en PostgreSQL, el pago mixto idempotente y la inmutabilidad del comprobante al atribuir las líneas históricas.
- Captura local: `.cache/onboarding-verification/42-extra-service-professional.png`. Pruebas con PostgreSQL desechable, sin mensajes externos ni cobros reales.

## Estado y límites

El usuario pidió inicialmente no hacer commit, push ni despliegue antes de comprobar el flujo. Tras recibir los resultados locales, confirmó el criterio de servicios por área y autorizó expresamente commit, push y despliegue, incluida la corrección legítima de los dos servicios confirmados de Dayra. La publicación se documenta en RELEASE_2_52_0_VPS_20261019.md. No se generan cierres, gastos, pagos ni comisiones ficticias en producción.

Pruebas locales finales completas; publicación autorizada, versión prevista 2.52.0. Antes de aplicar: CI, respaldo y verificación acotada de las dos líneas confirmadas. Después de crear comisiones por línea, revertir directamente a un cliente antiguo que exige appointmentId no nulo es incompatible: conservar esquema/datos y usar código compatible; no borrar el nuevo libro para revertir.
