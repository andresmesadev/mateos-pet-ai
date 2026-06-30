# Plan Maestro de Evolución
## Plataforma Operativa Inteligente · Mateos Pet

**Versión:** 1.0  
**Fecha:** 2026-06-30  
**Estado:** Documento vivo — fuente oficial de verdad sobre la evolución del producto  
**Autoridad:** Toda decisión de producto, arquitectura o desarrollo se evalúa contra este documento.

---

## Cómo usar este documento

Este documento es la Constitución del Proyecto.

Debe leerse completo antes de:

- Iniciar una nueva fase de desarrollo
- Proponer o aprobar una nueva funcionalidad
- Incorporar una nueva IA o un nuevo desarrollador al proyecto
- Cambiar el rumbo del producto

Si alguna propuesta contradice este documento, debe justificarse explícitamente antes de aceptarse. La carga de la prueba recae sobre quien propone el cambio, no sobre quien defiende el plan.

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

Estos diez principios son inmutables. Fueron aprobados al cierre de la etapa de definición estratégica (2026-06-26). Toda decisión futura de producto, arquitectura o desarrollo se evalúa contra ellos. Si una propuesta viola más de uno, no es prioritaria.

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
No para WhatsApp. No para el dashboard. Trabajan para el dominio del negocio.

**Principio 6 — Toda funcionalidad elimina, simplifica o automatiza trabajo humano.**  
Si no lo hace, debe cuestionarse su prioridad.

**Principio 7 — La plataforma se adapta al negocio. No al revés.**  
Cada negocio usa únicamente los módulos que necesita.

**Principio 8 — Los canales son reemplazables.**  
WhatsApp, Email, Portal del Cliente o cualquier integración futura son puertas de entrada. Nunca contienen lógica del negocio.

**Principio 9 — El activo real es el conocimiento operativo acumulado.**  
Clientes, mascotas, servicios, historiales, automatizaciones, datos. No los modelos de IA.

**Principio 10 — La pregunta que filtra todo.**  
Antes de implementar cualquier funcionalidad: *¿Qué trabajo humano deja de existir gracias a esta funcionalidad?* Si no existe una respuesta clara, esa funcionalidad probablemente no pertenece al núcleo del producto.

---

## 3. Arquitectura General

### La separación fundamental

El sistema opera sobre dos capas que nunca se mezclan:

```
DOMINIO DEL NEGOCIO
  Clientes · Mascotas · Agenda · Servicios
  Staff · Finanzas · Historiales · Automatizaciones
          ↑ el dominio es soberano
          ↓ los canales lo consumen

CANALES
  WhatsApp · Dashboard · Email · Portal del Cliente · Futuras integraciones
```

**El dominio no sabe de los canales. Los canales saben del dominio.**

Esta separación no es una preferencia técnica. Es la garantía de que el negocio puede cambiar de canal sin perder sus datos, sus reglas y su historia.

### Las capas del sistema

```
┌──────────────────────────────────────────────────────────┐
│                    CANALES Y ADAPTADORES                  │
│   WhatsApp Adapter · Dashboard API · Portal del Cliente   │
│   (reciben solicitudes, transforman, invocan casos de uso)│
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                    CASOS DE USO                           │
│   (coordinan servicios de dominio · no tienen canal)      │
│   AgendarCita · CompletarServicio · GenerarCierreDelDía   │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                 SERVICIOS DE DOMINIO                      │
│   price-resolver · commission · intent-detector           │
│   medical-auto-capture · (futuros servicios de dominio)   │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   MODELO DE DOMINIO                       │
│   Client · Pet · Appointment · Service · Staff            │
│   Commission · DayClose · AutomationRule · AgentTask      │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                  EMPLEADOS DIGITALES                      │
│   Recepcionista IA · Coordinador de Agenda IA             │
│   Asistente de Grooming IA · Asistente Financiero IA      │
│   Asistente Clínico IA · Asistente de Recuperación IA     │
│   (trabajan sobre el dominio, nunca son el dominio)       │
└──────────────────────────────────────────────────────────┘
```

### Reglas de arquitectura permanentes

**1. El criterio de prueba del dominio.**  
Antes de ubicar cualquier lógica en un servicio, preguntarse: *¿Podría el Portal del Cliente llamar este servicio sin modificarlo?* Si sí → pertenece al dominio. Si no → pertenece al adaptador del canal.

**2. Los adaptadores no orquestan.**  
Un adaptador recibe una solicitud, la transforma al lenguaje del dominio, invoca un caso de uso, y transforma la respuesta para el canal. La coordinación entre servicios de dominio vive en los casos de uso, nunca en los adaptadores.

**3. Los casos de uso son agnósticos al canal.**  
Un caso de uso no sabe si fue invocado desde WhatsApp, desde el dashboard, desde una API pública o desde un test. Recibe datos del dominio. Devuelve resultados del dominio.

**4. Las comisiones son hechos contables inmutables.**  
Los registros financieros no se modifican. Las correcciones se realizan mediante anulación + nuevo registro. Esta regla protege la integridad histórica del negocio.

**5. El precio se resuelve en un único lugar.**  
Toda resolución de precio pasa por `price-resolver.service.js`. Ningún otro módulo implementa reglas de precios por su cuenta. La jerarquía oficial es: override manual > precio específico de la mascota > precio base del catálogo.

### Separación de dominios

La plataforma opera sobre dos dominios independientes:

**Dominio Operativo** (siempre activo): Clientes, Mascotas, Agenda, Servicios, Staff, Finanzas, Automatizaciones. Funciona para cualquier tipo de negocio.

**Dominio Clínico** (módulo opcional): Historia Clínica, Vacunas, Tratamientos, Medicamentos, Diagnósticos, Prescripciones. Solo se activa en establecimientos veterinarios.

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
Si se construye al revés —canal primero, dominio después— cada nuevo canal requiere reimplementar la lógica del negocio. Si el dominio está sólido, agregar un nuevo agente o canal es marginal. El costo de hacerlo bien desde el inicio es bajo. El costo de corregirlo después es alto.

**Consecuencia práctica:**  
Antes de mejorar cualquier canal (WhatsApp, dashboard) o cualquier agente de IA, verificar que las entidades de dominio y las reglas de negocio que necesitan están correctamente modeladas. Si no están, el modelo de dominio se actualiza primero.

---

## 5. Plan Maestro de Evolución

El producto evoluciona en cinco fases. Cada fase construye sobre la anterior. No se puede iniciar una fase sin haber completado la anterior.

---

### FASE 1 — Soberanía del Dominio
**Estado:** ✅ Completada (27 de junio de 2026)

**Objetivo**  
Establecer que el dominio del negocio es la autoridad. Que las reglas del negocio —sus precios, sus comisiones, sus intenciones, su historial— viven en servicios propios, independientes de canales y tecnologías.

**El problema que resolvió**  
Antes de esta fase, la lógica de negocio vivía dispersa: parte en el agente de WhatsApp (`conversation.service.js`), parte en los endpoints del dashboard, parte en la interfaz. No existía un lugar único donde vivieran las reglas del negocio. Cambiar una regla de precios requería tocar múltiples archivos en múltiples capas.

**Lo que se construyó**  
- Servicio de dominio de precios (`price-resolver.service.js`) con jerarquía oficial y trazabilidad completa
- Extracción del detector de intenciones (`intent-detector.service.js`) de WhatsApp al dominio
- Extracción de la captura médica automática (`medical-auto-capture.service.js`) al dominio
- Modelo `Commission` como registro contable inmutable
- Agenda operativa con resumen del día, alertas con acción y precio visible con jerarquía
- Cierre del día basado en hechos contables (no en recálculos)
- Mapa de desacoplamiento de WhatsApp como plano de construcción permanente

**Lo que habilitó**  
La Fase 2. Existe ahora un conjunto de servicios de dominio que cualquier caso de uso o adaptador puede invocar sin modificarlos. El criterio de prueba permanente —"¿podría el Portal del Cliente llamar este servicio sin modificarlo?"— puede aplicarse a toda la arquitectura futura.

**Criterio de cierre cumplido**  
Los servicios de dominio son agnósticos al canal. El agente de WhatsApp sigue funcionando exactamente igual. La agenda muestra precio, fuente y alertas accionables. El cierre del día lee exclusivamente registros `Commission`. 143 tests passing. 0 regresiones.

---

### FASE 2 — Sistema Operativo del Negocio
**Estado:** Pendiente

**Objetivo**  
Completar el Sistema Operativo del negocio. Que el dominio operativo esté completamente modelado, que los casos de uso coordinen los servicios de dominio, y que el operador humano pueda gestionar la operación diaria completa desde el dashboard sin depender del agente de IA.

**El problema que resuelve**  
La Fase 1 construyó servicios de dominio. Pero esos servicios no tienen una capa que los coordine. Hoy, si la agenda necesita registrar una cita completada, calcular su precio, generar la comisión y notificar al staff, esa orquestación ocurre dispersa entre adaptadores. Los canales todavía coordinan demasiado. Además, entidades críticas del modelo de dominio —`DayClose` como entidad, `Staff` con disponibilidad real, la capa de casos de uso— todavía no existen como tales en el sistema.

**Qué debe incorporar esta fase**

*Capa de aplicación (casos de uso):*
- Casos de uso que coordinen múltiples servicios de dominio sin que ningún adaptador de canal tenga que orquestar directamente
- Un caso de uso invocable desde cualquier canal: `CompletarServicio`, `AgendarCita`, `GenerarCierreDelDía`

*Entidades del dominio operativo faltantes:*
- `DayClose` como entidad generada y persistida (no solo un endpoint de lectura)
- `Staff` con disponibilidad real y asignación desde la agenda
- Liquidación por profesional: resumen de comisiones por período sin intervención manual

*Reportes financieros históricos:*
- Períodos financieros consultables con total confianza en la inmutabilidad de los datos
- El operador puede ver el resumen de cualquier semana o mes pasado

*Catálogo de servicios completo:*
- CRUD completo desde el dashboard
- Reglas de precio por servicio, por mascota o por cliente gestionables desde la interfaz

**Lo que NO pertenece a esta fase**
- Nuevos canales (Portal del Cliente, Email, App móvil)
- Motor de automatizaciones configurable
- Mejoras al agente de WhatsApp
- Funcionalidades multiempresa o multi-tenant
- Dominio Clínico (historia clínica, vacunas, diagnósticos)

**Lo que habilita**  
La Fase 3. Cuando el Sistema Operativo esté completo, los Empleados Digitales tendrán entidades claras sobre las cuales actuar, eventos bien definidos a los que reaccionar, y casos de uso estables que invocar. El agente de WhatsApp podrá evolucionar de responder mensajes a delegar en empleados digitales especializados.

**Criterio de terminación**  
El operador puede gestionar la operación diaria completa —agenda, servicios, staff, comisiones, cierre del día, reportes— exclusivamente desde el dashboard, sin intervención del agente de IA. Toda la lógica de coordinación vive en casos de uso, no en adaptadores. Las entidades faltantes del modelo de dominio operativo están implementadas.

---

### FASE 3 — Empleados Digitales Especializados
**Estado:** Futura

**Objetivo**  
Reemplazar el agente monolítico de WhatsApp por un equipo de empleados digitales especializados, cada uno con responsabilidades claras, límites de autonomía definidos, y auditoría de cada decisión como entidad del dominio.

**El problema que resuelve**  
Un agente que lo hace todo es frágil, difícil de mejorar, y se comporta de forma impredecible. Un equipo de agentes especializados tiene responsabilidades claras, es auditable, y cada miembro puede mejorarse de forma independiente.

**Los empleados digitales planificados**

| Empleado Digital | Responsabilidad principal |
|---|---|
| Recepcionista IA | Primer contacto, identificación de intención, enrutamiento al especialista correcto |
| Coordinador de Agenda IA | Disponibilidad, agendamiento, confirmaciones, recordatorios |
| Asistente de Grooming IA | Preferencias por mascota, precio acordado, frecuencia, observaciones |
| Asistente de Recuperación IA | Clientes en riesgo, campañas de reactivación, seguimiento |
| Asistente Financiero IA | Cierre del día, split de comisiones, reportes bajo demanda |
| Asistente Administrativo IA | Reportes operativos, catálogo, configuración asistida |
| Asistente Clínico IA | Pre-consulta, historial clínico, alertas de vacunas, notas (solo si módulo clínico activo) |

**Entidades que esta fase materializa**
- `AgentTask` — Tarea del empleado digital como entidad del OS
- `AgentDecision` — Registro auditable de cada decisión tomada
- `EscalationTicket` — Escalación como entidad del OS, no como estado de conversación
- `AutonomyLimit` — Configuración de hasta dónde puede actuar un agente sin confirmación humana

**Motor de automatizaciones**  
Esta fase incluye el motor de reglas configurable (`AutomationRule`): disparador + condición + acción + canal. Permite que el negocio configure automatizaciones sin programación. Ejemplo: "Cuando una cita es agendada → enviar confirmación al cliente por WhatsApp."

**Lo que NO pertenece a esta fase**
- Multiempresa o multi-tenant
- Portal del Cliente como canal independiente
- Nuevos canales de comunicación masiva

**Criterio de terminación**  
El Recepcionista IA y el Coordinador de Agenda IA están operativos como empleados digitales separados, con responsabilidades delimitadas y auditoría completa de sus decisiones. El motor de automatizaciones está activo con al menos las reglas más comunes preconfiguradas. Las escalaciones son entidades del OS.

---

### FASE 4 — Plataforma Comercial
**Estado:** Futura

**Objetivo**  
Evolucionar el producto desde un sistema para Mateos Pet hacia una plataforma que puede operar múltiples negocios independientes, con configuración por establecimiento, facturación automatizada y onboarding autónomo.

**El problema que resuelve**  
Mateos Pet es el primer cliente y el laboratorio del producto. Cuando el producto esté probado en producción real, la misma arquitectura puede servir a otras clínicas y peluquerías. El multitenancy no es una funcionalidad nueva: es exponer lo que ya existe de forma configurable para cada nuevo cliente.

**Qué debe incorporar esta fase**
- Multitenancy real: cada establecimiento opera en su propio espacio de datos
- Panel de configuración del negocio: módulos activos, reglas de split, horarios, staff, servicios
- Onboarding autónomo para nuevas clínicas: el sistema puede configurarse sin intervención manual del equipo de desarrollo
- Facturación automatizada por establecimiento (integración con sistema de pagos)
- Panel de administración para el equipo de Mateos Pet (métricas, estado de tenants, incidencias)

**Lo que NO pertenece a esta fase**
- APIs públicas para terceros
- Marketplace de integraciones
- Expansión a nuevas especies o especialidades veterinarias

**Criterio de terminación**  
Un segundo establecimiento (diferente a Mateos Pet) puede ser onboardeado de forma autónoma, operar completamente en el sistema, y generar facturación automatizada. El equipo de desarrollo no interviene en el proceso de onboarding.

---

### FASE 5 — Ecosistema
**Estado:** Futura

**Objetivo**  
Expandir la plataforma mediante nuevos canales de comunicación, una API pública para integraciones externas, aplicaciones propias (Portal del Cliente, App móvil) y un ecosistema de módulos especializados.

**Qué debe incorporar esta fase**
- Portal del Cliente: los propietarios de mascotas pueden consultar citas, solicitar servicios y ver el historial de su mascota directamente, sin pasar por WhatsApp
- API pública documentada para que integradores y partners puedan conectar sistemas externos
- App móvil para el equipo del establecimiento
- Integración con laboratorios (resultados directamente en la historia clínica)
- Integración con proveedores de insumos (inventario conectado)
- Módulos especializados activables: telemedicina, e-commerce de productos, programas de bienestar

**Criterio de terminación**  
Al menos dos canales adicionales a WhatsApp están operativos. La API pública tiene al menos un integrador externo activo. El Portal del Cliente tiene adopción medible por parte de los propietarios de mascotas.

---

## 6. Reglas para Incorporar Nuevas Funcionalidades

Antes de construir cualquier funcionalidad, deben responderse estas cinco preguntas. Si alguna respuesta es negativa, la funcionalidad no debe desarrollarse en este momento.

**Pregunta 1 — ¿Qué trabajo humano elimina?**  
Describir concretamente qué tarea humana deja de existir, se simplifica o se automatiza gracias a esta funcionalidad. Si la respuesta es vaga o inexistente, la funcionalidad no tiene prioridad.

**Pregunta 2 — ¿Pertenece al dominio correcto?**  
Verificar en `docs/architecture/domain-model-v1.md` que la entidad o regla de negocio que requiere la funcionalidad está modelada en el dominio. Si no está, actualizar el modelo de dominio primero.

**Pregunta 3 — ¿Respeta los principios?**  
Evaluar la funcionalidad contra los 10 Principios Permanentes de la sección 2. Si viola más de uno, no es prioritaria. Si viola el Principio 10 (no elimina trabajo humano), requiere justificación explícita.

**Pregunta 4 — ¿Pertenece realmente a esta fase?**  
Verificar que la funcionalidad corresponde a la fase activa del Plan Maestro. Una funcionalidad de Fase 3 no debe construirse durante la Fase 2, aunque sea fácil de implementar. La facilidad de implementación no es criterio de prioridad.

**Pregunta 5 — ¿Existe una decisión previa que ya responda este problema?**  
Revisar las decisiones arquitectónicas registradas. Si el problema ya fue resuelto o diferido intencionalmente, no debe reabrirse sin justificación explícita.

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
3. MODELO DE DOMINIO
   ¿Las entidades necesarias existen en el dominio?
   ¿El bounded context está bien delimitado?
          ↓
4. PLAN MAESTRO
   ¿Pertenece a la fase activa?
   ¿No adelanta trabajo de fases futuras?
          ↓
5. ARQUITECTURA
   ¿En qué capa vive? ¿Dominio, caso de uso, adaptador?
   ¿El criterio de prueba del dominio se cumple?
          ↓
6. CÓDIGO
   Solo cuando todo lo anterior está claro.
```

**El error más común** es empezar por el código y razonar hacia atrás intentando justificar la decisión con los principios. Ese camino produce código que parece correcto pero viola la arquitectura. La dirección del razonamiento importa tanto como el resultado.

---

## 8. Estado del Repositorio

### Documentos de arquitectura
- `docs/architecture/domain-model-v1.md` — El modelo conceptual oficial del negocio. 11 bounded contexts. Fuente de verdad de todas las entidades.
- `docs/architecture/whatsapp-decoupling-map.md` — Análisis completo de `conversation.service.js`. Plano de construcción para el desacoplamiento gradual.

### Documentos de producto
- `docs/product/product-principles.md` — Los 10 principios permanentes con criterios de aplicación.
- `docs/product/project-positioning.md` — Definición oficial del producto, decisiones estratégicas fundacionales, usuaria principal Lina, Fase A vs Fase B.

### Informes de fase
- `docs/PHASE_1_COMPLETION_REPORT.md` — Informe oficial del cierre de la Fase 1. Entregables, decisiones arquitectónicas, métricas, lecciones aprendidas.

### Servicios de dominio implementados
- `backend/src/services/domain/price-resolver.service.js`
- `backend/src/services/domain/intent-detector.service.js`
- `backend/src/services/domain/medical-auto-capture.service.js`
- `backend/src/services/domain/commission.service.js`

---

## 9. Conclusión

Este documento existe porque el objetivo no es desarrollar funcionalidades. El objetivo es construir, paso a paso, una Plataforma Operativa Inteligente que reduzca progresivamente el trabajo operativo de los negocios especializados en salud y bienestar animal.

La diferencia entre un producto que crece bien y uno que acumula deuda técnica hasta volverse inmanejable no está en la velocidad de construcción. Está en la claridad con la que se define qué se construye, en qué orden y por qué.

Cada fase de este plan tiene un nombre y un propósito porque cada fase resuelve un problema específico que habilita la siguiente. La Fase 1 estableció que el dominio es soberano. La Fase 2 completará ese dominio. La Fase 3 le dará inteligencia especializada. La Fase 4 lo hará comercialmente escalable. La Fase 5 lo convertirá en ecosistema.

Quien lea este documento dentro de diez años debería poder entender exactamente qué producto decidimos construir en 2026 y por qué. Que el negocio tiene prioridad sobre la tecnología. Que el dato pertenece al negocio. Que los canales son reemplazables. Que los empleados digitales trabajan para el dominio.

Esos principios no son preferencias de diseño. Son las reglas que harán que este producto sea defendible cuando el mercado cambie, los modelos de IA evolucionen y nuevos canales de comunicación aparezcan.

**El dominio permanecerá.**

---

*Plan Maestro v1.0 · Plataforma Operativa Inteligente · Mateos Pet · 2026*
