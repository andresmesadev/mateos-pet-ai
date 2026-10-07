# ADR 018 — Corrección de ausencias, capacidades y jornadas partidas

Fecha: 2026-10-07. Ampliación solicitada y aceptada de Administración; continúa ADR 011, sin reabrir entregables históricos de Fase 2 ni crear una fase nueva. Su regla de cinco aprobaciones se limita expresamente a esos entregables; no se presume su extensión. Se documenta el diseño antes de implementar esta ampliación.

## Definición funcional

El administrador puede corregir o anular una ausencia con motivo obligatorio, elegir los servicios que atiende un integrante y guardar varias franjas diarias. Se conserva el historial y se vuelve a mostrar la revisión de citas. Las reservas no se cancelan automáticamente y los permisos de acceso al aplicativo no cambian.

## Casos de uso

- Corregir/anular ausencia: validar propiedad y vigencia; anular lógicamente el registro original y, si es corrección, crear su reemplazo con rango válido. La operación completa es atómica y rechaza repetir una corrección sobre un antecedente ya anulado.
- Administrar capacidades: reutilizar el caso existente, con selección explícita o servicios compatibles con el perfil. Selección vacía significa que no presta servicios. Validar establecimiento, área y servicios retirados antes de escribir; conservar capacidades revocadas.
- Guardar jornada: validar todas las franjas de cada día antes de sustituir los horarios base; conservar ausencias. Restablecer quita únicamente las restricciones semanales.

## Arquitectura

Reglas temporales y ciclo de ausencia en Staff; adaptadores transaccionales bajo el lock por profesional de ADR 011. Eventos existentes DisponibilidadActualizada, CapacidadAsignada y CapacidadRevocada, publicados después del commit. Navegador por proxy autenticado; administración exclusiva, identidad y tenant desde autenticación. La regla común de capacidades distingue perfil y selección, sin conceder acceso a pantallas.

## Persistencia

StaffAvailability conserva inicio, fin y motivo originales. Se añaden voidedAt, voidReason y voidedBy; una corrección nueva enlaza al original mediante replacesId único. Solo ausencias vigentes bloquean. El autor es una etiqueta obtenida del actor autenticado, nunca del formulario.

Staff.serviceScope admite auto (compatibilidad con datos existentes), role (todos los servicios compatibles con su perfil) y selected (solo capacidades activas, incluso ninguna). Auto conserva la inferencia anterior. El cambio explícito de modo queda certificado mediante DisponibilidadActualizada. No se borran capacidades revocadas.

El JSON semanal conserva open/close para compatibilidad y añade windows por día; StaffAvailability mantiene cada franja independiente como fuente de verdad. El editor reconstruye las franjas reales, sin abrir los huecos intermedios.

## Esquema físico

Migración aditiva: cuatro columnas de StaffAvailability, relación propia por replacesId e índice único; una columna serviceScope con default auto y restricción de vocabulario. Filas anteriores quedan vigentes, sin reemplazo, y conservan comportamiento. Restricciones verifican que los metadatos de anulación son completos y aplican exclusivamente a ausencias. Se regenera Prisma y se aplica únicamente en PostgreSQL local después de validar el esquema y la migración.

## Verificación y límites

Pruebas de corrección/anulación, doble escritura, aislamiento, capacidades vacías/restablecidas, servicios incompatibles, franjas partidas, conservación de reservas y permisos por rol. Lint, compilación y navegador. Sin cambio de capacidad por bucket, comisiones, precios, motor WhatsApp ni credenciales reales. No se agrega una matriz nueva de roles ni eliminación de antecedentes.
