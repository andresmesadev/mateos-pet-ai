# Mapa de Desacoplamiento — conversation.service.js

**Fase 1 — Decisión A**  
Fecha: 2026-06-25  
Estado: Mapa aprobado (pendiente ejecución — Entregable 5)

---

## Contexto

`backend/src/services/conversation.service.js` (749 líneas) es hoy un monolito de canal. Contiene mezcladas tres categorías de responsabilidades:

1. **Lógica de dominio** — operaciones de negocio agnósticas al canal
2. **NLP / detección de intenciones** — patrones de lenguaje en español
3. **Adaptador WhatsApp** — protocolo del asistente conversacional (estado de la sesión, wizard steps, formato de mensajes)

La Decisión A establece que la lógica de dominio debe migrar a servicios de dominio independientes hasta que `conversation.service.js` quede como un adaptador delgado del canal WhatsApp.

---

## Inventario actual

### Constantes y configuración

| Elemento | Líneas aprox. | Categoría | Destino |
|---|---|---|---|
| `STEPS` (wizard step names) | ~1-20 | Adaptador WhatsApp | Queda en conversation.service.js |
| `MANAGEMENT_INTENTS` | ~22-30 | NLP | `intent-detector.service.js` |
| `CANCEL_PATTERNS` | ~32-45 | NLP | `intent-detector.service.js` |
| `RESCHEDULE_PATTERNS` | ~47-55 | NLP | `intent-detector.service.js` |
| `QUERY_APPOINTMENTS_PATTERNS` | ~57-70 | NLP | `intent-detector.service.js` |
| `QUERY_MEDICAL_HISTORY_PATTERNS` | ~72-85 | NLP | `intent-detector.service.js` |
| `NO_APPOINTMENT_PATTERNS` | ~87-100 | NLP | `intent-detector.service.js` |
| `HUMAN_TAKEOVER_PATTERNS` | ~102-115 | NLP | `intent-detector.service.js` |

### Helpers de texto

| Función | Categoría | Destino |
|---|---|---|
| `normalizeText` | Utilitario NLP | `intent-detector.service.js` (o lib/text-utils) |
| `isMissing` | Utilitario NLP | `intent-detector.service.js` |
| `isConfirmationMessage` | NLP + protocolo WhatsApp | Queda en conversation.service.js (*ya es exportada y parte del protocolo de sesión*) |
| `getPetLabel` | Formato WhatsApp | Queda en conversation.service.js |
| `getPetEmoji` | Formato display | Ya existe en `frontend/lib/pets.ts`; en el backend es duplicado — puede eliminarse y centralizar |
| `capitalize` | Utilitario texto | `intent-detector.service.js` o lib/text-utils |

### Detectores de intención

| Función | Categoría | Destino |
|---|---|---|
| `detectCancelIntent` | NLP puro | `intent-detector.service.js` |
| `detectRescheduleIntent` | NLP puro | `intent-detector.service.js` |
| `detectQueryAppointmentsIntent` | NLP puro | `intent-detector.service.js` |
| `detectQueryMedicalHistoryIntent` | NLP puro | `intent-detector.service.js` |
| `detectHumanTakeoverIntent` | NLP puro | `intent-detector.service.js` |
| `detectNoAppointmentNeeded` | NLP puro | `intent-detector.service.js` |

### Parsers especializados

| Función | Categoría | Destino |
|---|---|---|
| `parseGroomingService` | NLP de dominio | `intent-detector.service.js` |
| `detectDomicilioIntent` | NLP de dominio | `intent-detector.service.js` |
| `resolveMedicalHistoryFilter` | Lógica dominio | `intent-detector.service.js` (retorna un enum, no tiene side effects) |

### Handlers de operaciones de negocio

Estos son los más importantes. Cada uno hace una operación de dominio real pero devuelve una estructura con formato de respuesta WhatsApp (`reply`, `step`, `sessionPatch`).

| Función | Operación de dominio | Servicio de dominio ya existente que llama | Parte de dominio | Parte WhatsApp |
|---|---|---|---|---|
| `handleCancellation` | Cancelar cita | `appointment.service.cancelAppointment` | La operación en sí (ya delegada) | Construcción del `reply` y el `step` |
| `handleReschedule` | Reagendar cita | `appointment.service.cancelAppointment` + reinicio de wizard | La cancelación (ya delegada) | Toda la lógica de wizard y `sessionPatch` |
| `handleQueryAppointments` | Consultar citas del usuario | `appointment.service.getUserAppointments` | La consulta (ya delegada) | `formatAppointmentListLine` → texto WhatsApp |
| `handleQueryMedicalHistory` | Consultar historial de la mascota | `pet.service` + `medical-record.service` | La consulta (ya delegada) | `formatRecordsForWhatsApp` → texto WhatsApp |

**Diagnóstico:** los handlers ya tienen la lógica de dominio extraída a servicios existentes. Lo que reste en ellos son formatters de respuesta WhatsApp. **No requieren extracción adicional de dominio** — requieren renombrarse como formatters y quedarse en el adaptador.

### Lógica de grooming y disponibilidad

| Función | Categoría | Destino |
|---|---|---|
| `offerNextGroomingSlot` | Dominio (buscar slot) + formato WhatsApp | La búsqueda ya está en `availability-db.service`. Solo el formato del mensaje queda en el adaptador. |
| `buildGroomingConfirmedReply` | Formato WhatsApp | Queda en conversation.service.js |

### Auto-captura médica — EXTRACCIÓN PRIORITARIA

| Función | Categoría | Destino |
|---|---|---|
| `trySaveMedicalInfo` | **Dominio puro** | `domain/medical-auto-capture.service.js` |

`trySaveMedicalInfo(userId, session, message)` detecta información médica en texto libre y la guarda en el registro de la mascota. No tiene dependencia del canal WhatsApp. Llama internamente a `detectMedicalInfo` (openai.service) y `createRecord` (medical-record.service).

Es la función con mayor mezcla de dominio en el adaptador y la más valiosa de extraer: en fases futuras otros canales (Portal del Cliente, correo, voz) necesitarán auto-captura médica sin pasar por WhatsApp.

### Orquestador y punto de entrada

| Función | Líneas aprox. | Categoría | Destino |
|---|---|---|---|
| `buildRuleBasedReply` | ~260 líneas | Protocolo WhatsApp (máquina de estados del wizard) | Queda en conversation.service.js — es el núcleo del adaptador |
| `generateReply` | ~30 líneas | Punto de entrada del canal | Queda en conversation.service.js |
| `getConfirmationReply` | ~10 líneas | Protocolo WhatsApp | Queda en conversation.service.js |

---

## Servicios de dominio ya separados (no tocar)

Estos servicios ya están correctamente ubicados y son agnósticos al canal. `conversation.service.js` los consume; la relación de dependencia es correcta.

| Servicio | Responsabilidad |
|---|---|
| `appointment.service.js` | CRUD de citas, cancelación, consultas |
| `availability-db.service.js` | Slots de disponibilidad para grooming |
| `medical-record.service.js` | CRUD de registros médicos |
| `medical-detection.service.js` | Detección de info médica via OpenAI |
| `pet.service.js` | CRUD de mascotas, búsqueda por nombre/dueño |
| `scheduling.service.js` | Resolución de fecha/hora desde texto |
| `openai.service.js` | Generación de respuesta con IA |
| `domain/price-resolver.service.js` | Resolución de precios (Entregable 3) |

---

## Estado objetivo

```
conversation.service.js  [adaptador WhatsApp — thin]
  ├── STEPS, confirmationKeywords
  ├── Helpers de formato WhatsApp (getPetLabel, formatAppointmentListLine, etc.)
  ├── Wizard: buildRuleBasedReply (~260 líneas, se mantiene)
  ├── generateReply, getConfirmationReply
  └── Llama a:
       ├── intent-detector.service.js   [NUEVO — a extraer]
       ├── medical-auto-capture.service.js  [NUEVO — a extraer]
       └── servicios de dominio ya existentes (appointment, pet, medical-record, scheduling, availability-db, openai)

domain/intent-detector.service.js  [NUEVO]
  ├── Todos los patrones de intención (CANCEL_PATTERNS, etc.)
  ├── Todos los detectores (detectCancelIntent, detectRescheduleIntent, etc.)
  ├── normalizeText, isMissing, capitalize
  └── parseGroomingService, detectDomicilioIntent, resolveMedicalHistoryFilter

domain/medical-auto-capture.service.js  [NUEVO]
  └── trySaveMedicalInfo(userId, petName, messageText) → { saved, confirmation }
       ├── Llama: medical-detection.service.detectMedicalInfo
       └── Llama: medical-record.service.createRecord

domain/price-resolver.service.js  ✓ [ya existe — Entregable 3]
```

---

## Plan de extracción (orden de menor a mayor riesgo)

### Extracción 1: `medical-auto-capture.service.js`
- **Por qué primero:** función completamente auto-contenida, cero dependencias de estado de sesión o wizard
- **Contrato nuevo:** `trySaveMedicalInfo(userId, petName, messageText) → { saved: boolean, confirmation: string | null }`
- **Cambio en conversation.service.js:** importa el nuevo servicio y llama el mismo contrato; `buildRuleBasedReply` no cambia en estructura
- **Riesgo:** mínimo — es una operación atómica que hoy termina con un return; mover la función no cambia el flujo

### Extracción 2: `intent-detector.service.js`
- **Por qué segundo:** las funciones de detección son funciones puras (texto in → boolean/string out), sin side effects ni estado
- **Contrato:** exporta los mismos nombres de función; `conversation.service.js` cambia solo el `require`
- **Riesgo:** bajo — los detectores no tienen estado; si el `require` es correcto, el comportamiento es idéntico

### Validación entre extracciones
Después de cada extracción: ejecutar el flujo de WhatsApp con un mensaje de prueba de cada tipo (cancelación, reagendamiento, consulta de citas, info médica). Verificar que los logs del webhook muestran el mismo camino.

---

## Lo que NO se extrae en Fase 1

| Elemento | Razón |
|---|---|
| `buildRuleBasedReply` | Es la máquina de estados del wizard — es inherentemente canal WhatsApp |
| `handleCancellation`, `handleQueryAppointments`, etc. | Ya son thin wrappers; refactorizarlos como formatters dentro del adaptador es suficiente |
| `isConfirmationMessage` | Exportada como parte del protocolo de sesión; depende del concepto de `confirmationKeywords` |
| `STEPS` | Enum de estados del wizard WhatsApp |

---

## Regla de evolución (Decisión E)

Todo servicio de dominio que se cree en esta extracción debe ser **agnóstico al canal**. Si un servicio de dominio importa `whatsapp.service`, `conversation-persistence.service`, o devuelve texto formateado para WhatsApp específicamente, está mal ubicado.

El criterio de prueba: ¿podría el Portal del Cliente (Fase B) llamar a este servicio sin modificarlo? Si sí → es dominio. Si no → es adaptador.
