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
**Estado:** ✅ Completada

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
**Estado:** ✅ Completada (2026-07-01) — con alcance re-declarado por el ADR 006 (2026-07-02): la fase entregó el diseño, la capa de aplicación, la persistencia y la validación de dominio de sus tres entregables; la **exposición de los casos de uso a canales y operadores quedó fuera de su alcance real** y se realiza en el entregable puente "Exposición del Sistema Operativo", precondición de la Fase 3 (ver Roadmap interno).

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
**Estado:** Futura

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
**Estado:** Futura

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
La Fase 5. Con la arquitectura multiempresa establecida, la plataforma puede crecer mediante nuevos canales, integraciones externas y módulos especializados sin alterar el núcleo operativo.

**Criterio de cierre**  
Un segundo establecimiento —diferente al primero— puede ser onboardeado de forma autónoma, operar completamente en la plataforma y generar facturación sin intervención del equipo de desarrollo.

---

### FASE 5 — Ecosistema
**Estado:** Futura

**Objetivo**  
Expandir la plataforma mediante nuevos canales de comunicación, una API pública para integraciones externas, aplicaciones propias para clientes y staff, y módulos especializados activables por tipo de negocio.

**El problema que resuelve**  
Una plataforma operativa madura necesita conectarse con el ecosistema de sus usuarios: los propietarios de mascotas quieren acceder directamente, el staff necesita herramientas móviles, los laboratorios necesitan enviar resultados al historial clínico, los proveedores necesitan conectar inventarios. Abrir la plataforma a estos actores multiplica su valor sin reemplazar su núcleo.

**Las capacidades que incorpora**  
- Los propietarios de mascotas pueden consultar citas, solicitar servicios y ver el historial directamente, sin intermediarios
- Integradores y partners pueden conectar sistemas externos mediante una API pública documentada
- El equipo del establecimiento tiene acceso móvil a la operación
- Módulos especializados activables: telemedicina, programas de bienestar, integración con laboratorios y proveedores

**Lo que habilita**  
Un ecosistema donde la plataforma es el núcleo operativo y múltiples actores —clientes, staff, partners, integraciones— orbitan alrededor de ella.

**Criterio de cierre**  
Al menos dos canales adicionales están operativos y tienen adopción medible. La API pública tiene al menos un integrador externo activo.

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

Cada fase de este plan tiene un nombre y un propósito porque cada fase resuelve un problema específico que habilita la siguiente. La Fase 1 estableció que el dominio es soberano. La Fase 2 completará ese dominio. La Fase 3 le dará inteligencia especializada. La Fase 4 lo hará comercialmente escalable. La Fase 5 lo convertirá en ecosistema.

Quien lea este documento dentro de diez años debería poder entender exactamente qué producto decidimos construir y por qué. Que el negocio tiene prioridad sobre la tecnología. Que el dato pertenece al negocio. Que los canales son reemplazables. Que los empleados digitales trabajan para el dominio.

Esos principios no son preferencias de diseño. Son las reglas que harán que este producto sea defendible cuando el mercado cambie, los modelos de IA evolucionen y nuevos canales de comunicación aparezcan.

**El dominio permanecerá.**

---

*Plan Maestro v1.1 · Plataforma Operativa Inteligente · Mateos Pet · 2026*
