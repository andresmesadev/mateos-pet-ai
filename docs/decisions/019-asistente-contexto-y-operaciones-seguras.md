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

### Ajuste de aceptación explícita del turno — 10 de octubre, prueba real

El operador respondió «Si acepto a las 11» al turno ofrecido; el adaptador conservó el horario, pero las reglas de conversación reiniciaron el paso por encontrar cualquier expresión horaria. Repetir el dato ya propuesto no es cambiarlo. En los pasos de peluquería se compara la fecha/hora normalizada con la propuesta vigente; solo un valor distinto, cambio de mascota o pregunta de disponibilidad invalida ese paso. La aceptación del mismo turno continúa a modalidad de atención, sin reservar todavía. Una negación explícita reconoce que no se agendó y conserva el borrador para una posible corrección posterior.

Este ajuste cumple el contrato de confirmación ya aprobado: no cambia horarios, capacidad, secuencia, permisos, persistencia ni esquema físico. Regresiones: aceptación con hora, aceptación con fecha y hora, hora distinta y rechazo sin reserva. La prueba de dirección y reprogramación continúa después de publicar la corrección.

La continuación real detectó que «Quiero que lo recojan en casa» no era reconocido: el detector incluía «recoger»/«recogen», pero omitía «recojan» y «recogida». Se añaden esas formas y se excluyen rechazos explícitos como «Sin recogida»/«No quiero que lo recojan», antes de buscar palabras afirmativas. Se mantiene la pregunta de dirección y el consentimiento final; no se agrega una modalidad de negocio ni se guarda una cita con solo elegir recogida. Regresión del recorrido completo con las frases reales y pruebas del detector con solicitudes/rechazos.

La negación en la revisión final no guardó citas, pero reofreció el turno. El reconocimiento explícito de «No confirmo» se aplica también en `awaiting_confirmation`, conservando revisión/dirección y sin reiniciar la oferta. Una solicitud nueva puede reemplazar ese borrador conforme a las reglas ya aprobadas.

### Continuación de reprogramación — prueba real de las 16:44

Tras seleccionar correctamente Akiles, la respuesta «El martes 13 de octubre a las 13:00» terminó en un saludo genérico. Ambas reservas conservaron ID, horario y estado. La regresión del adaptador reproduce ese resultado cuando el modelo devuelve `reschedule_appointment` para el destino: se excluía del recorrido de disponibilidad pese a existir cita seleccionada. Solo si hay `reschedule_appointment_id`, términos explícitos de fecha/hora y ninguna orden de gestión nueva, esa etiqueta se interpreta como continuación de agendamiento. La selección original y la identidad autenticada siguen intactas; el horario se consulta en el servicio existente. Un destino rechazado aclara que la cita original sigue reservada.

La aceptación «Si por favor» pasaba el protocolo de consentimiento, pero no el control de mascota seleccionada. Se admite el sufijo cortés «por favor»/«gracias» en las frases completas ya permitidas; preguntas, negaciones y correcciones siguen sin autorización. No se relaja la selección de otra mascota ni se aceptan horas distintas en esa confirmación. Sin cambios de dominio, esquema físico o capacidad. Versión candidata `2.46.4`; repetición WhatsApp pendiente de despliegue.

Regresiones del incidente y negativos de confirmación; propiedad de cita, reprogramación fallida, selección/corrección, turno vencido, lotes mixtos, escritura ordenada, control humano, envío incierto y coste por mensaje. Suite completa, lint y revisión del diff; evidencia real y pendientes de prueba WhatsApp en el informe de ejecución. Evaluar versión antes de cierre/publicación.
