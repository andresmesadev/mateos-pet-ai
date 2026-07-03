# Modelo de Dominio — Plataforma Operativa Inteligente
**Versión:** 1.0  
**Fecha:** 2026-06-26  
**Estado:** Documento vivo — fuente oficial de verdad sobre las entidades del negocio

---

## Propósito de este documento

Este documento define el mapa conceptual del negocio que sustenta la Plataforma Operativa Inteligente. No es documentación técnica. No describe implementaciones, tablas ni servicios. Describe el negocio: sus entidades, sus responsabilidades, sus relaciones y sus límites.

Toda nueva funcionalidad, toda decisión arquitectónica y toda incorporación de un empleado digital debe validarse contra este modelo. Si una propuesta no encuentra su lugar aquí, el modelo debe actualizarse antes de que la funcionalidad se construya.

---

## Principios del Modelo

**1. El dominio del negocio es soberano.**  
La información del negocio pertenece al sistema operativo, no a los canales ni a los agentes de IA. Una cita existe en la Agenda independientemente de si llegó por WhatsApp, fue creada manualmente o la generó un agente.

**2. Los módulos son activables, no obligatorios.**  
Una peluquería canina y una clínica veterinaria comparten el Dominio Operativo. Solo la clínica activa el Dominio Clínico. El sistema no obliga a usar lo que el negocio no necesita.

**3. Los empleados digitales son consumidores del dominio, no sus dueños.**  
Los agentes de IA leen y escriben el dominio. No son la única forma de hacerlo. El sistema funciona completamente si los agentes están desactivados.

**4. Los canales no conocen el dominio directamente.**  
WhatsApp, Email, Dashboard y cualquier canal futuro se comunican con el dominio a través de sus interfaces definidas. Un canal no puede modificar el dominio sin pasar por sus reglas.

**5. El dato del negocio es el activo principal.**  
El historial clínico, las preferencias de grooming, la frecuencia de visitas, los precios acordados: ese dato acumulado es lo que hace valiosa la plataforma. Su integridad es innegociable.

---

## Separación de Dominios

La plataforma opera sobre dos dominios claramente separados:

### Dominio Operativo — Núcleo Universal

Presente en **todos** los tipos de negocio. No puede desactivarse.

Incluye: Negocio, Clientes, Mascotas, Agenda, Servicios, Staff, Finanzas, Automatizaciones.

Una peluquería canina opera completamente dentro de este dominio.

### Dominio Clínico — Módulo Opcional

Se activa únicamente cuando el negocio presta servicios veterinarios. Una peluquería no lo activa. Un centro veterinario sí.

Incluye: Historia Clínica, Vacunas, Tratamientos, Medicamentos, Diagnósticos, Prescripciones, Documentos Clínicos.

**Regla de diseño:** ninguna entidad del Dominio Operativo puede depender de una entidad del Dominio Clínico. La dependencia solo puede existir en la dirección contraria: el Dominio Clínico conoce al Dominio Operativo, pero no al revés.

---

## Bounded Contexts

---

### 1. Contexto: Negocio

**Objetivo**  
Representar la identidad y configuración del establecimiento que opera la plataforma. Es el contexto raíz del que dependen todos los demás.

**Entidades principales**

- **Establecimiento** — La entidad central. Tiene nombre, tipo (clínica veterinaria, centro veterinario, peluquería canina, peluquería felina), configuración regional (zona horaria, moneda, país) y módulos activos.
- **Módulo** — Una capacidad del sistema que el establecimiento puede activar o desactivar. Cada módulo activo habilita contextos adicionales.
- **Configuración del Negocio** — Los parámetros operativos del establecimiento: horarios de atención, días hábiles, duración estándar de los servicios, reglas de split de comisiones, mensajes de bienvenida.

**Responsabilidades**
- Definir qué tipo de negocio es el establecimiento
- Controlar qué módulos están activos
- Establecer las reglas operativas base que aplican a todos los contextos
- Ser la identidad bajo la cual operan todos los empleados digitales

**Eventos que produce**
- `NegocioConfigurado` — Cuando el establecimiento completa su configuración inicial
- `MóduloActivado` — Cuando se habilita un nuevo módulo
- `MóduloDesactivado` — Cuando se deshabilita un módulo
- `ConfiguraciónActualizada` — Cuando cambia algún parámetro operativo

**Eventos que consume**
- Ninguno. Es el contexto raíz.

**Contextos que conoce**
- Ninguno directamente. Todos los demás contextos lo conocen a él.

**Contextos que NO debe conocer**
- Todos. El Negocio no depende de ningún otro contexto del sistema.

---

### 2. Contexto: Clientes

**Objetivo**  
Gestionar la identidad y la relación del negocio con los propietarios de mascotas. Un Cliente es la persona que contrata los servicios del establecimiento.

**Entidades principales**

- **Cliente** — El propietario de una o más mascotas. Tiene identidad (nombre, teléfono principal, teléfono alternativo, email), dirección, canal de contacto preferido, y un historial de relación con el negocio.
- **Relación con el Negocio** — El vínculo entre el cliente y el establecimiento: fecha de primera visita, frecuencia histórica de visitas, estado de la relación (activo, en riesgo, inactivo, recuperado).
- **Nota del Cliente** — Observaciones internas del equipo sobre el cliente que no pertenecen al expediente de ninguna mascota en particular.

**Responsabilidades**
- Mantener la identidad única de cada propietario
- Registrar y actualizar el historial de la relación
- Detectar y señalar cambios en el patrón de visitas (entrada al riesgo de abandono)
- Ser la fuente de contacto para cualquier comunicación hacia el propietario

**Eventos que produce**
- `ClienteRegistrado` — Cuando se crea un nuevo propietario en el sistema
- `ClienteActualizado` — Cuando cambian los datos de contacto
- `ClienteEnRiesgo` — Cuando el patrón de visitas indica riesgo de abandono
- `ClienteInactivo` — Cuando supera el umbral de inactividad definido por el negocio
- `ClienteReactivado` — Cuando un cliente inactivo vuelve a tener actividad

**Eventos que consume**
- `CitaCompletada` (de Agenda) — Para actualizar la última visita y el patrón
- `TransacciónRegistrada` (de Finanzas) — Para mantener el historial financiero del cliente

**Contextos que conoce**
- Negocio — para aplicar las reglas de inactividad configuradas

**Contextos que NO debe conocer**
- Agenda — no gestiona citas directamente
- Finanzas — no gestiona transacciones directamente
- Dominio Clínico — el cliente no conoce los expedientes clínicos de sus mascotas desde este contexto

---

### 3. Contexto: Mascotas

**Objetivo**  
Gestionar la identidad y el perfil de cada animal que recibe servicios en el establecimiento. La Mascota es la entidad sobre la cual gira toda la operación del negocio.

**Entidades principales**

- **Mascota** — El animal. Tiene identidad (nombre, especie, raza, color, fecha de nacimiento, sexo, si está esterilizado), su propietario, y su estado actual en el sistema.
- **Perfil Operativo de la Mascota** — La información que el equipo necesita para prestar el servicio: precio acordado, observaciones de comportamiento, alertas importantes (agresivo, ansioso, condición especial), foto de referencia.
- **Perfil de Grooming** — Específico para peluquerías: tipo de corte preferido, largo acordado, productos que usa, reacciones a tratamientos previos, observaciones del peluquero. Se activa solo si el negocio presta servicios de grooming.

**Responsabilidades**
- Mantener la identidad única de cada animal
- Concentrar el conocimiento operativo sobre la mascota (precio, comportamiento, alertas)
- Ser el punto de enlace entre el propietario, los servicios recibidos y (si aplica) el expediente clínico

**Eventos que produce**
- `MascotaRegistrada` — Cuando se crea un nuevo perfil
- `PerfilActualizado` — Cuando cambia información del perfil (precio, observaciones)
- `AlertaActiva` — Cuando se registra una alerta importante sobre la mascota

**Eventos que consume**
- `ClienteRegistrado` (de Clientes) — Para vincular la mascota a su propietario

**Contextos que conoce**
- Clientes — una mascota pertenece a un cliente

**Contextos que NO debe conocer**
- Agenda — no gestiona sus propias citas
- Finanzas — no gestiona sus propios cobros
- Dominio Clínico — el perfil de la mascota es operativo, no clínico. El expediente clínico es un contexto separado que referencia a la mascota, no al revés.

---

### 4. Contexto: Agenda

**Objetivo**  
Gestionar el tiempo del establecimiento. La Agenda es el corazón de la operación diaria: define cuándo, con quién, para qué mascota y a qué precio se presta cada servicio.

**Entidades principales**

- **Cita** — El evento central. Tiene una fecha y hora, una mascota, un cliente, un servicio, un miembro del staff asignado, un estado (agendada, confirmada, en curso, completada, cancelada, no asistió), un precio, y el tipo de atención (en clínica o domicilio).
- **Disponibilidad** — La representación del tiempo disponible del establecimiento y del staff. Considera horarios de atención, excepciones (festivos, vacaciones), y la duración de los servicios.
- **Bloqueo** — Un período de tiempo no disponible: descanso, cierre especial, ausencia de personal.
- **Lista de Espera** — Clientes que quieren un servicio en un horario no disponible. Se activan automáticamente cuando surge disponibilidad.

**Responsabilidades**
- Mantener el estado real del calendario del negocio
- Calcular disponibilidad considerando staff, servicios y bloqueos
- Gestionar el ciclo de vida completo de una cita (desde agendada hasta completada o cancelada)
- Ser la fuente de verdad sobre qué pasará hoy, esta semana, este mes

**Eventos que produce**
- `CitaAgendada` — Cuando se crea una nueva cita
- `CitaConfirmada` — Cuando el cliente confirma asistencia
- `CitaIniciada` — Cuando el servicio comienza
- `CitaCompletada` — Cuando el servicio finaliza
- `CitaCancelada` — Cuando una cita se cancela (con razón)
- `CitaNoAsistió` — Cuando el cliente no llegó
- `DisponibilidadLiberada` — Cuando una cancelación libera un horario

**Eventos que consume**
- `ClienteRegistrado` (de Clientes) — Para poder agendar para ese cliente
- `MascotaRegistrada` (de Mascotas) — Para poder agendar para esa mascota
- `ServicioActualizado` (de Servicios) — Para conocer la duración y precio del servicio
- `MóduloActivado` (de Negocio) — Para ajustar las reglas de agendamiento

**Contextos que conoce**
- Clientes — para quién es la cita
- Mascotas — para qué animal es la cita
- Servicios — qué se va a prestar
- Staff — quién lo va a prestar
- Negocio — cuáles son las reglas del calendario

**Contextos que NO debe conocer**
- Finanzas — la Agenda no cobra. Notifica que un servicio fue completado; Finanzas registra la transacción.
- Dominio Clínico — la Agenda no sabe si una cita es clínica o de grooming a nivel de expediente.
- Empleados Digitales — la Agenda no sabe si quien agendó fue un humano o un agente.

---

### 5. Contexto: Servicios

**Objetivo**  
Definir el catálogo de lo que el establecimiento ofrece, a qué precio y bajo qué condiciones. Los Servicios son la oferta del negocio.

**Entidades principales**

- **Servicio** — Una prestación que ofrece el establecimiento. Tiene nombre, categoría (grooming, veterinaria, estética, otro), duración estándar, precio base, y si aplica split de comisión.
- **Regla de Precio** — Las variaciones del precio base según contexto: precio por raza, precio por tamaño, precio acordado con un cliente específico o con una mascota específica. El precio acordado por mascota tiene prioridad sobre todas las demás reglas.
- **Categoría de Servicio** — La clasificación que determina las reglas contables. "Grooming" aplica split 50/50. "Veterinaria" va 100% al negocio. Esta clasificación la define el establecimiento.

**Responsabilidades**
- Mantener el catálogo actualizado de servicios disponibles
- Resolver el precio correcto para una combinación de servicio + mascota + cliente
- Proveer la duración de cada servicio para el cálculo de disponibilidad en Agenda

**Eventos que produce**
- `ServicioCreado` — Cuando se agrega un nuevo servicio al catálogo
- `ServicioActualizado` — Cuando cambia precio o duración
- `ServicioDesactivado` — Cuando un servicio deja de ofrecerse

**Eventos que consume**
- `MóduloActivado` (de Negocio) — Para habilitar categorías de servicios según el tipo de negocio

**Contextos que conoce**
- Negocio — para las reglas de categorización y split

**Contextos que NO debe conocer**
- Agenda — no gestiona las citas de sus servicios
- Finanzas — no gestiona los cobros de sus servicios
- Clientes ni Mascotas directamente — las reglas de precio específicas por cliente/mascota se resuelven internamente cuando Agenda solicita el precio

---

### 6. Contexto: Staff

**Objetivo**  
Gestionar el equipo humano del establecimiento: quiénes son, qué hacen, cuándo están disponibles y qué generan en comisiones.

**Entidades principales**

- **Miembro del Staff** — Una persona que trabaja en el establecimiento. Tiene nombre, rol (veterinario, peluquero, recepcionista, administrador), horario de trabajo, y si genera comisiones.
- **Disponibilidad del Staff** — Cuándo está disponible para atender. Considera su horario base, ausencias programadas y ausencias imprevistas.
- **Comisión** — El registro de lo que genera un miembro del staff por cada servicio prestado. Se calcula automáticamente según las reglas del negocio cuando una cita es completada.
- **Liquidación** — El resumen de comisiones en un período determinado. Es la entidad que reemplaza el cálculo manual del split.
- **Capacidad del Staff** — Qué servicios está habilitado a prestar un miembro del staff. No todo peluquero presta todos los servicios de grooming, ni todo veterinario presta todos los servicios clínicos; esta entidad hace explícita esa relación en vez de asumirla. Es la base sobre la que se apoyarán capacidades futuras: asignación inteligente de citas, planificación de disponibilidad por capacidad, y la actuación de Empleados Digitales que necesiten saber a quién pueden asignar una tarea.

**Responsabilidades**
- Mantener el roster del equipo y su disponibilidad
- Registrar automáticamente las comisiones por cada servicio completado
- Generar liquidaciones por período sin intervención manual
- Proveer disponibilidad a Agenda para la asignación de citas
- Mantener qué servicios está habilitado a prestar cada miembro del staff

**Eventos que produce**
- `StaffRegistrado` — Cuando se incorpora un nuevo miembro
- `DisponibilidadActualizada` — Cuando cambia el horario o hay una ausencia
- `ComisiónRegistrada` — Cuando se calcula la comisión de un servicio completado
- `LiquidaciónGenerada` — Al cierre de un período
- `CapacidadAsignada` — Cuando se habilita a un miembro del staff para prestar un servicio
- `CapacidadRevocada` — Cuando deja de estar habilitado para prestarlo

**Eventos que consume**
- `CitaCompletada` (de Agenda) — Para registrar la comisión automáticamente

**Contextos que conoce**
- Negocio — para las reglas de comisión configuradas
- Servicios — para conocer la categoría del servicio y aplicar la regla correcta

**Contextos que NO debe conocer**
- Clientes ni Mascotas — el staff atiende, pero quién es el cliente o la mascota no es responsabilidad de este contexto
- Finanzas — el Staff registra comisiones, no transacciones con clientes. Finanzas consolida.

---

### 7. Contexto: Finanzas

**Objetivo**  
Registrar y consolidar todo el movimiento económico del negocio. Es el contexto que responde a la pregunta: ¿cuánto entró, cuánto salió y a quién le corresponde qué?

**Entidades principales**

- **Transacción** — Cada movimiento de dinero: un cobro por servicio, un gasto operativo, un ingreso adicional. Tiene monto, categoría, método de pago, quién la registró y si está vinculada a una cita.
- **Cobro** — La transacción específica del pago de un servicio. Vinculada a una cita completada. Tiene el monto total y el desglose de split si aplica.
- **Gasto** — Un egreso del negocio. Tiene categoría (insumos, nómina, servicios, otro) y un responsable.
- **Cierre del Día** — El resumen consolidado de un día: total de ingresos, total de egresos, desglose por categoría de servicio, desglose de comisiones por miembro del staff, neto del negocio.
- **Período Financiero** — Agrupación de cierres del día para reportes semanales o mensuales.

**Responsabilidades**
- Registrar todos los movimientos económicos del negocio
- Consolidar en el cierre el split de comisiones ya calculado por Staff — *corregido por el ADR 007 (Decisión 5): el split lo calcula el contexto Staff al registrar la Comisión (implementación real desde el Entregable 2.2); Finanzas consume `ComisiónRegistrada` para el desglose del cierre, no recalcula*
- Generar el cierre del día como acción explícita del operador — *precisado por el Entregable 2.3: el cierre es un comando de Administración, no una automatización*
- Proveer reportes financieros sin necesidad de exportar datos

**Eventos que produce**
- `TransacciónRegistrada` — Cuando se registra cualquier movimiento
- `CierreDíaGenerado` — Al final del día operativo
- `LiquidaciónPendiente` — Cuando hay comisiones sin liquidar

**Eventos que consume**
- `CitaCompletada` (de Agenda) — Para generar el cobro del servicio
- `ComisiónRegistrada` (de Staff) — Para incluirla en el cierre del día
- `ConfiguraciónActualizada` (de Negocio) — Para actualizar las reglas de split

**Contextos que conoce**
- Negocio — para las reglas de split y categorización financiera
- Staff — para consolidar comisiones en el cierre

**Contextos que NO debe conocer**
- Clientes ni Mascotas directamente — la transacción referencia a una cita, no al cliente
- Agenda directamente — escucha eventos, no llama a Agenda
- Dominio Clínico — los gastos clínicos son gastos operativos, no un concepto diferente

---

### 8. Contexto: Automatizaciones

**Objetivo**  
Definir las reglas que hacen que el sistema actúe solo, sin intervención humana, cuando ocurre algo en el dominio. Las Automatizaciones son la inteligencia reactiva del OS.

**Entidades principales**

- **Regla de Automatización** — La unidad fundamental. Tiene un disparador (qué evento del OS la activa), una condición (filtros que deben cumplirse), una acción (qué debe ocurrir) y un canal (por dónde se ejecuta la acción).
- **Disparador** — El evento del dominio que activa la regla. Ejemplos: "Cita agendada", "Mascota en riesgo de abandono", "Vacuna próxima a vencer", "Cierre del día generado".
- **Acción** — Lo que el sistema hace cuando se cumple la regla. Ejemplos: "Enviar recordatorio al cliente", "Notificar al staff", "Asignar tarea a un empleado digital", "Generar reporte".
- **Plantilla de Automatización** — Una combinación predefinida de disparador + condición + acción que el negocio puede activar sin configurarla desde cero.
- **Historial de Ejecuciones** — El registro de cada vez que una regla se ejecutó: cuándo, qué la disparó, qué acción tomó, si fue exitosa.

**Responsabilidades**
- Escuchar eventos del dominio y determinar si alguna regla aplica
- Ejecutar las acciones correspondientes a través del canal apropiado
- Registrar cada ejecución para auditoría
- Permitir que el negocio configure sus propias reglas sin programación

**Eventos que produce**
- `AcciónEjecutada` — Cuando una regla se activa y completa su acción
- `AcciónFallida` — Cuando la ejecución falla y requiere atención

**Eventos que consume**
- Prácticamente todos los eventos del dominio: `CitaAgendada`, `CitaCompletada`, `ClienteInactivo`, `CierreDíaGenerado`, etc.

**Contextos que conoce**
- Todos — es el contexto que conecta los eventos de todos los demás con las acciones
- Comunicación — para ejecutar las notificaciones correspondientes

**Contextos que NO debe conocer**
- La lógica interna de ningún contexto. Escucha eventos y ejecuta acciones. No modifica directamente entidades de otros contextos.

---

### 9. Contexto: Empleados Digitales

**Objetivo**  
Representar a los agentes de IA como entidades del sistema con responsabilidades, estado y auditoría. Los Empleados Digitales son trabajadores del OS, no el OS en sí mismo.

**Entidades principales**

- **Empleado Digital** — Un agente de IA con una especialización definida (Recepcionista, Coordinador de Agenda, Asistente Clínico, etc.), un estado (activo, pausado, en escalación), y un conjunto de responsabilidades delimitadas.
- **Tarea del Agente** — Lo que un empleado digital está ejecutando en un momento dado. Tiene origen (qué canal o evento la generó), estado (en proceso, completada, escalada), y resultado.
- **Decisión del Agente** — El registro de cada acción tomada por un empleado digital: qué input recibió, qué razonó, qué acción tomó. Permite auditar el comportamiento del agente.
- **Escalación** — Cuando un empleado digital no puede o no debe resolver algo solo, genera una escalación: una tarea asignada a un humano específico, con contexto completo. La escalación es una entidad del OS, no un estado de conversación.
- **Límite de Autonomía** — La configuración que define hasta dónde puede actuar un empleado digital sin confirmación humana. Ejemplo: puede agendar citas pero no puede cancelarlas sin aprobación.

**Responsabilidades**
- Ejecutar tareas específicas dentro de sus responsabilidades asignadas
- Leer y escribir el dominio a través de sus interfaces definidas
- Generar escalaciones cuando algo supera su autonomía
- Registrar cada decisión tomada para auditoría del equipo humano
- Nunca sustituir al humano en decisiones que superen su límite de autonomía

**Eventos que produce**
- `TareaCompletada` — Cuando un agente resuelve algo
- `EscalaciónGenerada` — Cuando algo supera su autonomía
- `DecisiónRegistrada` — Registro interno de cada acción (siempre)

**Eventos que consume**
- Eventos de todos los canales que lo activan
- Eventos del dominio cuando está en modo proactivo (Fase 4)

**Contextos que conoce**
- Todos los del Dominio Operativo — para poder leer y escribir el negocio
- Dominio Clínico — solo el Asistente Clínico IA
- Comunicación — para enviar respuestas por el canal apropiado

**Contextos que NO debe conocer**
- Automatizaciones — los empleados digitales son una de las posibles acciones que una automatización puede ejecutar, pero un empleado digital no gestiona automatizaciones.

---

### 10. Contexto: Comunicación

**Objetivo**  
Ser la capa de abstracción entre el dominio y los canales externos. Ningún otro contexto debe conocer cómo funciona WhatsApp, el email o cualquier otro canal. Solo Comunicación lo sabe.

**Entidades principales**

- **Canal** — Un medio de comunicación disponible: WhatsApp, Email, Dashboard (notificación interna), Portal del Cliente, SMS. Cada canal tiene sus capacidades (texto, audio, imagen, documentos) y sus restricciones.
- **Mensaje** — Una comunicación enviada o recibida. Tiene canal, origen (cliente, agente, sistema), destino, contenido, estado de entrega y marca de tiempo.
- **Conversación** — El hilo de mensajes entre el sistema y un cliente a través de un canal en un período de tiempo. Una conversación tiene un estado (activa, en espera de respuesta humana, cerrada) y puede estar asignada a un empleado digital o a un humano.
- **Notificación** — Un mensaje saliente generado por el sistema (no en respuesta a algo). Puede ser resultado de una automatización, de un empleado digital, o de una acción manual del equipo.
- **Plantilla de Mensaje** — Textos reutilizables con variables del dominio. "Hola {nombre}, te recordamos tu cita para {mascota} el {fecha} a las {hora}."

**Responsabilidades**
- Recibir mensajes entrantes de cualquier canal y enrutarlos al empleado digital o humano apropiado
- Enviar notificaciones y mensajes salientes por el canal correcto para cada cliente
- Mantener el historial de comunicaciones vinculado al cliente
- Aislar completamente la lógica de cada canal del resto del dominio

**Eventos que produce**
- `MensajeRecibido` — Cuando llega un mensaje de cualquier canal
- `MensajeEnviado` — Cuando el sistema envía una comunicación
- `ConversaciónEscalada` — Cuando una conversación pasa de un agente a un humano

**Eventos que consume**
- `AcciónEjecutada` (de Automatizaciones) — Para enviar la notificación correspondiente
- `TareaCompletada` (de Empleados Digitales) — Para enviar la respuesta al cliente
- `EscalaciónGenerada` (de Empleados Digitales) — Para notificar al humano responsable
- `CitaAgendada`, `CitaConfirmada`, etc. — Para las notificaciones automáticas de agenda

**Contextos que conoce**
- Clientes — para saber a quién pertenece cada mensaje
- Empleados Digitales — para enrutar mensajes entrantes al agente correcto

**Contextos que NO debe conocer**
- Agenda, Finanzas, Mascotas directamente — solo recibe instrucciones a través de eventos. No llama a esos contextos para generar sus propios mensajes.

---

### 11. Contexto: Operación Clínica *(Módulo Opcional — Dominio Clínico)*

**Objetivo**  
Gestionar el historial médico de cada animal. Se activa únicamente en establecimientos que prestan servicios veterinarios. Una peluquería canina nunca activa este contexto.

**Entidades principales**

- **Historia Clínica** — El expediente completo de una mascota. Agrupa todas las entidades clínicas bajo una identidad única vinculada a la mascota.
- **Consulta** — Un episodio clínico. Tiene fecha, motivo de consulta, hallazgos, diagnóstico, plan de tratamiento y las notas del veterinario. Es la unidad básica de la historia clínica.
- **Vacuna** — El registro de una vacuna aplicada o programada. Tiene tipo, fecha de aplicación, lote, próxima dosis y el veterinario que la aplicó.
- **Tratamiento** — Una intervención clínica en curso. Tiene duración, medicamentos asociados, instrucciones para el propietario y seguimiento.
- **Medicamento Prescrito** — Un medicamento indicado en una consulta. Tiene nombre, dosis, frecuencia, duración y si requiere receta oficial.
- **Prescripción** — El documento formal que agrupa los medicamentos indicados en una consulta. Puede ser impresa o digital.
- **Documento Clínico** — Cualquier documento relacionado con la historia: resultados de laboratorio, imágenes diagnósticas, certificados de vacunación, autorizaciones quirúrgicas.
- **Alerta Clínica** — Una condición activa que el equipo debe conocer antes de cualquier atención: alergia a medicamento, condición crónica, contraindicación.

**Responsabilidades**
- Mantener el historial médico completo y ordenado cronológicamente
- Generar alertas cuando hay condiciones activas relevantes para la próxima atención
- Producir documentos oficiales: certificados de vacunación, prescripciones
- Registrar todos los hallazgos clínicos con su autor y fecha

**Eventos que produce**
- `ConsultaRegistrada` — Cuando se completa una consulta clínica
- `VacunaAplicada` — Cuando se registra una vacuna
- `VacunaPróxima` — Cuando una vacuna programada está próxima a su fecha
- `AlertaClínicaActiva` — Cuando se registra una condición que requiere atención
- `TratamientoIniciado` / `TratamientoFinalizado`

**Eventos que consume**
- `CitaCompletada` (de Agenda) — Para abrir el registro de la consulta correspondiente
- `MascotaRegistrada` (de Mascotas) — Para crear la historia clínica de la nueva mascota

**Contextos que conoce**
- Mascotas — la historia clínica pertenece a una mascota específica
- Staff — el veterinario que registra la consulta
- Agenda — referencia la cita de la que proviene la consulta

**Contextos que NO debe conocer**
- Finanzas — un diagnóstico no conoce su precio
- Comunicación — la notificación al propietario la gestiona Comunicación, no Operación Clínica
- Empleados Digitales directamente — el Asistente Clínico IA lee la Historia Clínica, pero este contexto no lo invoca

---

### 12. Contexto: Eventos

**Añadido por el Entregable 3.0 (Fase 3, 2026-07-03).** Diseño completo, invariantes y decisiones diferidas en `docs/architecture/use-cases/infraestructura-de-eventos.md` y `docs/architecture/technical-design/infraestructura-de-eventos*.md`; cierre en `docs/history/ENTREGABLE_3_0_GATE_REVIEW.md`.

**Objetivo**
Dar identidad, inmutabilidad y trazabilidad de negocio al hecho de que "algo ocurrió en el dominio", para que cualquier contexto pueda reaccionar sin conocer la lógica interna de quien lo produjo, y para que esa reacción quede auditada.

**Entidades principales**
- **Evento de Dominio** — el hecho mismo. Inmutable desde su creación; válido por el solo hecho de haber ocurrido, sin depender de la existencia de consumidores.
- **Entrega de Evento** — certifica si un consumidor determinado recibió un Evento de Dominio y con qué resultado.
- **Tipo de Evento Catalogado** — el vocabulario oficial de disparadores posibles, global al sistema (no pertenece a ningún tenant).

**Responsabilidades**
- Certificar todo hecho de negocio producido por cualquier contexto como Evento de Dominio.
- Mantener el Catálogo de Eventos.
- Constatar, para cada consumidor legítimo, si el hecho fue puesto a su disposición.

**Eventos que produce**
- `EventoDeDominioRegistrado`, `EntregaFallida`

**Contextos que conoce**
- Ninguno en su lógica interna — solo el contrato tipo+payload de quien publica.

**Contextos que NO debe conocer**
- La lógica interna de ningún contexto productor ni consumidor. No decide qué debe pasar cuando ocurre un evento — eso es exclusivo de Automatizaciones (§8). No es Comunicación (§10): Eventos es comunicación interna entre contextos, nunca hacia canales externos.

---

## Mapa de Contextos

```
┌─────────────────────────────────────────────────────────────┐
│                         NEGOCIO                             │
│           (identidad, módulos, configuración)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ (todos los contextos lo conocen)
         ┌─────────────────┼──────────────────────┐
         │                 │                      │
┌────────▼──────┐  ┌───────▼───────┐  ┌──────────▼────────┐
│   CLIENTES    │  │   MASCOTAS    │  │    SERVICIOS       │
│  (propietarios│  │  (animales,   │  │  (catálogo,        │
│   y relación) │  │   perfiles)   │  │   precios)         │
└────────┬──────┘  └───────┬───────┘  └──────────┬─────────┘
         │                 │                      │
         └─────────────────▼──────────────────────┘
                           │
              ┌────────────▼────────────┐
              │          AGENDA         │
              │    (tiempo, citas,      │
              │     disponibilidad)     │
              └──────┬──────────┬───────┘
                     │          │
          ┌──────────▼──┐  ┌────▼──────────┐
          │    STAFF    │  │   FINANZAS    │
          │(equipo,     │  │(transacciones,│
          │ comisiones) │  │ cierres)      │
          └─────────────┘  └───────────────┘
                     │
    ┌────────────────▼────────────────────────┐
    │            AUTOMATIZACIONES             │
    │    (reglas: si X entonces Y por Z)      │
    └────────────────┬────────────────────────┘
                     │
         ┌───────────▼────────────┐
         │   EMPLEADOS DIGITALES  │
         │  (agentes, tareas,     │
         │   decisiones, escals.) │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │      COMUNICACIÓN      │
         │  (canales, mensajes,   │
         │   conversaciones)      │
         └────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 WhatsApp        Dashboard       Email / otros


── MÓDULO OPCIONAL (Dominio Clínico) ──────────────────────────

              ┌─────────────────────┐
              │  OPERACIÓN CLÍNICA  │
              │ (historia, vacunas, │
              │  diagnósticos, rx)  │
              └──────────┬──────────┘
                         │ (referencia a)
              ┌──────────▼──────────┐
              │       MASCOTAS      │
              └─────────────────────┘
```

---

## Lo que pertenece al negocio vs. a los agentes vs. a los canales

### Pertenece al negocio (el OS es el dueño)

- La identidad de cada cliente y mascota
- El historial de visitas y la relación con el negocio
- Las citas: quién, cuándo, para qué, a qué precio
- Los servicios prestados y sus precios
- Los registros financieros: cobros, gastos, cierres
- Las comisiones y liquidaciones del staff
- La historia clínica (si el módulo está activo)
- Las reglas de automatización configuradas
- El registro de decisiones de los empleados digitales

### Pertenece a los empleados digitales (el agente lo genera, el OS lo guarda)

- Las tareas que está ejecutando un agente
- Las decisiones tomadas y su razonamiento
- Las escalaciones generadas

### Pertenece únicamente al canal (no es dato del negocio)

- El session ID de una conversación de WhatsApp
- El estado de entrega de un mensaje (leído, enviado, fallido)
- El formato específico de un mensaje (texto enriquecido, botones, listas de WhatsApp)
- Las restricciones de formato de cada canal
- Los tokens de autenticación de cada API de canal

---

## Entidades que faltan en el sistema actual

Estas entidades son parte del modelo conceptual pero aún no existen como entidades del dominio en la plataforma:

**Dominio Operativo:**
- `AutomationRule` — Motor de reglas configurable
- `AgentTask` — Tarea del empleado digital como entidad
- `AgentDecision` — Auditoría de decisiones del agente
- `EscalationTicket` — Escalación como entidad del OS
- `Commission` — Comisión por servicio como entidad (hoy se calcula mentalmente)
- `DayClose` — Cierre del día como entidad generada automáticamente
- `InventoryItem` — Insumos y stock básico

**Dominio Clínico:**
- `ClinicalRecord` — Historia clínica como entidad raíz
- `Consultation` — Consulta veterinaria como entidad
- `Prescription` — Prescripción formal
- `ClinicalAlert` — Alerta activa sobre una mascota

---

## Versiones y Mantenimiento

Este documento es la fuente oficial de verdad sobre el modelo conceptual del negocio. Debe actualizarse antes de incorporar cualquier nueva entidad al sistema. Los cambios en este documento representan cambios en la arquitectura del producto, no solo en la implementación.

**Próxima revisión:** cuando se inicie la Fase 2 del Plan Maestro de Evolución.
