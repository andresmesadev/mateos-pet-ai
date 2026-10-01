# ADR 014 — Atención compartida de WhatsApp

Fecha: 2026-10-01. Estado: aceptada para el mantenimiento solicitado del dashboard.

## Contexto y reconciliación

El responsable del producto pidió que administrador, veterinario, recepción y peluquero utilicen la misma bandeja, con autoría visible, contexto de citas y un único responsable humano. Comunicación ya define asignación a humano (§10 del modelo de dominio) y Staff ya incluye recepción (§6). Se ejecutan las cinco etapas de diseño en `docs/architecture/whatsapp-team-workspace.md`; no se inaugura ni reabre una fase cerrada.

La autorización anterior «vet solo pantalla clínica» se amplía de forma explícita a WhatsApp. El acceso administrativo conserva sus capacidades clínicas con una sola identidad. Recepción recibe contexto operativo y reserva de citas existentes; peluquería recibe su contexto e historial de notas. No reciben historia clínica ni finanzas. La identidad y rol se derivan de la sesión validada por el servidor y de la credencial vigente, nunca del cuerpo enviado por el navegador. Facturación revalida también las credenciales de Staff, para evitar privilegios administrativos de una sesión con rol antiguo.

## Decisión

- Asignación y versión de control persistidas en Conversation; toma/devolución con compare-and-swap. Un administrador puede tomar un hilo ajeno solo con una acción explícita confirmada.
- Enviar exige ser responsable y presentar la versión vigente. Snapshot de autor humano en Message; los mensajes históricos sin snapshot siguen sin atribución retroactiva. Los nuevos mensajes automáticos y de sistema tienen procedencia explícita.
- Todos los envíos siguen pasando por los casos de uso de Comunicación. Se reutiliza el mutex por teléfono de 8.2 para serializar toma, devolución y comprobación inmediatamente antes del proveedor. La publicación de eventos ocurre fuera del mutex para permitir consumidores que respondan al mismo teléfono.
- Reconciliación mínima del motor: la selección persistente de Conversation prioriza la asignación aunque el wizard haya terminado, evitando perder la pausa al crear una sesión. No se reescriben transiciones, reglas de reserva ni resolución de precios.
- El checkpoint InboundJob conserva la fecha anterior a comenzar la generación. Una respuesta generada antes de tomar o devolver el hilo se descarta, incluso si el operador lo devolvió mientras el LLM trabajaba. Checkpoints antiguos sin fecha se descartan conservadoramente si hubo un cambio de control. Las notificaciones de sistema siguen funcionando.

## Consecuencias y límites

Migración aditiva, sin borrados ni backfill de autorías. Operación diseñada para la única instancia de backend existente (decisión 8.2); antes de desplegar varias réplicas debe adoptarse coordinación distribuida. El control evita respuestas simultáneas humanas/IA; no convierte la entrega externa de WhatsApp en una transacción con PostgreSQL ni altera la política de recuperación ambigua del ADR 011. Adjuntos, lectura y entrega de Meta no forman parte de este ajuste.
