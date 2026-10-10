# ADR 019 — Contexto y operaciones seguras del asistente

Fecha: 2026-10-10. Estado: aceptado para implementación por solicitud del responsable del proyecto, después de la auditoría integral del asistente. Corrección y simplificación del motor existente; no inicia una fase nueva.

## Evidencia y decisión

La auditoría `docs/operations/VIRTUAL_ASSISTANT_FULL_AUDIT_20261010.md` demuestra aceptación de negaciones, gestión ambigua de citas, pérdida del borrador, estado duplicado y costes innecesarios. Se conservan los adaptadores y las protecciones de agenda/Comunicación/cola. Se extraen contratos pequeños y se unifica la operación segura, sin sustituir el motor completo.

### 1. Definición funcional

El asistente identifica persona, mascota, servicio y propuesta vigente; una pregunta no destruye la reserva. Solo una aceptación inequívoca ejecuta un comando. Cancelar/reprogramar exige seleccionar una cita propiedad del cliente y establecimiento. Una cita veterinaria de otra mascota no impide solicitar peluquería.

### 2. Casos de uso

- Consultar disponibilidad/citas: lectura; conservar borrador.
- Confirmar: validar propuesta y datos, volver a comprobar disponibilidad y persistir; negación/duda/corrección devuelve una pregunta o propuesta nueva.
- Cancelar: resolver cita específica, pedir confirmación y cancelar exclusivamente ese ID autorizado.
- Reprogramar: conservar original mientras se propone el reemplazo; validar y mover la cita de forma transaccional, conservando ID e historial. Reutilizar las políticas actuales de estado, capacidad y propiedad.
- Cambiar mascota/servicio: invalidar propuesta previa y recogida; pedir especie solo si no está confirmada en el registro o mensaje actual.
- Escalar/devolver: `Conversation.status` y control versionado son autoridad; una señal nueva del turno solicita escalamiento.

### 3. Arquitectura técnica

Contratos separados para aceptación, arbitraje de intención, validación de análisis y gestión de reservas. El canal invoca operaciones compartidas de agenda; no proporciona identidad desde el LLM. Sesión aislada por establecimiento/cliente, persistida en orden y confirmada antes de cerrar el procesamiento. La interpretación recibe borrador actual; historial y memoria son datos, no instrucciones.

Respuestas operativas determinísticas; IA solo para lenguaje abierto con información recuperada. Un vector por búsqueda, recuperación con umbral y sin indexar mensajes triviales. Se retira escritura médica automática del recorrido de recepción; imágenes piden atención del equipo, audio conserva transcripción. No se inventan servicios ni identidad humana. El endpoint de diagnóstico solo devuelve extracción y no simula reservas; las pruebas de flujo invocan el recorrido real con dependencias de prueba.

Lotes se normalizan y encolan por mensaje. Ante aceptación externa o resultado de envío incierto no se reenvía automáticamente. Se conserva `needs_review` y se registra la identificación del envío cuando la entrega externa la devuelve.

**Decisiones arquitectónicas diferidas:** concurrencia de varios workers/instancias hasta medir carga con claves corregidas; expediente clínico por imágenes; optimización de modelos basada en mediciones; terceros consumidores de API. Estos cambios no se implementan silenciosamente aquí.

### 4. Modelo de persistencia

Se reutilizan `Conversation.sessionData`, `Conversation.status`, `Appointment`, `Message.externalId` e `InboundJob`/sus checkpoints. El borrador guarda IDs seleccionados y datos pendientes. Una reprogramación modifica el horario de la cita identificada dentro de la transacción; nunca cancela primero y crea otra después. Cache/locks no son identidad del negocio. El histórico médico y de mensajes se conserva.

### 5. Esquema físico

No se introduce entidad nueva ni migración en este diseño. Las claves de gestión del borrador se guardan en JSON existente; IDs de proveedor saliente usan `Message.externalId` existente. Se conserva índice único de reserva y lock transaccional por establecimiento/bucket. Si la implementación requiere un cambio físico diferente, documentarlo antes de aplicarlo.

El diario técnico `InboundJob` conserva además recibos firmados de entrega con `provider=whatsapp_delivery`, `status=done` y `phase=complete`. No se reclaman ni producen respuestas. Su payload mínimo conserva ID saliente, estado, timestamp, línea y códigos de error; se relaciona por `Message.externalId`. Distinguirlos de los trabajos `provider=whatsapp` al medir conversaciones. Conservan evidencia incluso si el recibo llega antes de guardar el mensaje saliente. No se equipara aceptación HTTP con entrega o lectura.

## Reconciliación de secuencia de peluquería

La autorización para implementar las propuestas incluye aplicar secuencia sobre turnos aún reservables: un hueco vencido o dentro del margen de anticipación no bloquea la tarde. Los huecos futuros siguen exigiendo el primer turno libre, y continúan horarios por servicio, festivos, duración, ocupación y anticipación. Registrar esta precisión en dominio, matriz y runbook; no se amplía capacidad.

## Validación y cierre

Regresiones del incidente y negativos de confirmación; propiedad de cita, reprogramación fallida, selección/corrección, turno vencido, lotes mixtos, escritura ordenada, control humano, envío incierto y coste por mensaje. Suite completa, lint y revisión del diff; evidencia real y pendientes de prueba WhatsApp en el informe de ejecución. Evaluar versión antes de cierre/publicación.
