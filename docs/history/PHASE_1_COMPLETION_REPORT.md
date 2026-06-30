# Fase 1 — Informe de Cierre Oficial
## Plataforma Operativa Inteligente · Mateos Pet

**Fecha de cierre:** 27 de junio de 2026  
**Nombre de la fase:** Soberanía del Dominio  
**Estado:** ✅ Completada

---

## 1. Objetivo de la Fase

### El problema que buscábamos resolver

Antes de la Fase 1, Mateos Pet tenía un sistema funcional pero construido sobre una arquitectura frágil. La lógica de negocio vivía dispersa: parte en el agente de WhatsApp, parte en los endpoints del dashboard, parte en la interfaz. No existía una línea clara entre lo que el sistema *sabía del negocio* y lo que el sistema *hacía con un canal específico*.

Esto creaba tres problemas concretos:

1. **Fragilidad operacional.** Cambiar una regla de precios requería tocar múltiples archivos en múltiples capas. No había un lugar único donde vivieran las reglas del negocio.

2. **Deuda de canal.** El agente de WhatsApp (`conversation.service.js`) mezclaba detección de intenciones, lógica de dominio y formato de mensajes en 749 líneas. Cualquier futuro canal —Portal del Cliente, Email, App móvil— habría tenido que reimplementar esa lógica desde cero.

3. **Ausencia de visibilidad operativa.** Los operadores del negocio no podían ver el precio de cada cita en la agenda, no sabían si una cita no tenía precio configurado, no tenían un cierre de día con datos financieros reales.

### Por qué era importante resolverlo ahora

La decisión de hacer esta fase antes de agregar nuevas funcionalidades fue estratégica. Construir capacidades operativas sobre una arquitectura sin dominio claro habría significado multiplicar la deuda técnica por cada entregable futuro. La Fase 1 estableció los cimientos sobre los que toda la Plataforma Operativa Inteligente evolucionará.

El nombre elegido para esta fase —**Soberanía del Dominio**— describe exactamente lo que se buscaba: que el dominio del negocio sea la autoridad, y que los canales y las interfaces sean capas que lo expresan, no capas que lo contienen.

---

## 2. Entregables

### E1 — Corrección de datos: modelo de precio limpio
**Resultado:** ✅ Completado

Se renombró `Appointment.price` a `Appointment.finalPrice` para reflejar su semántica correcta: este campo almacena *solo* overrides manuales, no el precio efectivo. Se agregó `Pet.defaultGroomingPrice` al esquema. Se migraron 102 registros de precios que vivían en texto libre en `Pet.notes` hacia el nuevo campo estructurado, con un parser que manejó el formato colombiano de separadores de miles.

La semántica del campo cambió fundamentalmente: `Appointment.finalPrice` pasó de ser "el precio de la cita" a ser "el override manual del precio, si existe".

### E2 — Corrección de bugs de interfaz
**Resultado:** ✅ Completado

Se corrigieron dos bugs relacionados con el expediente de mascota:
- El nombre del propietario no aparecía al abrir el expediente desde la ficha del cliente.
- Los campos del perfil de mascota (raza, género, peso, etc.) aparecían vacíos.

La causa raíz fue que `clientPetToDashboardPet`, el adaptador entre el dominio del cliente y el modelo del dashboard, construía un objeto incompleto con todos los campos de perfil como `null`. La corrección expandió tanto la consulta de datos como el adaptador.

### E3 — Price Resolver: Servicio de Dominio de Precios
**Resultado:** ✅ Completado

Se creó `backend/src/services/domain/price-resolver.service.js`, la primera pieza de infraestructura de dominio de la Plataforma. Implementa la jerarquía oficial de precios:

1. Override manual del operador (`Appointment.finalPrice`) — máxima prioridad
2. Precio específico de la mascota (`Pet.defaultGroomingPrice`)
3. Precio base del catálogo (`Service.basePrice`)

El servicio no solo devuelve el precio final: devuelve una `PriceResolution` completa con `source`, `manualOverride`, `petDefaultPrice` y `serviceBasePrice`, habilitando trazabilidad total para auditorías y depuración.

Regla de evolución aprobada: todo el sistema de políticas de precios futuras (descuentos, membresías, promociones, impuestos) deberá vivir en este servicio. Ningún otro módulo implementará reglas de precios.

### E4 — Mapa de desacoplamiento de WhatsApp
**Resultado:** ✅ Completado

Antes de tocar código, se produjo un análisis completo de `conversation.service.js` que clasificó cada función en tres categorías: lógica de dominio, NLP/detección de intenciones, y protocolo del canal WhatsApp. El documento `docs/architecture/whatsapp-decoupling-map.md` se convirtió en el plano de construcción para el E5.

El hallazgo más importante: los handlers de operaciones (`handleCancellation`, `handleQueryAppointments`, etc.) ya tenían la lógica de dominio delegada a servicios existentes. Lo que quedaba en ellos era formato de respuesta WhatsApp —no lógica de negocio. Esto simplificó significativamente el plan de extracción.

Se estableció el criterio de prueba permanente para toda la arquitectura: **"¿Podría el Portal del Cliente llamar este servicio sin modificarlo?"** Si la respuesta es sí, pertenece al dominio. Si no, pertenece al adaptador del canal.

### E5 — Desacoplamiento de WhatsApp: extracción
**Resultado:** ✅ Completado

Se extrajeron dos servicios de dominio de `conversation.service.js`:

**`domain/intent-detector.service.js`** (154 líneas) — todos los patrones de intención, detectores y parsers NLP. Funciones puras sin estado ni side effects. 19 símbolos exportados.

**`domain/medical-auto-capture.service.js`** (56 líneas) — detección automática de información médica en texto libre y persistencia en el historial de la mascota. Contrato simplificado: el adaptador del canal decide *cuándo* invocar; el servicio de dominio decide *qué hacer* con el mensaje.

`conversation.service.js` pasó de 749 a 615 líneas. Sus 6 exports públicos permanecen idénticos; ningún consumidor externo requirió cambios.

El wizard de conversación (`buildRuleBasedReply`, ~260 líneas) permaneció en el adaptador. Es inherentemente protocolo del canal WhatsApp y allí debe vivir.

### E6 — Agenda Operativa
**Resultado:** ✅ Completado

La agenda de hoy dejó de ser una lista de citas para convertirse en una herramienta de gestión operativa. Se agregaron:

- **`DaySummary`**: franja al inicio del día con número de citas activas, ingreso esperado acumulado, y alerta de citas sin precio.
- **Precio con jerarquía visible**: el precio aparece en `text-foreground` destacado del texto secundario; citas con precio resuelto desde catálogo o mascota muestran la fuente en gris tenue.
- **"Sin precio →"**: enlace directo a la ficha de la mascota en `/dashboard/pets?pet=<petId>` para que el operador pueda configurar el precio sin salir del flujo.
- **"Sin asignar"**: alerta ámbar cuando una cita activa no tiene profesional asignado.

Regla arquitectónica aprobada durante esta revisión: **toda alerta visible en la agenda debe conducir directamente a una acción**. No existen alertas meramente informativas.

### E7 — Comisiones: registro contable inmutable
**Resultado:** ✅ Completado

Se creó el modelo `Commission` en el esquema y el servicio de dominio `domain/commission.service.js`. Cuando una cita de grooming se completa, se genera automáticamente un registro de comisión que captura:

- Snapshot del precio resuelto en el momento del cierre (`resolvedPrice`, `priceSource`)
- Split 50/50 calculado y persistido (`staffShare`, `businessShare`, `splitRate`)
- Referencia al profesional que realizó el servicio

El diseño es idempotente: si el endpoint PATCH se invoca dos veces con `status: completed`, la segunda llamada es un no-op. La comisión nunca se duplica.

Reglas del dominio financiero aprobadas: las comisiones son hechos contables inmutables. Correcciones futuras se realizan mediante anulación + nuevo registro, nunca modificando el registro original.

### E8 — Cierre del día
**Resultado:** ✅ Completado

Se creó el endpoint `GET /api/dashboard/daily-close` y el componente `DailyCloseSheet`. El botón "Cerrar día" vive en el header de la agenda y abre un panel bajo demanda.

El endpoint **lee exclusivamente registros de `Commission`** — nunca recalcula precios ni splits. `Commission` es la fuente oficial de verdad para toda la capa financiera. El panel muestra resumen de citas, ingresos totales, split negocio/staff, y desglose por profesional. Si existen citas de grooming completadas sin comisión registrada, el panel lo alerta explícitamente.

### E9 — Validación integral
**Resultado:** ✅ Completado

Validación por contrato de cada entregable. Ver sección 5 (Métricas).

---

## 3. Decisiones arquitectónicas más importantes

### Soberanía del Dominio

La decisión más importante de la fase. El dominio del negocio —sus reglas, sus entidades, sus invariantes— debe ser independiente de cualquier canal de comunicación, interfaz de usuario, o protocolo externo.

Los canales (WhatsApp, dashboard web) son capas que *expresan* el dominio. No lo contienen. Esta separación permite que el mismo dominio sea invocado por el Portal del Cliente, una API pública, o cualquier canal futuro sin modificar las reglas del negocio.

### Desacoplamiento gradual de WhatsApp

La estrategia elegida fue extracción incremental, nunca reescritura total. Cada extracción se verificó sin romper el flujo de WhatsApp antes de continuar. Esta disciplina garantizó cero regresiones en el canal principal durante toda la fase.

El wizard de conversación permanece en el adaptador: es correcto que así sea. No toda la lógica de un adaptador es mala —la orquestación específica del protocolo de conversación pertenece al canal. Lo que no pertenece allí es la lógica que podría necesitar cualquier otro canal.

### Servicio de Dominio de Precios como autoridad única

La jerarquía de precios no es un cálculo de conveniencia: es una política del negocio. Centralizarla en un único servicio con trazabilidad completa (`PriceResolution.source`) permite que auditorías, reportes, empleados digitales y cualquier futuro módulo financiero trabajen siempre con la misma autoridad.

La separación de responsabilidades es precisa: `Appointment.finalPrice` almacena *solo* overrides manuales. El precio efectivo se resuelve siempre en tiempo de presentación, nunca se persiste como derivado.

### Snapshot financiero de comisiones

La decisión de almacenar un snapshot inmutable del precio y el split en el momento del cierre —en lugar de recalcular— convierte las comisiones en evidencia contable. Cambios posteriores en precios del catálogo o de mascotas no afectan la historia financiera. Esta inmutabilidad es un principio permanente del dominio financiero de la plataforma.

### Cierre del día basado en hechos contables

El cierre del día no recalcula ni estima: lee hechos ya registrados. `Commission` es la única fuente de datos para cualquier cálculo financiero posterior. Esta arquitectura elimina la posibilidad de discrepancias entre "lo que se calculó al cerrar" y "lo que realmente ocurrió".

### Agenda Operativa como punto de decisión

La agenda dejó de ser una pantalla de consulta para convertirse en el punto central de acción del operador. Cada dato visible lleva a una acción posible. Cada alerta tiene un destino. Este principio se estableció como regla permanente de diseño de la plataforma.

---

## 4. Cambios respecto al plan original

### El contrato de `Appointment.finalPrice` evolucionó durante el E3

El plan original trataba `finalPrice` como "el precio de la cita". Durante la implementación del Price Resolver, se reconoció que este campo solo debería almacenar overrides manuales. El precio efectivo debería resolverse siempre en tiempo de presentación. Este cambio de semántica fue la decisión arquitectónica más profunda de la fase.

### `trySaveMedicalInfo` ganó un contrato más limpio en el E5

En el código original, `trySaveMedicalInfo` conocía los `BOOKING_STEPS` del wizard de WhatsApp —un acoplamiento incorrecto. Al extraerlo al dominio, se eliminó ese conocimiento: el adaptador de canal decide cuándo invocar el servicio; el dominio solo decide qué hacer con el mensaje. El contrato nuevo es más pequeño y más correcto.

### La revisión de UX del E6 generó una regla arquitectónica

No estaba en el plan original hacer una pausa de revisión de UX entre el E6 y el E7. Esa pausa produjo tres mejoras concretas (precio visible, "Sin asignar", "Sin precio →") y una regla de diseño permanente: toda alerta debe conducir a una acción. La pausa fue la decisión correcta.

### `prisma generate` como paso explícito post-schema

Durante la validación del E9 se descubrió que `prisma db push` no regenera automáticamente el cliente TypeScript. El modelo `Commission` existía en la base de datos pero `prisma.commission` no estaba disponible hasta ejecutar `prisma generate` explícitamente. Este hallazgo se convierte en parte del protocolo de cambios de schema para las fases siguientes.

---

## 5. Métricas

| Métrica | Valor |
|---|---|
| Tests en el suite | **143 passing** |
| Regresiones introducidas | **0** |
| Fallos pre-existentes (sin relación con Fase 1) | 1 (`booking-flow` — requiere credencial OpenAI al importar) |
| Servicios de dominio creados | **4** (`price-resolver`, `intent-detector`, `medical-auto-capture`, `commission`) |
| Líneas extraídas de `conversation.service.js` | **134** (749 → 615) |
| Exports públicos de `conversation.service.js` afectados | **0** (API pública intacta) |
| Modelos de schema agregados | **1** (`Commission`) |
| Campos de schema modificados | **2** (`Appointment.finalPrice`, `Pet.defaultGroomingPrice`) |
| Endpoints nuevos del dashboard | **1** (`GET /daily-close`) |
| Componentes frontend nuevos | **2** (`DailyCloseSheet`, `DaySummary`) |
| Documentos de arquitectura creados | **2** (`whatsapp-decoupling-map.md`, `PHASE_1_COMPLETION_REPORT.md`) |
| Decisiones arquitectónicas registradas en memoria | **5 decisiones + múltiples reglas de evolución** |

---

## 6. Lecciones aprendidas

### El mapa antes que el código

Producir el mapa de desacoplamiento (E4) antes de extraer código (E5) fue la decisión correcta. El análisis reveló que los handlers de dominio ya estaban parcialmente desacoplados —algo que no era obvio sin leer el archivo completo. El mapa evitó una extracción innecesariamente amplia.

### La semántica importa más que el nombre del campo

`Appointment.price` → `Appointment.finalPrice` parece un cambio cosmético. No lo es. El cambio de nombre forzó a clarificar qué significa ese campo: ¿es el precio efectivo? ¿es el override? Esa claridad fue el prerequisito de toda la arquitectura de precios de la fase.

### Las alertas sin acción generan frustración, no información

Descubierto durante la revisión del E6. Una alerta "Sin precio" que el operador no puede resolver desde donde la ve es un elemento de interfaz fallido. Este principio —toda alerta conduce a una acción— se generalizó como regla permanente de diseño.

### Los hechos contables no deben ser recalculados

La tentación inicial podría haber sido calcular las comisiones del cierre leyendo citas y aplicando el resolver. Elegir el snapshot inmutable fue más trabajo, pero garantiza que el historial financiero sea independiente de cualquier cambio futuro en el catálogo de precios. En cinco años, las comisiones del 27 de junio de 2026 seguirán siendo exactamente lo que fueron ese día.

### El cliente de Prisma no se regenera automáticamente

`prisma db push` sincroniza la base de datos pero no el cliente TypeScript. El paso `prisma generate` debe ejecutarse explícitamente después de cualquier cambio de schema. Este detalle operacional, descubierto en la validación, se convierte en protocolo obligatorio.

---

## 7. Estado del producto

Al cierre de la Fase 1, la Plataforma Operativa Inteligente de Mateos Pet puede:

**Gestionar precios con trazabilidad completa.** Cada cita muestra su precio efectivo con la fuente exacta de donde provino (override manual, precio de la mascota, o catálogo de servicios). El operador sabe en todo momento por qué un precio es lo que es.

**Alertar y orientar al operador desde la agenda.** Las citas sin precio tienen un enlace directo a la ficha de la mascota. Las citas sin profesional asignado se señalan visualmente. El operador no necesita buscar dónde resolver un problema: la agenda lo lleva allí.

**Ver el estado financiero del día en un solo gesto.** El botón "Cerrar día" muestra en segundos: cuántas citas se completaron, cuánto se facturó, cuánto corresponde al negocio y cuánto al staff, con desglose por profesional.

**Registrar comisiones como hechos contables inmutables.** Cada cita de grooming completada genera automáticamente un registro de comisión con snapshot del precio y split. Este registro es permanente e independiente de cambios futuros en precios.

**Mantener el agente de WhatsApp funcionando con dominio desacoplado.** El agente sigue operando exactamente igual que antes, pero la lógica de dominio que usa ahora vive en servicios agnósticos al canal, disponibles para cualquier punto de contacto futuro.

---

## 8. Qué habilita la Fase 2

La Fase 1 construyó los cimientos. La Fase 2 puede construir sobre ellos sin deuda.

**Portal del Cliente.** Los servicios de dominio creados en la Fase 1 son channel-agnostic por diseño. El Portal del Cliente puede invocar `intent-detector`, `price-resolver`, `commission` y `medical-auto-capture` sin modificarlos. El criterio de prueba permanente garantiza esto.

**Motor de precios avanzado.** `price-resolver.service.js` está preparado para recibir descuentos, membresías, paquetes, campañas, reglas de temporada e impuestos. Ningún otro módulo del sistema necesita cambiar cuando se agrega una nueva política de precios.

**Reportes financieros históricos.** `Commission` es el registro contable oficial. Un módulo de reportes puede consultar períodos históricos con total confianza en la inmutabilidad de los datos. Las comisiones de enero seguirán siendo las mismas en diciembre.

**Asignación de staff desde la agenda.** La alerta "Sin asignar" ya existe en la UI y señala el problema. El módulo de asignación de staff, cuando exista, tiene un punto de entrada natural en la agenda.

**Automatización del cierre de día.** La infraestructura del cierre existe. Cuando el motor de automatizaciones llegue en fases futuras, configurar un cierre automático es simplemente conectar el trigger —el cálculo ya está hecho correctamente.

**Expansión del modelo de comisiones.** La arquitectura soporta tasas de split diferentes por tipo de servicio, por profesional, o por política comercial. Agregar una regla de comisión para servicios veterinarios no requiere cambiar el modelo —solo agregar un caso en el dominio.

**Casos de uso y servicios de aplicación.** La Fase 1 estableció los servicios de dominio. La Fase 2 puede comenzar a construir la capa de aplicación: casos de uso que coordinen múltiples servicios de dominio, sin que ningún adaptador de canal tenga que orquestar directamente.

---

## 9. Conclusión

La Fase 1 de la Plataforma Operativa Inteligente de Mateos Pet queda oficialmente cerrada el 27 de junio de 2026.

Lo que se construyó en esta fase no es principalmente código. Es una arquitectura. Una forma de organizar el conocimiento del negocio que garantiza que ese conocimiento permanezca coherente, trazable y extensible a medida que el producto crece.

El dominio del negocio —sus precios, sus comisiones, sus intenciones, su historial médico— ahora vive en servicios propios, independientes de canales y tecnologías. Los canales saben del dominio. El dominio no sabe de los canales.

Esta separación, aparentemente técnica, tiene una consecuencia profunda para el negocio: las reglas de Mateos Pet ya no están atrapadas en el agente de WhatsApp, ni en el dashboard, ni en ningún endpoint particular. Están en el dominio. Y el dominio es portable, testeable, auditable y listo para cualquier forma futura que tome el producto.

**La Plataforma Operativa Inteligente tiene ahora una base sobre la cual construir.**

---

*Documento generado al cierre de la Fase 1 · Mateos Pet · 2026*
