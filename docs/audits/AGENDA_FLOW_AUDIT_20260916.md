# Auditoría del flujo de agenda — 2026-09-16

## Alcance

Auditoría inicial del recorrido WhatsApp → sesión → disponibilidad → `Appointment`.
Este documento conserva los hallazgos encontrados durante la revisión y se
actualizará con las siguientes etapas.

## Hallazgos priorizados

### A-01 — Falta onboarding de cliente nuevo (alta)

`findOrCreateUser` crea el usuario únicamente con el teléfono. El wizard no
obliga a capturar el nombre de la persona antes de pedir los datos de la
mascota.

### A-02 — Reglas operativas ausentes del contexto del agente (alta)

Los prompts describen servicios, pero no incluyen de forma explícita días
laborales, domingo cerrado, orden consecutivo de peluquería ni la diferencia
de disponibilidad entre peluquería y veterinaria.

### A-03 — Peluquería descarta fecha/hora solicitadas (crítica)

Cuando el servicio es `bath_grooming`, `conversation.service.js` llama a
`offerNextGroomingSlot` y no procesa la fecha u hora recién expresadas por el
cliente. Esto permitió que “sábado a las 4 pm” conservara otro slot.

### A-04 — Datos de sesión pueden arrastrarse entre reservas (alta)

La limpieza completa se ejecuta al terminar una cita, pero el flujo debe
garantizar que una nueva reserva no reutilice mascota, servicio, fecha u hora
anteriores sin confirmación.

### A-05 — Fecha/hora dependen demasiado de la extracción del LLM (alta)

`parseDateToKey` y `parseTimeToHour` funcionan como parsers, pero reciben el
texto que OpenAI extrae. Falta una regla final que dé prioridad a la última
fecha/hora del mensaje y rechace una confirmación con datos inconsistentes.

### A-06 — Confirmación final insuficientemente protegida (alta)

Antes de persistir `Appointment` debe comprobarse que servicio, mascota, día,
hora y disponibilidad corresponden al último estado confirmado por el cliente.

### A-07 — Diferenciación peluquería/veterinaria incompleta (alta)

La disponibilidad contiene lógica parcial para ambos servicios, pero el
diálogo no comunica ni aplica de forma uniforme: peluquería por orden de
slots; veterinaria a la hora solicitada dentro del horario laboral.

### A-08 — Nombre del cliente solo se captura pasivamente (alta)

`updateUserNameIfMissing` únicamente guarda el nombre si OpenAI lo extrae del
mensaje. No existe un paso del wizard que lo solicite de forma obligatoria a
un cliente nuevo.

### A-09 — Mascota se crea antes de la confirmación (media)

`whatsapp.service.js` ejecuta `findOrCreatePet` apenas tiene nombre y tipo
extraídos, antes de que el cliente confirme la reserva. Un mensaje ambiguo o
una extracción incorrecta puede dejar una mascota creada sin una cita válida.

### A-10 — Cita de grooming usa el estado anterior (crítica)

La persistencia de grooming lee `previous.scheduling_date_key` y
`previous.scheduling_hour` en vez del estado resultante con `result.sessionPatch`.
Esto puede guardar un slot distinto al que acaba de ofrecer o confirmar el
wizard.

### A-11 — Configuración diaria reemplaza la diferencia por servicio (alta)

`resolveHourWindow` usa el mismo `open`/`close` configurado para veterinaria y
grooming. La configuración por establecimiento no expresa ventanas distintas
por servicio, aunque el negocio requiere reglas diferentes.

### A-12 — Grooming ofrecido no procesa una preferencia de fecha/hora (alta)

El camino conversacional usa `findNextAvailableGroomingSlot` directamente. El
resolver específico `resolveGroomingScheduling` existe, pero no es el camino
principal del wizard, por lo que una preferencia del cliente puede descartarse.

### A-13 — Día no hábil depende de configuración incompleta (media)

Si existe una entrada diaria válida, `active` puede abrir domingo; el fallback
sin configuración cierra domingos. Debe definirse explícitamente en la
configuración del establecimiento y reflejarse en el diálogo para evitar
comportamientos distintos entre tenants.

### A-14 — Grooming no verifica conflicto antes de persistir (alta)

La rama que crea grooming al confirmar domicilio no llama a
`checkAppointmentConflict`; depende únicamente de la restricción única de la
base de datos. Si ocurre una colisión, el error se registra pero el flujo
continúa y puede enviar una respuesta que aparenta confirmar la cita.

### A-15 — Error de persistencia de grooming no cambia la respuesta (crítica)

El `catch` de creación de grooming solo registra el error. El resultado de
`generateReply` se devuelve de todos modos, por lo que el cliente puede recibir
“cita agendada” aunque `Appointment` no se haya creado.

## Evidencia revisada

- `backend/src/services/openai.service.js`
- `backend/src/services/conversation.service.js`
- `backend/src/services/whatsapp.service.js`
- `backend/src/services/scheduling.service.js`
- `backend/src/services/availability.service.js`
- `backend/src/services/availability-db.service.js`
- `backend/src/services/user.service.js`
- `backend/src/services/pet.service.js`
- `backend/src/services/memory.service.js`

## Próxima etapa

Auditar persistencia y resolución de usuario/mascota, incluyendo clientes
nuevos, clientes existentes, múltiples mascotas y creación de mascotas durante
el wizard. Después se construirá la matriz de pruebas conversacionales antes
de implementar correcciones.

## Remediación aplicada — 2026-09-17

- Se agregó el paso obligatorio de nombre para un cliente sin nombre registrado.
- El texto actual del cliente prevalece sobre fecha u hora antiguas de sesión.
- Peluquería explica y aplica el siguiente turno consecutivo; ya no descarta
  silenciosamente una preferencia del cliente.
- La cita de peluquería valida disponibilidad antes de persistir y no comunica
  éxito si la escritura falla.
- Las mascotas nuevas se crean al confirmar una cita, no al extraer datos del
  mensaje.
- El tenant `mateos-pet-prueba` quedó configurado con domingo inactivo.

Pendiente de una definición comercial explícita: si veterinaria y peluquería
requieren ventanas horarias distintas por establecimiento, `Tenant.businessHours`
debe evolucionar para expresarlas. La regla actual usa el mismo horario laboral
configurado y diferencia los servicios por disponibilidad y orden de slots.
