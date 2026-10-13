# ADR 020 — Notificaciones compatibles y POST de páginas

**Fecha:** 2026-10-13. **Estado:** implementación autorizada por el responsable tras la revisión de las 48 horas. Corrección de mantenimiento, sin nueva fase, capacidad de Agenda o entidad.

## Evidencia y definición funcional

EST-01: dos recordatorios de texto fueron aceptados inicialmente y rechazados después por Meta (`131047`), más de 40 horas desde la interacción del propietario. EST-02: 35 peticiones con referencia de acción `x` provocaron errores de Next.js. Infraestructura estable; no confundir salud verde con entrega.

La consulta de solo lectura del catálogo de Meta devolvió cinco plantillas aprobadas: ejemplos `hello_world` y `jaspers_market_*`, ninguna apta para recordatorios de citas. No se reutilizan plantillas con un significado distinto, ni se crean/publican plantillas sin diseño y configuración explícitos.

## Casos de uso y contratos

- Recordatorio del sistema por WhatsApp: si existe interacción del propietario dentro de la ventana, conservar el envío de texto existente. Si no existe, está vencida o tiene una fecha inválida/futura, omitir antes de invocar el proveedor; resultado `skipped` con motivo explícito. El recordatorio no se marca enviado. Evitar el límite exacto con un margen de un minuto.
- Reutilizar los casos de uso de Comunicación y el control humano. No agregar consultas de Agenda al contexto Comunicación. Las respuestas del agente mantienen su recorrido existente; este ajuste cubre los seis recordatorios `origin=sistema`, identificados por el marcador interno `purpose=reminder`. El inventario completo encontró también OTP del Portal y otras acciones de sistema: no se les aplica silenciosamente esta política ni se finge éxito omitiendo su envío.
- El contrato de `sendXReminder` sigue siendo booleano: un resultado omitido devuelve `false`, preserva flags y produce la decisión existente `reminder_skipped`; log estructurado con motivo, sin teléfonos ni contenido del cliente.
- La plantilla existente de reactivación conserva su caso de uso separado. Una plantilla de recordatorio futura deberá ser apta y aprobada; no hay fallback automático a un ejemplo ni se habilita un nuevo producto.
- Frontend: no hay Server Actions declaradas en el código de la aplicación; login/logout usan NextAuth por API y los formularios del dashboard usan APIs/GET. Los POST de páginas y solicitudes con `Next-Action` se rechazan con 405 antes de autenticación/render/parsing. APIs normales y recursos de Next mantienen su recorrido. Las verificaciones de permisos de dashboard/print siguen vigentes.

## Arquitectura técnica

Un guard de infraestructura de Comunicación consulta la última interacción entrante del mismo usuario/tenant mediante el repositorio de mensajes; incluye sus hilos históricos. Se compone dentro del guard de entrega existente para mantener orden y exclusión. El caso de uso suministra el tipo de canal. Solo un envío efectivamente aceptado crea Message/evento; un skip no fabrica mensaje ni entrega.

El adaptador de recordatorios distingue skip del resultado aceptado en un único helper. En frontend, el proxy externo rechaza los POST de páginas y el encabezado de acciones antes del proxy autenticado. Se revisó la guía instalada de Next 16.3.8: el proxy precede render y las Server Functions son POST a la página, incluso con referencias en el cuerpo. Rechazar únicamente un encabezado inválido dejaría sin cubrir el cuerpo multipart/formulario.

## Persistencia y esquema físico

Se reutilizan Message/Conversation y flags existentes de recordatorios. Consulta por `Conversation.userId`, `Conversation.tenantId` y `role=user`; nunca por IDs del body ni por un solo hilo. Sin nuevas tablas, columnas, índices o migración. El skip deja constancia de control en logs y en las decisiones existentes del Coordinador; no representa mensaje entregado. La timestamp es la recepción persistida en Message; Meta sigue siendo autoridad final sobre entrega.

## Decisiones diferidas y validación

Plantilla de cita aprobada/configurada y resultado persistido por recordatorio más detallado: no se incorporan silenciosamente aquí. Varias líneas/canales del mismo negocio requerirían vincular explícitamente la ventana a cada línea; hoy se conserva el modelo operativo existente.

Pruebas: ventana abierta, límite, vencimiento de 40 h, usuario/tenant distinto, hilos distintos, sin interacción y fallo de consulta; skip no crea Message/evento ni marca reminderSent. Reproducir POST con header y cuerpo de acción inválidos, comprobar 405, APIs de auth/proxy normales y acceso anónimo. Suite/lint/build, grep exhaustivo de envíos, respaldo, CI y despliegue. Preservar la ventana aprobada de 2.46.4; una nueva versión inicia otra observación sin borrar los hallazgos históricos.
