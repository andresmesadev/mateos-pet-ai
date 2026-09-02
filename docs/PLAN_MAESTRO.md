# Plan Maestro de Evolución
## La Constitución de la Plataforma Operativa Inteligente · Mateos Pet

**Versión:** 1.1  
**Fecha:** 2026-06-30  
**Estado:** Documento vivo — fuente oficial de verdad sobre la evolución del producto

---

## Introducción

Este documento no describe cómo está implementado el sistema.

Describe cómo evolucionará la **Plataforma Operativa Inteligente** durante los próximos años: qué se construirá, en qué orden y por qué. Establece la visión, los principios que la gobiernan y el plan de evolución aprobado.

Los detalles técnicos no pertenecen aquí. Las decisiones de implementación viven en los documentos de arquitectura. Los resultados concretos de cada fase viven en sus informes de cierre. Los modelos del negocio viven en el modelo de dominio.

**Este documento es la Constitución del Proyecto.**

Toda decisión estratégica, arquitectónica o de producto debe alinearse con él. Quien proponga un cambio que lo contradiga tiene la carga de justificarlo explícitamente. No al revés.

---

## Jerarquía Documental

Las decisiones del proyecto siguen siempre esta jerarquía, de mayor a menor abstracción:

```
Visión
  ↓ responde: ¿qué estamos construyendo y para quién?

Principios Permanentes
  ↓ responde: ¿qué reglas son innegociables?

Plan Maestro  ← este documento
  ↓ responde: ¿hacia dónde evoluciona el producto?

Modelo de Dominio
  ↓ responde: ¿cómo funciona el negocio?

Documentos de Arquitectura
  ↓ responden: ¿cómo está construido?

Informes de Fase
  ↓ responden: ¿qué se construyó?

ADRs (Architecture Decision Records)
  ↓ responden: ¿por qué tomamos una decisión?

Código
  ↓ implementa todo lo anterior
```

Ninguna decisión puede saltarse esta jerarquía. El código no puede contradecir la arquitectura. La arquitectura no puede contradecir el dominio. El dominio no puede contradecir los principios. Los principios no pueden contradecir la visión.

---

## Cómo usar este documento

Debe leerse completo antes de:

- Iniciar una nueva fase de desarrollo
- Proponer o aprobar una nueva funcionalidad
- Incorporar una nueva IA o un nuevo desarrollador al proyecto
- Cambiar el rumbo del producto

---

## 1. Propósito de la Plataforma

### Qué estamos construyendo

Una **Plataforma Operativa Inteligente para negocios especializados en salud y bienestar animal.**

La plataforma permite administrar desde un único lugar toda la operación diaria de un establecimiento, adaptándose a su tipo. Puede operar como:

- Centro veterinario
- Clínica veterinaria
- Peluquería canina
- Peluquería felina

Cada negocio activa únicamente los módulos que necesita. La plataforma no obliga a usar funcionalidades que no forman parte de su operación.

### Qué NO estamos construyendo

**No construimos un chatbot.** Un chatbot responde mensajes. Esta plataforma opera negocios.

**No construimos un CRM.** Un CRM gestiona relaciones. Esta plataforma gestiona la operación completa: agenda, servicios, finanzas, staff, historiales, comunicaciones y automatizaciones.

**No construimos un SaaS tradicional.** Un SaaS ofrece funcionalidades genéricas. Esta plataforma incorpora Empleados Digitales Especializados que trabajan para el dominio del negocio.

### La visión oficial

> "No construimos software que responde mensajes. Construimos una Plataforma Operativa Inteligente donde empleados digitales especializados colaboran con el equipo humano para administrar y hacer crecer negocios especializados en salud y bienestar animal."

### Posicionamiento

**Comercialmente:** Agent as a Service (AaaS) — el lenguaje que el mercado entiende para justificar el valor.

**Arquitectónicamente:** Sistema Operativo del negocio — la forma en que el producto está construido, que lo hace defendible.

Nunca al revés. El pitch puede ser AaaS. El diseño técnico es siempre OS.

---

## 2. Principios Permanentes

Estos diez principios son inmutables. Fueron aprobados al cierre de la etapa de definición estratégica. Toda decisión futura de producto, arquitectura o desarrollo se evalúa contra ellos. Si una propuesta viola más de uno, no es prioritaria.

---

**Principio 1 — La plataforma es el producto. Los empleados digitales son capacidades.**  
La Plataforma Operativa Inteligente es el producto. Los empleados digitales son capacidades de la plataforma. Nunca al contrario.

**Principio 2 — El dominio tiene prioridad sobre cualquier tecnología.**  
La IA podrá cambiar. Los modelos podrán cambiar. Los canales podrán cambiar. El dominio permanecerá.

**Principio 3 — El dato pertenece al negocio.**  
Todo dato importante pertenece al negocio. Nunca a un canal. Nunca a un agente. Nunca a un proveedor de IA.

**Principio 4 — Cada módulo funciona sin IA.**  
La IA potencia el trabajo. Nunca es un requisito para operar.

**Principio 5 — Los empleados digitales trabajan para el dominio.**  
No para ningún canal de comunicación en particular. Trabajan para el dominio del negocio.

**Principio 6 — Toda funcionalidad elimina, simplifica o automatiza trabajo humano.**  
Si no lo hace, debe cuestionarse su prioridad.

**Principio 7 — La plataforma se adapta al negocio. No al revés.**  
Cada negocio usa únicamente los módulos que necesita.

**Principio 8 — Los canales son reemplazables.**  
Los canales de comunicación son puertas de entrada al sistema. Nunca contienen lógica del negocio.

**Principio 9 — El activo real es el conocimiento operativo acumulado.**  
Clientes, mascotas, servicios, historiales, automatizaciones, datos. No los modelos de IA.

**Principio 10 — La pregunta que filtra todo.**  
Antes de implementar cualquier funcionalidad: *¿Qué trabajo humano deja de existir gracias a esta funcionalidad?* Si no existe una respuesta clara, esa funcionalidad probablemente no pertenece al núcleo del producto.

---

## 3. Arquitectura Conceptual

### La separación fundamental

El sistema opera sobre dos territorios que nunca se mezclan:

```
DOMINIO DEL NEGOCIO
  Clientes · Mascotas · Agenda · Servicios
  Staff · Finanzas · Historiales · Automatizaciones
          ↑ el dominio es soberano
          ↓ los canales lo consumen

CANALES
  Mensajería · Dashboard · Email · Portal del Cliente · Futuras integraciones
```

**El dominio no sabe de los canales. Los canales saben del dominio.**

Esta separación no es una preferencia técnica. Es la garantía de que el negocio puede cambiar de canal sin perder sus datos, sus reglas y su historia.

### Las capas del sistema

```
┌────────────────────────────────────────────────┐
│            CANALES Y ADAPTADORES               │
│  (traducen solicitudes al lenguaje del dominio) │
└──────────────────────┬─────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────┐
│                CASOS DE USO                     │
│  (coordinan el dominio · son agnósticos         │
│   al canal que los invoca)                      │
└──────────────────────┬─────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────┐
│             DOMINIO DEL NEGOCIO                 │
│  (entidades, servicios de dominio,              │
│   reglas de negocio)                            │
└──────────────────────┬─────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────┐
│           EMPLEADOS DIGITALES                   │
│  (leen y escriben el dominio · son auditables · │
│   nunca son el dominio)                         │
└────────────────────────────────────────────────┘
```

### Principios de diseño permanentes

**El dominio como autoridad.**  
Toda regla de negocio vive en el dominio. Los canales y los agentes son consumidores del dominio. Nunca sus dueños.

**Los canales no orquestan.**  
Un canal recibe una solicitud, la transforma al lenguaje del dominio, invoca un caso de uso, y devuelve la respuesta al canal. La coordinación entre reglas de negocio vive en los casos de uso, no en los canales.

**Los casos de uso son agnósticos al canal.**  
Un caso de uso no sabe si fue invocado desde la interfaz web, desde mensajería, desde una API pública o desde un test automatizado. Recibe y devuelve conceptos del dominio.

**Los registros financieros son inmutables.**  
Los hechos contables no se modifican. Las correcciones se realizan mediante anulación y nuevo registro. Esta regla protege la integridad histórica del negocio.

**El precio se resuelve en un único lugar.**  
Las reglas de precio del negocio están centralizadas en un único servicio de dominio. Ningún otro módulo implementa reglas de precio por su cuenta.

### Separación de dominios

La plataforma opera sobre dos dominios independientes:

**Dominio Operativo** (siempre activo): Clientes, Mascotas, Agenda, Servicios, Staff, Finanzas, Automatizaciones. Funciona para cualquier tipo de negocio, con o sin servicios clínicos.

**Dominio Clínico** (módulo opcional): Historia Clínica, Vacunas, Tratamientos, Medicamentos, Diagnósticos, Prescripciones. Solo se activa en establecimientos que prestan servicios veterinarios.

**Regla de diseño:** ninguna entidad del Dominio Operativo puede depender de una entidad del Dominio Clínico. La dependencia solo existe en la dirección contraria.

---

## 4. Modelo de Construcción

El producto se construye en este orden. Esta secuencia no puede invertirse.

```
Sistema Operativo
      ↓
   Datos
      ↓
Reglas de negocio
      ↓
Empleados Digitales
      ↓
   Canales
```

**Por qué este orden:**  
Si se construye al revés —canal primero, dominio después— cada nuevo canal requiere reimplementar la lógica del negocio. Si el dominio está sólido, agregar un nuevo agente o canal es trabajo marginal. El costo de hacerlo bien desde el inicio es bajo. El costo de corregirlo después es alto.

**Consecuencia práctica:**  
Antes de mejorar un canal de comunicación o un agente de IA, verificar que las entidades de dominio y las reglas de negocio que necesitan están correctamente modeladas. Si no están, el modelo de dominio se actualiza primero.

---

## 5. Plan de Evolución

El producto evoluciona en cinco fases. Cada fase construye sobre la anterior. No se puede iniciar una fase sin haber completado la anterior.

---

### FASE 1 — Soberanía del Dominio
**Estado:** ✅ Completada. Informe de cierre completo en `docs/history/PHASE_1_COMPLETION_REPORT.md`.

**Objetivo**  
Establecer que el dominio del negocio es la autoridad. Que las reglas del negocio —sus precios, sus comisiones, su lógica operativa— viven en el dominio, independientes de los canales y las tecnologías que los expresan.

**El problema que resolvió**  
La lógica de negocio vivía dispersa entre el canal de mensajería, los endpoints del dashboard y la interfaz de usuario. No existía un lugar único donde vivieran las reglas del negocio. Cambiar una regla de precios requería tocar múltiples capas. El operador no tenía visibilidad financiera directa.

**Las capacidades que incorporó**  
La lógica de precios, comisiones y detección de intenciones pasó a residir en el dominio, invocable desde cualquier punto del sistema. El operador obtuvo visibilidad financiera directa desde la agenda: el precio de cada cita con su jerarquía de origen, el resumen del día y un cierre contable basado en hechos inmutables.

**Lo que habilitó**  
Un conjunto de servicios de dominio que cualquier caso de uso o canal puede invocar sin modificarlos. La posibilidad de construir la capa de aplicación sin que ningún canal tenga que orquestar la lógica del negocio.

**Criterio de cierre**  
El canal de mensajería opera sin cambios. El dominio puede ser invocado desde cualquier punto del sistema sin modificarse. El operador puede ver precios, comisiones y cierre del día directamente desde la agenda.

---

### FASE 2 — Sistema Operativo del Negocio
**Estado:** ✅ Completada (2026-07-01) — con alcance re-declarado por el ADR 006 (2026-07-02): la fase entregó el diseño, la capa de aplicación, la persistencia y la validación de dominio de sus tres entregables; la **exposición de los casos de uso a canales y operadores quedó fuera de su alcance real** y se realiza en el entregable puente "Exposición del Sistema Operativo", precondición de la Fase 3 (ver Roadmap interno). Retrospectiva completa de la fase en `docs/history/PHASE_2_RETROSPECTIVE.md`.

**Objetivo**  
Completar el Sistema Operativo del negocio. Que el Dominio Operativo esté completamente modelado, que una capa de casos de uso coordine sus reglas, y que el operador humano pueda gestionar la operación diaria completa desde la plataforma sin depender de ningún agente de IA.

**El problema que resuelve**  
La Fase 1 estableció los cimientos del dominio. Pero la coordinación entre sus reglas todavía ocurre dispersa: los canales orquestan más de lo que deberían, y hay capacidades operativas críticas —gestión de staff, historial financiero consultable, catálogo de servicios administrable— que aún no existen como entidades completas del Sistema Operativo.

**Las capacidades que incorpora**  
- La coordinación de operaciones complejas ocurre en una capa de aplicación, no en los canales
- El staff, su disponibilidad y sus comisiones son gestionables directamente por el operador
- El historial financiero es consultable por cualquier período, sin recalcular ni exportar
- El catálogo de servicios y sus reglas de precio son administrables desde la plataforma

**Lo que habilita**  
La Fase 3. Cuando el Sistema Operativo esté completo, los Empleados Digitales tendrán entidades claras sobre las cuales actuar, eventos bien definidos a los que reaccionar y casos de uso estables que invocar.

**Criterio de cierre**  
El operador puede gestionar la operación diaria completa —agenda, servicios, staff, comisiones, cierre del día, reportes históricos— desde la plataforma, sin intervención de ningún agente. La coordinación entre reglas de negocio vive en casos de uso, no en los canales. Ningún canal (dashboard, mensajería) orquesta reglas de negocio directamente: toda operación sobre Agenda, Servicios, Staff o Finanzas pasa por su caso de uso correspondiente.

#### Roadmap interno de la Fase 2

El objetivo de esta fase no es construir módulos aislados. Es completar el Sistema Operativo del Negocio para que toda la operación diaria pueda ejecutarse desde la plataforma mediante casos de uso de aplicación, sin depender de ningún canal específico ni de ningún Empleado Digital. Cada entregable, por lo tanto, no se limita a modelar entidades: nace ya coordinado por su propia capa de casos de uso, agnóstica al canal que la invoque.

El orden de los entregables sigue la cadena de dependencia que el propio Modelo de Dominio declara entre contextos (quién conoce a quién), no el estado actual del código:

**Entregable 2.1 — Catálogo de Servicios como Sistema Operativo** · ✅ Completado
Servicio, Regla de Precio y Categoría de Servicio completamente modelados y administrables por el operador, coordinados por sus propios casos de uso (crear/editar servicio, resolver precio). No depende de otros contextos pendientes — es la base de la cadena. Cierre registrado en `docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`.

**Entregable 2.2 — Staff como Sistema Operativo** · ✅ Completado
Miembro del Staff, Disponibilidad, Comisión, Liquidación y Capacidad del Staff (qué servicios está habilitado a prestar cada miembro). Depende de 2.1: necesita la Categoría de Servicio para aplicar la regla de comisión correcta, y el Servicio para registrar capacidades. Casos de uso: registrar staff, actualizar disponibilidad, administrar capacidades, generar liquidación de período. Cierre registrado en `docs/history/ENTREGABLE_2_2_COMPLETION_REPORT.md`.

**Entregable 2.3 — Finanzas como Sistema Operativo** · ✅ Completado
Gasto (extiende `Expense`, Fase 1), Cobro (materializado como un origen de `Transaction`, Fase 1, tras la Reconciliación Arquitectónica del ADR 005), Cierre del Día y Período Financiero, con historial consultable por cualquier período sin recalcular ni exportar. Depende de 2.2: consolida las comisiones del staff en el cierre. Casos de uso: registrar/anular gasto, registrar cobro al completarse una cita, generar y consultar el cierre del día, generar y consultar el período financiero, consultar historial financiero. Cierre registrado en `docs/history/ENTREGABLE_2_3_COMPLETION_REPORT.md`.

Con el cierre de 2.3, **la Fase 2 queda completa en su alcance real: dominio, capa de aplicación, persistencia y validación de los tres entregables**.

**Nota de reconciliación (ADR 006, 2026-07-02):** la versión original de este párrafo afirmaba que la auditoría de coordinación "quedó validada al completar 2.3: Agenda, Servicios, Staff y Finanzas operan cada uno mediante su propia capa de casos de uso". Una auditoría externa de v2.1.0 demostró que esa afirmación describía un sistema en funcionamiento que el código no respalda: los casos de uso existen, están probados y son internamente coherentes, pero —con la única excepción de la adaptación de lectura de `daily-close.routes.js`— ningún canal los invoca; las rutas reales siguen ejecutando la lógica de Fase 1. Ninguna de las cinco etapas de diseño de los entregables prometió exposición HTTP (fue deliberadamente excluida de su alcance), por lo que el defecto era de sobredeclaración en el cierre, no de alcance incumplido. El criterio de cierre descrito arriba queda, por tanto, **pendiente de cumplirse mediante el entregable puente**, y la Fase 3 no puede iniciarse antes.

**Entregable puente — Exposición del Sistema Operativo** · ✅ Completado (2026-07-02)
Conectó los casos de uso de 2.1, 2.2 y 2.3 a los canales reales, retirando la orquestación legacy. Pasó por la Regla de Ejecución completa (Etapas 1–5 aprobadas y congeladas). Las decisiones de dominio previas quedaron resueltas e implementadas: circuito `CitaCompletada` → `Transaction` con dispatcher síncrono transaccional y verificación de completitud del cierre (ADR 007), día financiero civil con `lib/timezone.js` como fuente única (ADR 008), atomicidad de la generación de períodos (hallazgo A2), rechazo de `tenantId` nulo en hechos financieros (M1) y patrón de anulación en `Commission` y `Transaction` (ADR 009, índices únicos parciales). Su Validación Técnica incluyó tests del camino real HTTP → caso de uso → persistencia para toda operación de dinero (criterio M8). Ver `docs/decisions/006-reconciliacion-cierre-fase-2.md` y `docs/history/AUDITORIA_V2_1_0_CIERRE.md`.

**Proceso de construcción obligatorio**
Ningún entregable de esta fase puede comenzar su implementación sin completar y aprobar antes sus cinco etapas de diseño, en orden: definición funcional, casos de uso, arquitectura técnica, modelo de persistencia y esquema físico. Tras implementarlo, son obligatorias validación, documentación y cierre formal del entregable. Este proceso está documentado en `docs/PHASE_2_EXECUTION_RULE.md` y rige a todos los entregables de la Fase 2.

---

### FASE 3 — Empleados Digitales Especializados
**Estado:** ✅ Completa — roadmap interno aprobado (3.0 → 3.5) cerrado en su totalidad (2026-07-06). Informe de cierre y retrospectiva completos en `docs/history/PHASE_3_COMPLETION_REPORT.md`.

**Roadmap interno de la Fase 3** (orden validado tras revisión estratégica): 3.0 Infraestructura de Eventos → 3.1 Comunicación → 3.2 Empleado Digital → 3.3 Automatizaciones → 3.4 Recepcionista IA → 3.5 Coordinador de Agenda IA. El Prompt Registry (prompt versionado por Empleado Digital) queda clasificado como infraestructura, no como parte del Modelo de Dominio.

- **Entregable 3.0 — Infraestructura de Eventos** · ✅ Completado (2026-07-03). Contexto Eventos nuevo (`domain-model-v1.md`, §12): certifica todo hecho de negocio como Evento de Dominio inmutable, mantiene el Catálogo global de Tipos de Evento, y certifica entregas a consumidores — sin decidir el mecanismo concreto de entrega asíncrona (decisión diferida). Integrado de forma aditiva sobre el dispatcher síncrono del Entregable Puente: la certificación de `CitaCompletada` ocurre dentro del cierre exitoso de la misma transacción, sin tocar el dispatcher existente. Cierre en `docs/history/ENTREGABLE_3_0_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_3_0_GATE_REVIEW.md`).
- **Entregable 3.1 — Comunicación** · ✅ Completado (2026-07-04). Contexto Comunicación nuevo (`domain-model-v1.md`, §10): aísla la lógica de canal detrás de un contrato único (`Enviar Mensaje`) — todo mensaje saliente del proyecto (conversacional o proactivo) pasa exclusivamente por él, verificado por grep exhaustivo (cero llamadas directas a `sendWhatsAppMessage` fuera del contexto). `Conversation`/`Message` evolucionaron sin duplicarse (Canal, estado de escalación, origen del mensaje); credenciales por tenant y Plantilla de Mensaje quedan diferidas. Cierre en `docs/history/ENTREGABLE_3_1_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_3_1_GATE_REVIEW.md`).
- **Entregable 3.2 — Empleado Digital** · ✅ Completado (2026-07-04). Contexto Empleados Digitales nuevo (`domain-model-v1.md`, §9): `DigitalEmployee` (tenant-scoped), `AgentAutonomyLimit`, `AgentTask`, `AgentDecision`, `Escalación` — andamiaje auditable, sin conocimiento de la lógica interna de ningún otro contexto ni dependencia obligatoria de Comunicación o Eventos en este entregable (integración diferida al primer agente real, 3.4). Cierre en `docs/history/ENTREGABLE_3_2_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_3_2_GATE_REVIEW.md`).
- **Entregable 3.3 — Automatizaciones** · ✅ Completado (2026-07-04). Contexto Automatizaciones nuevo (`domain-model-v1.md`, §8): `AutomationRule` (tenant-scoped), `AutomationTemplate` (catálogo global), `AutomationExecution` (historial inmutable) — primer contexto de Fase 3 que depende, por diseño, de Comunicación y Empleados Digitales, invocando exclusivamente sus casos de uso ya expuestos. Primer consumidor real del mecanismo de Entrega de Evento de 3.0 (`EventDelivery`, consumer `"Automatizaciones"`), resolviendo su Decisión Diferida. Integrado como reactivo del dispatcher del Puente para `CitaCompletada`, con aislamiento estricto de fallos (ninguna Regla puede afectar al comando disparador). Cierre en `docs/history/ENTREGABLE_3_3_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_3_3_GATE_REVIEW.md`).
- **Entregable 3.4 — Recepcionista IA** · ✅ Completado (2026-07-06). Primer Empleado Digital real del sistema (`domain-model-v1.md`, §9): sin entidades ni bounded contexts nuevos — Recepcionista IA es exclusivamente la especialización `"recepcionista"` de `DigitalEmployee` (3.2). El motor conversacional de WhatsApp (`whatsapp.service.js` y todo lo que orquesta) permanece intacto, envuelto por `LegacyWhatsappEngineAdapter`; cada mensaje entrante produce una Tarea y una Decisión auditables. Resuelve la Decisión Diferida 1 del Gate Review de 3.2 (integración Escalación ↔ `Conversation.status`), cerrando una brecha funcional real: hasta este entregable, una solicitud de atención humana nunca llegaba al dashboard de escalaciones. Cierre en `docs/history/ENTREGABLE_3_4_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_3_4_GATE_REVIEW.md`).
- **Entregable 3.5 — Coordinador de Agenda IA** · ✅ Completado (2026-07-06). Segundo Empleado Digital real (`domain-model-v1.md`, §9): sin entidades ni bounded contexts nuevos — exclusivamente la especialización `"coordinador_agenda"` de `DigitalEmployee`. Da auditoría real (Tarea/Decisión) al job diario de recordatorios (`jobs/reminder.job.js`), hasta ahora sin ningún agente detrás; `reminder.service.js` permanece intacto, envuelto por `ReminderEngineAdapter`. División de responsabilidad declarada sin reabrir 3.4: la coordinación conversacional de agenda sigue atribuida a Recepcionista IA. Cierra el roadmap interno de la Fase 3. Cierre en `docs/history/ENTREGABLE_3_5_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_3_5_GATE_REVIEW.md`).

**Objetivo**  
Reemplazar el agente generalista por un equipo de Empleados Digitales Especializados, cada uno con responsabilidades claras, límites de autonomía definidos y auditoría completa de cada decisión tomada.

**El problema que resuelve**  
Un agente que lo hace todo es frágil, difícil de mejorar y se comporta de forma impredecible. Un equipo de agentes especializados tiene responsabilidades delimitadas, es auditable y cada miembro puede evolucionar de forma independiente.

**Las capacidades que incorpora**  
Un equipo de empleados digitales con especialización definida:

| Empleado Digital | Responsabilidad |
|---|---|
| Recepcionista IA | Primer contacto, identificación de intención, enrutamiento |
| Coordinador de Agenda IA | Disponibilidad, agendamiento, confirmaciones, recordatorios |
| Asistente de Grooming IA | Preferencias por mascota, precio acordado, frecuencia |
| Asistente de Recuperación IA | Clientes en riesgo, campañas de reactivación |
| Asistente Financiero IA | Cierre del día, comisiones, reportes bajo demanda |
| Asistente Administrativo IA | Reportes operativos, catálogo, configuración asistida |
| Asistente Clínico IA | Historial, alertas clínicas, pre-consulta (solo si módulo activo) |

Cada tarea, cada decisión y cada escalación generada por un empleado digital es una entidad auditable del Sistema Operativo. El negocio puede configurar hasta dónde puede actuar cada agente sin confirmación humana. El sistema puede ejecutar reglas automáticamente cuando ocurren eventos en el dominio, sin programación adicional.

**Lo que habilita**  
La Fase 4. Con Empleados Digitales operativos y auditables, la plataforma está lista para escalar a múltiples negocios manteniendo la coherencia operativa en cada uno.

**Criterio de cierre**  
Al menos dos Empleados Digitales especializados operan con responsabilidades delimitadas y auditoría completa de sus decisiones. Las escalaciones son entidades del Sistema Operativo. El negocio puede configurar reglas de automatización sin intervención del equipo de desarrollo.

---

### FASE 4 — Plataforma Comercial
**Estado:** ✅ Completa — roadmap interno aprobado (4.1 → 4.4) cerrado en su totalidad (2026-07-10). Congelada oficialmente el 2026-07-08. Roadmap interno: 4.1 Saneamiento Tenant-Blind → 4.2 Onboarding Autónomo → 4.3 Configuración por Establecimiento → 4.4 Facturación/Habilitación Comercial del SaaS. Informe de cierre y retrospectiva completos en `docs/history/PHASE_4_COMPLETION_REPORT.md`.

**Identidad de la fase y separación del backlog de deuda técnica:** el objetivo estratégico de esta fase (convertir el Sistema Operativo Veterinario en una plataforma SaaS multi-establecimiento autónoma) se mantiene deliberadamente separado de la deuda técnica acumulada durante las Fases 2–3 (Outbox de Eventos, `AgentAutonomyLimit` sin aplicar, certificación de eventos propios de Empleados Digitales, Dominio Clínico sin construir, `InventoryItem`, pertenencia de `Commission`). Esa deuda permanece registrada como backlog arquitectónico transversal, disponible para priorizarse en cualquier fase, **sin definir la identidad de ninguna**. Solo se promueve un ítem del backlog a entregable de esta fase cuando existe dependencia arquitectónica demostrable con el objetivo comercial — criterio aplicado al definir 4.1 (ver abajo). Regla permanente institucionalizada: durante toda la Fase 4 no se incorporará ninguna funcionalidad veterinaria nueva (Dominio Clínico, Inventario u otra capacidad operativa) que no contribuya directamente al objetivo de Plataforma Comercial; toda mejora no relacionada permanece en el backlog arquitectónico.

- **Entregable 4.1 — Saneamiento Tenant-Blind** · ✅ Completado (2026-07-09). Único ítem de la deuda técnica acumulada (Auditoría v2.1.0: A6, M4, B2, M1) promovido a entregable de esta fase, por ser precondición dura del objetivo comercial — ningún otro entregable de la fase puede operar correctamente sobre múltiples tenants reales mientras persistieran estos puntos ciegos. `Appointment.availabilityBucket` + índice único parcial `(tenantId, availabilityBucket, date)` reemplaza la verificación de conflicto no atómica en la reserva de citas (A6, reconciliado: por bucket de servicio compartido, no por `staffId`, que el sistema no usa para disponibilidad); las cinco funciones de consulta de `reminder.service.js` y `jobs/reminder.job.js` ahora exigen y procesan por `tenantId` explícito (M4, reconciliado: acotado a los consumidores externos al motor conversacional — el consumo interno del motor queda como deuda pendiente de un futuro rediseño, fuera de este entregable, por el principio "no reescribir el motor" institucionalizado en 3.4); el contexto Recepcionista IA rechaza explícitamente un mensaje entrante cuyo tenant no resuelve o está inactivo, antes de invocar al motor (B2); `User.phone` pasó de unicidad global a `@@unique([tenantId, phone])`, verificado seguro contra los datos reales antes de aplicarse (M1). El motor conversacional (`whatsapp.service.js`/`conversation.service.js`/`scheduling.service.js`) y `webhook.controller.js` permanecen sin ningún cambio. Cierre en `docs/history/ENTREGABLE_4_1_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_4_1_GATE_REVIEW.md`).
- **Entregable 4.2 — Onboarding Autónomo** · ✅ Completado (2026-07-09). Cierra la brecha encontrada en su auditoría: el registro (`POST /api/onboarding/register`) creaba un `Tenant` sin sembrar ningún `DigitalEmployee`, dependiendo de un script manual (`scripts/seed-digital-employees.js`) para que el tenant quedara operativo — contradecía el objetivo de "sin intervención del equipo de desarrollo". `tenant-provisioning.service.js` (nuevo) es ahora el único punto responsable del aprovisionamiento automático de `recepcionista` y `coordinador_agenda` por tenant, reutilizando exclusivamente el caso de uso público de Empleados Digitales; el script manual fue refactorizado para consumir el mismo servicio, sin lógica duplicada. Decisión de arquitectura congelada: `Tenant` no se reemplaza ni se renombra en este entregable — el Contexto Negocio completo (`Establecimiento`, `Módulo`, `Configuración del Negocio`, Modelo de Dominio §1), identificado como deuda de implementación durante la auditoría, queda diferido íntegramente al Entregable 4.3. Cierre en `docs/history/ENTREGABLE_4_2_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_4_2_GATE_REVIEW.md`).
- **Entregable 4.3 — Configuración por Establecimiento** · ✅ Completado (Alcance A, 2026-07-09) — Alcance B diferido por Reconciliación Arquitectónica. Su auditoría encontró dos `BusinessConfigReaderPort` casi idénticos (`services`, `staff`), ambos con implementación hardcodeada sin distinción de tenant (`getActiveModules` siempre `["grooming","veterinary"]`; `getCommissionSplitRate` siempre `0.5`), y un campo `Tenant.businessHours` persistido pero nunca consultado por ningún servicio de disponibilidad. `business-config.service.js` (nuevo) es ahora la única fuente de verdad para módulos activos y tasa de split, persistidos en `Tenant` de forma aditiva; ambos `PrismaBusinessConfigReader` delegan en él sin cambiar ningún puerto ni caso de uso. **Reconciliación Arquitectónica — Alcance B (horarios de atención, zona horaria) deliberadamente no implementado**: su aplicación real en el flujo de reserva por WhatsApp exigiría modificar `scheduling.service.js`/`availability.service.js`, violando el principio "no reescribir el motor conversacional" institucionalizado desde 3.4 — queda registrado como deuda diferida, misma categoría que el residuo de M4 dejado por 4.1. Cierre en `docs/history/ENTREGABLE_4_3_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_4_3_GATE_REVIEW.md`).
- **Entregable 4.4 — Facturación / Habilitación Comercial del SaaS** · ✅ Completado (2026-07-10). Cierra el roadmap interno de la Fase 4. Su auditoría encontró tres hallazgos críticos: `cancelSubscription()` era código muerto mientras la UI prometía cancelación sin respaldo funcional; cambiar entre dos planes pagos reutilizaba el flujo de Checkout, creando una segunda suscripción en Stripe en vez de modificar la existente; y `resolveTenant.js` (middleware de toda la API del dashboard) nunca aplicaba ninguna suspensión comercial, a diferencia del canal de WhatsApp, que ya respeta `Tenant.active` desde 4.1. Se conectó `cancelSubscription` a una ruta real (`POST /api/billing/cancel`) con botón funcional en el dashboard; se corrigió el cambio de plan con `updateSubscriptionPrice` (Stripe Subscription Item Update, sin duplicar suscripciones); y se aplicó suspensión comercial real en `resolveTenant.js` usando `Tenant.active` como única fuente de verdad, sin período de gracia ni dunning — unificando el comportamiento comercial entre el canal de WhatsApp y el dashboard/API. El motor conversacional permanece sin ningún cambio. **Con este cierre, el roadmap interno de la Fase 4 (4.1 → 4.4) queda completo.** Cierre en `docs/history/ENTREGABLE_4_4_COMPLETION_REPORT.md` (Gate Review previo en `docs/history/ENTREGABLE_4_4_GATE_REVIEW.md`).

**Objetivo**  
Evolucionar el producto desde un sistema para un único negocio hacia una plataforma que puede operar múltiples establecimientos independientes, con configuración autónoma, facturación automatizada y onboarding sin intervención del equipo de desarrollo.

**El problema que resuelve**  
El primer negocio es el laboratorio del producto. Cuando la plataforma esté probada en producción real, la misma arquitectura puede servir a otras clínicas y peluquerías. El paso a multiempresa no es agregar funcionalidades nuevas: es exponer lo que ya existe de forma configurable para cada nuevo cliente.

**Las capacidades que incorpora**  
- Cada establecimiento opera en su propio espacio de datos y configuración
- Los módulos activos, las reglas operativas y los equipos son configurables por establecimiento
- Un nuevo negocio puede configurarse, operar y generar facturación sin que el equipo de desarrollo intervenga
- El equipo interno tiene visibilidad sobre el estado operativo de todos los establecimientos

**Lo que habilita**  
La Fase 5 — Operaciones Inteligentes. Con la arquitectura multiempresa y comercial establecida, la prioridad pasó a consolidar la infraestructura reactiva (eventos, automatizaciones, gobernanza de agentes) antes de expandir hacia nuevos canales o hacia una segunda vuelta de la operación multi-establecimiento — ver la sección FASE 5 para la decisión formal y las alternativas evaluadas.

**Criterio de cierre**  
Un segundo establecimiento —diferente al primero— puede ser onboardeado de forma autónoma, operar completamente en la plataforma y generar facturación sin intervención del equipo de desarrollo.

---

### FASE 5 — Operaciones Inteligentes
**Estado:** ✅ Roadmap interno funcional completo (5.1 → 5.4). Entregable 5.4 cerrado oficialmente (2026-07-27, v2.16.0).
**Informe de cierre:** ver `docs/history/ENTREGABLE_5_4_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_5_4_GATE_REVIEW.md` para el cierre del último entregable del roadmap interno; `docs/history/ENTREGABLE_5_1_COMPLETION_REPORT.md`/`GATE_REVIEW.md` para el primero.

**Objetivo estratégico**  
Convertir la infraestructura reactiva del Sistema Operativo Veterinario en una infraestructura operacional real, donde los eventos de dominio, las automatizaciones y los Empleados Digitales operen sobre mecanismos confiables de entrega, auditoría y gobernanza.

**El problema que resuelve**  
Al cierre de la Fase 4, el sistema certifica hechos de negocio (Eventos de Dominio) y ejecuta Automatizaciones sobre ellos, pero la infraestructura que los sostiene es parcial: `EventDelivery` registra resultados sin reintentar entregas fallidas (`retryEventDelivery` era código muerto), los Empleados Digitales no certifican eventos propios fuera del flujo original, y `AgentAutonomyLimit` existe como andamiaje sin aplicación real. La plataforma funciona, pero su infraestructura reactiva no es todavía confiable bajo fallo — la Fase 5 cierra esa brecha antes de que el crecimiento comercial (Fase 4) la haga más costosa de resolver.

**Principio permanente de la fase**  
Ningún entregable de la Fase 5 modifica reglas de negocio existentes ni el motor conversacional (`whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js`). El alcance se limita estrictamente a infraestructura reactiva: eventos de dominio, automatizaciones, orquestación y gobernanza de agentes. Si una Macroetapa 2 exige modificar el comportamiento funcional de un contexto de negocio, la implementación se detiene de inmediato y se emite una Reconciliación Arquitectónica.

**Roadmap interno**  
5.1 Outbox de Eventos de Dominio → 5.2 Certificación Real de Eventos por Contexto → 5.3 Aplicación Real de Límite de Autonomía → 5.4 Automatizaciones Multi-Evento. (5.1 bloquea 5.2 y 5.4; 5.2 bloquea 5.4; 5.3 es independiente del resto.)

- **5.1 — Outbox de Eventos de Dominio** — ✅ Completado (2026-07-11, v2.13.0). Reintento real de entregas `EventDelivery` en estado `"failed"` para el consumidor Automatizaciones, vía `jobs/event-delivery-retry.job.js` (`node-cron`, cada 15 min), con idempotencia por Regla (`hasSuccessfulExecution`). Cero cambios en el motor conversacional y en los contextos de negocio.
- **5.2 — Certificación Real de Eventos por Contexto** — ✅ Completado (2026-07-11, v2.14.0). 37 de 41 eventos log-only (Empleados Digitales, Automatizaciones, Comunicación, Finanzas, Servicios, Staff) certificables como Evento de Dominio real vía un único adaptador reutilizable (`contexts/shared/events/certifying-domain-event-publisher.js`), reutilizando `events.registerDomainEvent` (3.0) sin cambios. El propio contexto Eventos queda deliberadamente excluido (evita una recursión infinita real, detectada en el checkpoint de contradicción). 5 eventos del ciclo de vida de Empleados Digitales (`AgentTask`/`AgentDecision`/`Escalation`, sin `tenantId` en el modelo) quedan documentados como deuda técnica explícita — omisión determinística y trazada, no silenciosa. Cero cambios en el motor conversacional y en `domain/` de los contextos de negocio. Ver `docs/history/ENTREGABLE_5_2_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_5_2_GATE_REVIEW.md`.
- **5.3 — Aplicación Real de Límite de Autonomía** — ✅ Completado (2026-07-11, v2.15.0). Primera aplicación real de `AgentAutonomyLimit` (3.2, inerte desde entonces — `getAutonomyLimit` sin consumidores hasta este entregable). Candidato elegido con evidencia técnica: Coordinador de Agenda IA, exclusivamente en `process-reminder.usecase.js` — vocabulario de acciones cerrado (5 tipos de recordatorio) y mecanismo de escalación ya expuesto en el dashboard. Invariante no negociable implementado explícitamente: ausencia de configuración nunca bloquea (`autonomyLimit != null && autonomyLimit.autoApproved === false`). Cuando `autoApproved: false`, no se ejecuta el motor de recordatorios — se genera una Escalación reutilizando el mecanismo de 3.2 sin ninguna modificación. Recepcionista IA, Automatizaciones y el resto de Empleados Digitales sin ningún cambio. Ver `docs/history/ENTREGABLE_5_3_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_5_3_GATE_REVIEW.md`.
- **5.4 — Automatizaciones Multi-Evento** — ✅ Completado (2026-07-27, v2.16.0). `evaluateAndExecuteRules` (3.3) ya era genérico por `eventTypeId` — la brecha real era de wiring: solo Agenda (`completeAppointment`) dispatchaba a consumidores vía `dispatcherWithCertification`; los otros 6 contextos productores solo certificaban (5.2) sin disparar Automatizaciones. Resuelto con un único punto de extensión (`reactor` inyectable, no-op por defecto) dentro de `registerDomainEvent` (3.0), configurado desde un único llamador (`contexts/index.js`, `setDomainEventReactor`) — sin modificar ninguno de los 6 contextos productores ni el mecanismo de evaluación. Exclusión permanente y explícita (documentada en código, mismo criterio del carve-out de Eventos en 5.2) de los 5 eventos internos de Automatizaciones como disparadores. `CitaCompletada` funciona exactamente igual desde el punto de vista observable. Sin nuevos casos de uso, modelos, migraciones ni puertos — reutiliza completamente `evaluateAndExecuteRules`, `registerDomainEvent`, `DomainEvent`, `EventType`, `AutomationRule`, `EventDelivery` y `CertifyingDomainEventPublisher`. Ver `docs/history/ENTREGABLE_5_4_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_5_4_GATE_REVIEW.md`.

**Fase 5 completa (5.1 → 5.4) desde el punto de vista funcional.** Cualquier trabajo posterior sobre infraestructura reactiva, automatizaciones u orquestación de agentes corresponde a una nueva fase del proyecto, a definir formalmente.

**Alternativas evaluadas y descartadas para esta fase (auditoría integral, 2026-07-11)**  
"Operación Multi-Establecimiento Real" (expansión de la arquitectura multiempresa más allá de lo entregado en 4.1-4.3) y "Ecosistema" (nuevos canales, API pública, apps de cliente/staff) fueron evaluadas junto con "Operaciones Inteligentes" y descartadas por ahora — ambas presuponen una infraestructura reactiva confiable que todavía no existe. Quedan como alternativas futuras, no eliminadas del roadmap conceptual.

**Lo que habilita**  
Una infraestructura reactiva confiable es precondición para escalar con seguridad tanto la operación multi-establecimiento como cualquier expansión de ecosistema — ambas alternativas descartadas para esta fase dependen, en última instancia, de que los eventos y automatizaciones no pierdan trabajo silenciosamente bajo fallo.

**Criterio de cierre**  
Los cuatro entregables del roadmap interno (5.1 → 5.4) completos, con el principio permanente de la fase respetado sin excepción en todos ellos, verificado por grep exhaustivo y `git diff --stat` contra el motor conversacional y los contextos de negocio en cada cierre.

---

### FASE 6 — Operación Multi-Establecimiento Real
**Estado:** ✅ **Fase cerrada oficialmente (2026-08-11, versión de cierre `v2.22.0`).** Definida formalmente el 2026-07-27. Entregable 6.1 completado (documental, sin bump de versión); Entregable 6.2 completado (2026-07-28, v2.17.0); Entregable 6.3 completado (2026-07-28, v2.18.0); Entregable 6.4 completado (2026-07-28, v2.19.0, alcance reducido — "Consolidadas" removida y remitida a 6.6); Entregable 6.5 completado (renombrado "Automatizaciones y Empleados Digitales Multi-Establecimiento", 2026-08-10, v2.20.0); Entregable 6.6 Fase B (saneamiento del hueco cross-tenant accidental) completada (2026-08-10, v2.21.0); Fase A (formalización de la capacidad administrativa `GET /tenants/overview`) completada (2026-08-11, v2.22.0). Los seis entregables del roadmap interno de la Fase 6 (6.1 → 6.6) están completos; retrospectiva completa, decisiones arquitectónicas permanentes y deudas deliberadamente diferidas en `docs/history/PHASE_6_COMPLETION_REPORT.md`.
**Decisión de alcance:** ver este documento — la alternativa "Ecosistema" (evaluada junto con esta y con "Operaciones Inteligentes" desde el cierre de la Fase 5) queda oficialmente diferida para una fase posterior, una vez que la operación multi-establecimiento esté completamente consolidada.

**Decisión arquitectónica previa (2026-07-27) — Establecimiento (Tenant) como unidad de aislamiento**  
Antes de iniciar cualquier entregable de esta fase se auditó formalmente si el sistema requería introducir una entidad "Organización" (agrupando múltiples Establecimientos bajo una misma cuenta) o si la unidad de aislamiento debía seguir siendo el Establecimiento actual (`Tenant`). La alternativa "Organización → Establecimientos" fue evaluada y **descartada por falta de evidencia funcional**: ninguna sección de este documento, del modelo de dominio (`domain-model-v1.md` §1) ni de las decisiones estratégicas fundacionales del producto exige, sugiere o anticipa que un mismo cliente administre múltiples establecimientos desde una única cuenta — el modelo de negocio documentado (expansión comercial "vender a otras clínicas") describe explícitamente cada cliente nuevo como un tenant nuevo e independiente, nunca como una cuenta con múltiples sedes. Además, "Organización" no aparece en ningún bounded context de `domain-model-v1.md`, contradiciendo el §1 (Contexto Negocio), que modela **Establecimiento** como entidad raíz única sin ninguna entidad superior. **El Establecimiento (`Tenant`) se mantiene, por tanto, como la única unidad de aislamiento del sistema** — exactamente como fue concebido desde el inicio del proyecto — y ningún entregable de la Fase 6 introduce una jerarquía de cuentas superior a él.

**Objetivo estratégico**  
Evolucionar la plataforma desde un sistema orientado a un único establecimiento hacia una plataforma capaz de administrar múltiples establecimientos completamente independientes, preservando el aislamiento operativo y reutilizando toda la infraestructura construida en las fases anteriores.

**El problema que resuelve**  
La Fase 4 (4.1-4.3) probó que un segundo establecimiento puede onboardearse de forma autónoma, pero no que la operación multi-establecimiento esté consolidada: `Tenant.businessHours` existe en el schema desde antes de 4.3 pero ningún servicio de disponibilidad lo consulta (Alcance B, diferido por Reconciliación Arquitectónica); no existe campo de zona horaria; `Tenant` nunca fue reconciliado formalmente con el `Establecimiento` modelado en `domain-model-v1.md` §1 (diferido explícitamente en 4.2); y no existe evidencia de reporting u operación centralizada entre establecimientos. La plataforma opera hoy, en la práctica, sobre un único negocio real — la Fase 6 cierra esa brecha antes de exponer la plataforma mediante un ecosistema externo (API pública, nuevos canales), que presupone una operación multi-establecimiento ya sólida.

**Principios**  
- No modificar las reglas de negocio ya consolidadas.
- Reutilizar la infraestructura existente (Eventos, Automatizaciones, Comunicación, Empleados Digitales y Agenda) — ningún entregable de la Fase 6 rediseña esta infraestructura, solo la parametriza por establecimiento.
- Mantener el principio de evolución incremental utilizado en las fases anteriores: ningún entregable se implementa sin pasar primero por sus etapas de diseño y checkpoint de contradicción.
- Priorizar el aislamiento entre establecimientos antes que la exposición mediante APIs o integraciones externas.
- El Establecimiento (`Tenant`) es y seguirá siendo la única unidad de aislamiento del sistema (ver Decisión arquitectónica previa) — ningún entregable de esta fase introduce una entidad de agrupación superior.

**Advertencia arquitectónica conocida (a resolver explícitamente al inicio de 6.2, no a diferir de nuevo)**  
Aplicar horario de atención y zona horaria reales en el flujo de reserva exige tocar `scheduling.service.js`/`availability.service.js` — el motor conversacional, protegido desde la Fase 3 por el principio "no reescribir el motor conversacional". Esto ya causó una Reconciliación Arquitectónica real en el Entregable 4.3 (Alcance B diferido). La Fase 6 no debe volver a diferir este punto por tercera vez sin justificación explícita: su Macroetapa 1 debe decidir, con evidencia, si se acepta una Reconciliación Arquitectónica puntual y acotada sobre ese motor, o si existe una vía de wrapper/adaptador (análoga a `business-config.service.js`, 4.3) que lo evite.

**Roadmap interno (preliminar)**  
6.1 Reconciliación del Modelo de Establecimiento → 6.2 Agenda Multi-Establecimiento → 6.3 Staff Multi-Establecimiento → 6.4 Finanzas por Establecimiento → 6.5 Automatizaciones y Empleados Digitales Multi-Establecimiento → 6.6 Operación Centralizada (incluye reporting consolidado entre establecimientos, removido explícitamente del alcance de 6.4).

- **6.1 — Reconciliación del Modelo de Establecimiento** — ✅ Completado (2026-07-27, entregable documental, sin bump de versión — ver "Versionado" en `docs/history/ENTREGABLE_6_1_COMPLETION_REPORT.md`). Cierra la deuda heredada de 4.2/4.3 (Contexto Negocio completo, nunca resuelto formalmente): `docs/architecture/domain-model-v1.md` §1 declara ahora explícitamente que `Tenant` es la implementación de Establecimiento, sin entidad `Organización` ni renombramiento físico (432 ocurrencias del nombre en 115 archivos, descartado por evidencia). Resuelve la disposición de cada campo pendiente del dominio: "tipo de negocio" redundante con `activeModules` (4.3); horarios/zona horaria diferidos explícitamente a 6.2; país/moneda a backlog sin fecha; mensajes de bienvenida reasignado al backlog de Comunicación (3.1). Cero cambios de código, schema o migraciones — verificado por `git diff --stat` y grep exhaustivo. Ver `docs/history/ENTREGABLE_6_1_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_6_1_GATE_REVIEW.md`.
- **6.2 — Agenda Multi-Establecimiento** — ✅ Completado (2026-07-28, v2.17.0). Aplica horario de atención real por establecimiento (`Tenant.businessHours`) al flujo completo de reserva por WhatsApp (oferta y confirmación) — **zona horaria queda explícitamente fuera de alcance**, backlog sin fecha (blast radius de 9 archivos, sin necesidad evidenciada hoy). Primera Reconciliación Arquitectónica puntual real de la Fase 6: el patrón de wrapper de 4.3/6.1 no bastaba porque los consumidores viven dentro de archivos protegidos desde 3.4. Alcance ampliado en 3 checkpoints, todos reportados y autorizados antes de implementarse: transporte de `tenantId` hasta `whatsapp.service.js`/`conversation.service.js`; `availability-db.service.js` como segundo consumidor real (constantes duplicadas eliminadas en favor de `resolveHourWindow`, fuente única); cierre de un bypass real en `checkAppointmentConflict` (confirmación final de la reserva), detectado por grep exhaustivo en la Macroetapa 3. Sin configuración de establecimiento, el comportamiento es exactamente el legado — verificado por cobertura de regresión construida antes del cambio (inexistente previamente en esta capa). Sin cambios de schema, migraciones, ni en contextos de negocio. Ver `docs/history/ENTREGABLE_6_2_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_6_2_GATE_REVIEW.md`.
- **6.3 — Staff Multi-Establecimiento** — ✅ Completado (2026-07-28, v2.18.0). El modelo de datos ya soportaba multi-establecimiento desde su nacimiento (`Staff.tenantId`, Entregable 2.2) — la brecha real era de aplicación, no de modelo: `PrismaStaffRepository.findById` sin filtro de tenant en 9 de 13 casos de uso, y 3 rutas HTTP (`availability`, `absences`, `capabilities`) sin ningún chequeo. Cerrado replicando el patrón ya existente en `void-commission.usecase.js` (verificación de propiedad tras `findById`, `StaffNotFoundError` uniforme, sin revelar existencia de registros de otro establecimiento) — protección en dos capas (ruta + caso de uso). Mismo tipo de entregable que 4.1 (Saneamiento Tenant-Blind): sin capacidad funcional nueva, sin cambios de schema, sin migraciones, sin Reconciliación Arquitectónica. Índice `@@index([tenantId])` en `Staff` queda diferido como deuda de rendimiento explícita. Ver `docs/history/ENTREGABLE_6_3_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_6_3_GATE_REVIEW.md`.
- **6.4 — Finanzas por Establecimiento** (alcance reducido; "Consolidadas" removida y remitida a 6.6) — ✅ Completado (2026-07-28, v2.19.0). Auditoría encontró que Finanzas ya cumplía el aislamiento por establecimiento (saneado en el Entregable Puente, Fase 2, ADR 007/008/009) — sin hueco equivalente al de Staff (6.3). "Consolidadas" (parte del nombre original) no tenía ningún esqueleto en el código ni en `domain-model-v1.md`, y `PLAN_MAESTRO.md` ya la asigna a 6.6 — removida explícitamente del alcance para evitar duplicación. Cerrada la única inconsistencia real encontrada (`guard-manual-sale-link.usecase.js`, ahora con el mismo patrón de verificación de tenant que sus 2 hermanos del módulo `pos/`) y completada la cobertura de tests faltante para los 3 casos de uso del POS. Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica. Ver `docs/history/ENTREGABLE_6_4_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_6_4_GATE_REVIEW.md`.
- **6.5 — Automatizaciones y Empleados Digitales Multi-Establecimiento** (renombrado en la Macroetapa 1; nombre original "Automatizaciones Multi-Establecimiento") — ✅ Completado (2026-08-10, v2.20.0). La infraestructura reactiva de Automatizaciones (`listActiveByTrigger`, `evaluateAndExecuteRules`, reactor de 5.4) ya soportaba correctamente reglas por tenant + globales — sin hueco. El trabajo real: 3 huecos de autorización cross-tenant en operaciones por id de `AutomationRule` (activar, desactivar, consultar ejecuciones) más 6 huecos equivalentes en Empleados Digitales (`AgentTask`, `AgentDecision`, `Escalation`, `DigitalEmployee` — contexto §9, distinto de Automatizaciones §8, no asignado a ningún entregable del roadmap). Checkpoint de contradicción reportado y resuelto: se incluyeron ambos bloques en un único entregable renombrado, para no fragmentar el roadmap ni dejar una brecha de aislamiento conocida abierta durante el resto de la Fase 6. Cerrado con el mismo patrón canónico de 4.1/6.3 — para las 3 entidades sin columna `tenantId` propia, verificación vía `include` anidado hasta `digitalEmployee.tenantId` en el repositorio Prisma (mismo mecanismo ya usado por `listPending` desde antes de este entregable), sin migración. Sin cambios de schema, ni Reconciliación Arquitectónica, ni cambios en Eventos de Fase 5 o en el motor conversacional. Ver `docs/history/ENTREGABLE_6_5_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_6_5_GATE_REVIEW.md`.
- **6.6 — Operación Centralizada** — ✅ Completado (Fase B: 2026-08-10, v2.21.0; Fase A: 2026-08-11, v2.22.0). La auditoría encontró que la "visibilidad de todos los establecimientos" que el roadmap describía **ya existía, de forma accidental**: el patrón `tenantId ? {...} : {}`, replicado en 13 repositorios de 6+ contextos (Finanzas, Staff, Automatizaciones, Empleados Digitales, Comunicación, Eventos), otorgaba una vista cross-tenant sin filtro a cualquier superadmin sin `tenantId`, sin control de acceso ni auditoría. Decisión adoptada: enfoque "B luego A" — cerrar primero el riesgo de seguridad, formalizar después la capacidad deliberada. Fase B cerrada en un único choke point compartido por todos los contextos (`resolveTenant.js`, aplicado globalmente a `/api/dashboard`), sin modificar ninguno de los 13 repositorios: un superadmin sin `tenantId` ahora debe declarar la intención explícitamente (`X-View-All-Tenants`) o es rechazado con 403. Sin cambios de schema, ni Reconciliación Arquitectónica, ni contextos de negocio tocados. Ver `docs/history/ENTREGABLE_6_6_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_6_6_GATE_REVIEW.md`. **Fase A**: capacidad administrativa nueva de solo lectura, `GET /api/dashboard/tenants/overview`, gateada exclusivamente por `req.tenant.viewAllTenants` (mecanismo cerrado en Fase B, sin reabrirlo); agrega usuarios/citas/conversaciones/ingresos/gastos por establecimiento activo, exclusivamente desde `Transaction`/`Expense` (`Commission`/payroll y `DailyClose` fuera de alcance por decisión explícita); página administrativa nueva, Server Component, consumida vía el proxy de dashboard (`?viewAllTenants=1`) tras un checkpoint de contradicción con el hook `block-apiurl.sh`, resuelto sin modificar el hook. Sin cambios de schema, ni Reconciliación Arquitectónica, ni reapertura de la Fase B. Ver `docs/history/ENTREGABLE_6_6_FASE_A_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_6_6_FASE_A_GATE_REVIEW.md`. **Con este cierre, los seis entregables del roadmap interno de la Fase 6 (6.1 → 6.6) quedan completos.**

**Alternativa diferida — formalizada como Fase 7 (2026-08-13)**  
"Ecosistema" (nuevos canales, API pública, apps de cliente/staff), diferida a lo largo de las Fases 5 y 6, queda formalmente declarada como **Fase 7** — ver sección siguiente.

**Criterio de cierre — ✅ cumplido (2026-08-11)**  
Los seis entregables del roadmap interno (6.1 → 6.6) completos, con el aislamiento operativo entre establecimientos verificado por evidencia (no solo por diseño), sin ninguna regla de negocio existente modificada, sin ninguna entidad de agrupación superior al Establecimiento introducida, y con la advertencia arquitectónica sobre el motor conversacional resuelta explícitamente (no diferida de nuevo — Reconciliación Arquitectónica puntual aceptada en 6.2).

---

### FASE 7 — Ecosistema
**Estado:** ✅ Fase cerrada oficialmente (2026-08-13, entregable de cierre documental, sin bump de versión). Formalizada el 2026-08-13. Roadmap interno retroactivo 7.1 → 7.10 completo (v2.23.0 → v2.32.0, construido antes de esta formalización bajo la metodología de macroetapas de cada entregable, sin que existiera todavía este documento).
**Nota de formalización retroactiva:** los diez entregables 7.1 → 7.10 se construyeron y cerraron individualmente (cada uno con su propio informe de cierre y Gate Review en `docs/history/`) antes de que el bloque "Ecosistema" recibiera nombre formal de fase en este documento. Esta sección no reabre ni modifica ninguna de esas decisiones — únicamente les da la ubicación que les correspondía en el Plan Maestro, cerrando la brecha de proceso identificada el 2026-08-13.

**Objetivo estratégico**  
Exponer la Plataforma Operativa Inteligente más allá de WhatsApp: una API pública autenticada que permite a un cliente final consultar el catálogo, verificar disponibilidad real y gestionar sus propias citas desde un canal distinto al motor conversacional — sin duplicar ni modificar ninguna de sus reglas de negocio.

**El problema que resuelve**  
Al cierre de la Fase 6, toda interacción de un cliente final con la plataforma pasa exclusivamente por WhatsApp. No existe ningún mecanismo de identidad de cliente independiente del motor conversacional, ningún endpoint que un tercero (o una futura app propia) pueda consumir de forma autenticada, y ninguna superficie pública sobre la que construir un canal distinto. La Fase 7 resuelve esto construyendo la capa de identidad y el catálogo de recursos públicos necesarios, reutilizando en cada paso la infraestructura ya construida (Agenda, Servicios, Comunicación) sin tocar el motor conversacional protegido desde la Fase 3.

**Principio permanente de la fase**  
Ningún entregable de la Fase 7 modifica el motor conversacional (`whatsapp.service.js`, `conversation.service.js`, `scheduling.service.js`, `availability.service.js`, `availability-db.service.js`) ni duplica lógica de dominio ya existente — todo recurso público reutiliza casos de uso o funciones ya expuestas, verificado por grep exhaustivo en cada cierre. `tenantId`/`userId` nunca provienen de body/params/query — exclusivamente de la identidad ya autenticada (`ApiKey`/`ClientSession`).

**Roadmap interno (retroactivo)**  
7.1 Certificación de Eventos de Empleados Digitales → 7.2 API Pública, Fase 1 → 7.3 Catálogo de Recursos v1 → 7.4 Identidad de Cliente → 7.5 Disponibilidad Real de Horarios → 7.6 Reserva de Cita → 7.7 Gestión de Cita → 7.8 Revocación de Sesión y Gestión Mínima de ApiKey → 7.9 Trazabilidad Mínima (Alcance A) → 7.10 Corrección del bypass de aislamiento en resolución de precios.

- **7.1 — Certificación de Eventos de Empleados Digitales** — ✅ Completado (v2.23.0). Cierra los 5 eventos del ciclo de vida de Empleados Digitales que 5.2 dejó documentados como deuda técnica explícita (sin `tenantId` en el modelo) — enriquecidos con datos ya en memoria, sin nuevas consultas.
- **7.2 — API Pública, Fase 1** — ✅ Completado (v2.24.0). `ApiKey` (hash-only), middleware `apiKeyAuth`, y cierre del hallazgo A5 pendiente sobre `/api/billing/*` (`requireInternalToken`), descubierto durante el checkpoint de este entregable.
- **7.3 — Catálogo de Recursos v1** — ✅ Completado (v2.25.0). `GET /api/public/services`, `POST /api/public/availability` — excluye deliberadamente `resolve-service-price` por un bypass de aislamiento real descubierto en la auditoría (corregido después, en 7.10).
- **7.4 — Identidad de Cliente** — ✅ Completado (v2.26.0). `ClientSession`/`ClientVerificationCode`, login por teléfono + código OTP entregado por WhatsApp (reutiliza Comunicación, 3.1), respuestas anti-enumeración.
- **7.5 — Disponibilidad Real de Horarios** — ✅ Completado (v2.27.0). `POST /api/public/availability/slots`, reutiliza `suggestAvailableVetSlots`/`findNextAvailableGroomingSlot` (protegidas, sin modificar) vía un puente categoría→bucket.
- **7.6 — Reserva de Cita** — ✅ Completado (v2.28.0). Primer endpoint de escritura de la API pública — reutiliza `createAppointment` sin modificarlo; la protección de doble reserva ya era atómica desde 4.1/A6.
- **7.7 — Gestión de Cita** — ✅ Completado (v2.29.0). `GET`/`POST .../cancel` sobre las propias citas — ownership por `id+userId+tenantId`, reutiliza `isAllowedTransition` sin duplicar la tabla de transiciones.
- **7.8 — Revocación de Sesión y Gestión Mínima de ApiKey** — ✅ Completado (v2.30.0). `POST /api/public/auth/logout`, listado/revocación de `ApiKey` desde el dashboard — cierra los hallazgos M1/M2 de la auditoría integral del Portal del Cliente.
- **7.9 — Trazabilidad Mínima (Alcance A)** — ✅ Completado (v2.31.0). Logging estructurado de cada revocación exitosa. Alcance B (atribución por staff individual) diferido explícitamente — el dashboard no tiene modelo de identidad multi-staff.
- **7.10 — Corrección del bypass de aislamiento en resolución de precios** — ✅ Completado (v2.32.0). `tenantId` propagado a `ResolveServicePriceUseCase`/`ChangeServicePriceUseCase` — endurecimiento preventivo, el bypass era inexplotable en cualquier camino de producción existente.

**Decisión raíz resuelta (2026-08-13) — Opción C: apps propias hoy, terceros no descartados**  
Se auditó la evidencia disponible antes de decidir: `domain-model-v1.md` §11 ya modela "Portal del Cliente" como un canal de primera clase de la propia plataforma, en la misma categoría que WhatsApp/Email/Dashboard — nunca como una superficie para integradores externos. No existe en todo el proyecto ninguna mención a un programa de partners, marketplace de integraciones, o tercero real identificado como consumidor. Con esa evidencia, se descartó tanto declarar la API exclusiva para siempre (Opción A, afirmación que el proyecto no tiene base para hacer) como abrirla ya a terceros (Opción B, sin ningún consumidor real que lo justifique). **Se adopta la Opción C:** la API pública sirve hoy exclusivamente a canales propios del equipo (Portal del Cliente); la puerta a integradores externos queda abierta conceptualmente pero sin ningún trabajo adicional mientras no exista un segundo consumidor real que lo justifique.

**Consecuencia directa sobre el backlog** — con la Opción C, ninguno de los siguientes entregables tiene ya urgencia arquitectónica; se archivan como backlog condicional, no como trabajo pendiente de esta fase:
- Creación y expiración de `ApiKey` vía API — innecesario mientras el propio equipo siga gestionando sus keys por acceso directo a la base de datos; se retoma solo si aparece un segundo consumidor real.
- Política de CORS para terceros — innecesaria mientras el único consumidor sea un canal propio (sin `Origin` de navegador de un tercero que bloquear).
- Alcance B de Trazabilidad (atribución por staff individual) — sigue diferido, ahora sin presión de un caso de uso multi-consumidor que lo urgiera.

**Backlog condicional restante (no bloquea el cierre de la fase, no depende de la decisión raíz)**  
- Vinculación `serviceId` ↔ `Appointment` al reservar desde el Portal — limitación heredada de `createAppointment`, no corregida por decisión explícita.
- `resolve-service-price` permanece excluido del catálogo público — su reincorporación, ahora que el bypass de 7.10 está corregido, es una decisión de alcance separada, no automática.

**Criterio de cierre — ✅ cumplido (2026-08-13)**  
Los diez entregables del roadmap interno (7.1 → 7.10) completos, la decisión raíz de consumidores tomada explícitamente con evidencia (Opción C), y el backlog que dependía de ella archivado como condicional en vez de urgente. Cualquier trabajo posterior sobre creación/expiración de `ApiKey`, CORS, o apertura a terceros corresponde a una nueva fase o a la reapertura justificada de ésta, a decidir formalmente cuando exista un segundo consumidor real.

---

### FASE 8 — Calidad del Motor Conversacional
**Estado:** 🚧 En curso. Declarada el 2026-09-02, tras el ADR 010.
**Origen:** informe comparativo externo (`Mateos Pet AI vs. Sancho Agent IA`, 2026-09-01), que auditó memoria/estado/flujo del motor conversacional y encontró carencias funcionales reales, verificadas contra el código antes de aceptarse.

**Objetivo estratégico**
Cerrar las carencias reales del motor conversacional en las tres capas que determinan su calidad: memoria (qué recuerda el modelo), estado (cómo se gobierna el wizard) y flujo (cómo se procesa cada mensaje entrante) — sin introducir dominio de negocio nuevo ni reescribir el motor.

**Principio permanente de la fase**
Ningún entregable de la Fase 8 reescribe el motor conversacional ni introduce lógica de negocio nueva — corrige carencias de la capa de runtime (memoria, concurrencia, idempotencia) reutilizando la persistencia ya existente. Todo cambio que toque un archivo protegido desde la Fase 3 pasa primero por Reconciliación Arquitectónica explícita (ADR 010 la habilita para este bloque, no la da por sentada para trabajo futuro).

**Roadmap interno (preliminar)**
8.1 Contención y Memoria Conversacional (D-E5, D-E4, D-F4, D-F2, D-M1) → 8.2 Concurrencia y Durabilidad (D-E3, D-F1) → 8.3 Modelado de Estado (D-E1, D-E2).

- **8.2 — Concurrencia y Durabilidad** — ✅ Completado (2026-09-02, v2.34.0). Mutex en memoria por remitente (`phone-lock.service.js`) en vez del advisory lock de Postgres de Sancho — verificado que el backend corre una única instancia en el VPS, evitando envolver todo el pipeline en una transacción; lock de Postgres diferido explícitamente a si el proyecto escala horizontalmente. Cola durable (`InboundJob` + `jobs/inbound-message.job.js`, patrón `node-cron` de 5.1): `webhook.controller.js` ya no procesa inline, encola y responde 200; el worker reclama y ejecuta el mismo pipeline de siempre. Cierra además una regresión real introducida por 8.1: sin la cola, un crash entre persistir el mensaje y responder dejaba al cliente sin respuesta y sin recuperación, porque la deduplicación de 8.1 descartaba el reintento de Meta. Cero cambios en `contexts/`. Ver `docs/history/ENTREGABLE_8_2_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_8_2_GATE_REVIEW.md`.
- **8.3 — Modelado de Estado** — ✅ Completado (2026-09-02, v2.35.0). Alcance reducido respecto al informe externo, con evidencia: la auditoría de la Macroetapa 1 encontró que el escalamiento a humano (`Conversation.status`) ya tenía una FSM real desde el Entregable 3.1 (`contexts/communication`), y que el wizard de reserva es intencionalmente interrumpible desde cualquier paso — una tabla estricta de transiciones (patrón de Sancho) habría prohibido resets legítimos. Se implementó en su lugar un vocabulario cerrado (`STEPS`, ampliado con `HUMAN_TAKEOVER`, antes un string literal fuera del enum) con validación de diagnóstico no bloqueante (`session-steps.service.js`), y se reforzó la señal que dispara el escalamiento (`step === STEPS.HUMAN_TAKEOVER`, además del flag legado ya existente). Cambios en `contexts/` confinados al wiring de `receptionist`. **Cierra el roadmap interno de la Fase 8 (8.1 → 8.3).** Ver `docs/history/ENTREGABLE_8_3_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_8_3_GATE_REVIEW.md`.

- **8.1 — Contención y Memoria Conversacional** — ✅ Completado (2026-09-02, v2.33.0). Reconciliación Arquitectónica puntual (ADR 010, Opción A+B): historial real de `Message` enviado al LLM por primera vez (`context-builder.service.js`, nuevo, patrón inspirado en `context_builder.py` de Sancho Agent IA); deduplicación de webhook por `wamid` (`Message.externalId`, columna nueva); todos los mensajes de un batch de Meta procesados (antes: solo `messages[0]`); respuesta con IA ya no se corta sin contexto RAG; reintentos con backoff en OpenAI. Cero cambios en `contexts/` ni en el contrato externo del motor. Ver `docs/history/ENTREGABLE_8_1_COMPLETION_REPORT.md` y `docs/history/ENTREGABLE_8_1_GATE_REVIEW.md`.

---

## 6. Reglas para Incorporar Nuevas Funcionalidades

Antes de construir cualquier funcionalidad, deben responderse estas cinco preguntas. Si alguna respuesta es negativa, la funcionalidad no debe desarrollarse en este momento.

**¿Qué trabajo humano elimina?**  
Describir concretamente qué tarea humana deja de existir, se simplifica o se automatiza. Si la respuesta es vaga o inexistente, la funcionalidad no tiene prioridad.

**¿Pertenece al dominio correcto?**  
Verificar que la entidad o regla de negocio que requiere la funcionalidad está modelada en el modelo de dominio oficial. Si no está, actualizar el modelo primero.

**¿Respeta los principios?**  
Evaluar la funcionalidad contra los 10 Principios Permanentes. Si viola más de uno, no es prioritaria. Si viola el Principio 10, requiere justificación explícita.

**¿Pertenece a la fase activa?**  
Verificar que la funcionalidad corresponde a la fase en curso. Una funcionalidad de una fase futura no debe construirse antes, aunque sea fácil de implementar. La facilidad de implementación no es criterio de prioridad.

**¿Existe una decisión previa que ya responda este problema?**  
Revisar los ADRs y los informes de fase. Si el problema ya fue resuelto o diferido intencionalmente, no debe reabrirse sin justificación explícita.

---

## 7. Cómo Tomar Decisiones

El orden correcto para decidir sobre cualquier aspecto del producto es siempre de mayor a menor abstracción. Nunca al revés.

```
1. VISIÓN
   ¿Qué estamos construyendo?
   ¿A quién sirve? ¿Qué problema de negocio resuelve?
          ↓
2. PRINCIPIOS
   ¿Es coherente con los 10 principios permanentes?
          ↓
3. PLAN MAESTRO
   ¿Pertenece a la fase activa?
   ¿No adelanta trabajo de fases futuras?
          ↓
4. MODELO DE DOMINIO
   ¿Las entidades necesarias existen en el modelo?
   ¿El bounded context está bien delimitado?
          ↓
5. ARQUITECTURA
   ¿En qué capa vive? ¿En el dominio, en los casos de uso, en los adaptadores?
   ¿Un segundo canal podría invocar esta lógica sin modificarla?
          ↓
6. CÓDIGO
   Solo cuando todo lo anterior está claro.
```

**El error más común** es empezar por el código y razonar hacia atrás intentando justificar la decisión con los principios. Ese camino produce implementaciones que parecen correctas pero violan la arquitectura. La dirección del razonamiento importa tanto como el resultado.

---

## 8. El Repositorio Documental

El conocimiento del proyecto está organizado en documentos con responsabilidades distintas. Cada pregunta tiene un lugar donde debe responderse.

| Pregunta | Documento |
|---|---|
| ¿Qué estamos construyendo y hacia dónde evoluciona? | **Plan Maestro** (este documento) |
| ¿Cómo funciona el negocio? ¿Qué entidades existen? | **Modelo de Dominio** |
| ¿Cómo está construido el sistema? | **Documentos de Arquitectura** |
| ¿Qué se construyó en cada fase? | **Informes de Cierre de Fase** |
| ¿Por qué se tomó una decisión técnica específica? | **ADRs** |

Si una pregunta no encuentra su respuesta en ninguno de estos documentos, esa es la señal de que falta un documento — no de que la respuesta deba incorporarse al Plan Maestro.

---

## 9. Conclusión

Este documento existe porque el objetivo no es desarrollar funcionalidades. El objetivo es construir, paso a paso, una Plataforma Operativa Inteligente que reduzca progresivamente el trabajo operativo de los negocios especializados en salud y bienestar animal.

La diferencia entre un producto que crece bien y uno que acumula deuda hasta volverse inmanejable no está en la velocidad de construcción. Está en la claridad con la que se define qué se construye, en qué orden y por qué.

Cada fase de este plan tiene un nombre y un propósito porque cada fase resuelve un problema específico que habilita la siguiente. La Fase 1 estableció que el dominio es soberano. La Fase 2 completará ese dominio. La Fase 3 le dará inteligencia especializada. La Fase 4 lo hará comercialmente escalable. La Fase 5 lo convertirá en una infraestructura operacional confiable.

Quien lea este documento dentro de diez años debería poder entender exactamente qué producto decidimos construir y por qué. Que el negocio tiene prioridad sobre la tecnología. Que el dato pertenece al negocio. Que los canales son reemplazables. Que los empleados digitales trabajan para el dominio.

Esos principios no son preferencias de diseño. Son las reglas que harán que este producto sea defendible cuando el mercado cambie, los modelos de IA evolucionen y nuevos canales de comunicación aparezcan.

**El dominio permanecerá.**

---

*Plan Maestro v1.1 · Plataforma Operativa Inteligente · Mateos Pet · 2026*
