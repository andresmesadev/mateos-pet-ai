# Fase 4 — Informe de Cierre Oficial y Retrospectiva
## Plataforma Comercial · Plataforma Operativa Inteligente · Mateos Pet

**Fecha de cierre:** 2026-07-10
**Nombre de la fase:** Plataforma Comercial
**Estado:** ✅ Completada
**Alcance:** Entregables 4.1 (Saneamiento Tenant-Blind), 4.2 (Onboarding Autónomo), 4.3 (Configuración por Establecimiento), 4.4 (Facturación / Habilitación Comercial del SaaS) — la fase completa, no un entregable individual.

---

## 1. Objetivo de la Fase

### El problema que buscábamos resolver

Al cierre de la Fase 3, el sistema tenía un equipo de Empleados Digitales operando con auditoría completa sobre un único negocio. El primer negocio había sido, hasta entonces, el laboratorio del producto — pero la misma arquitectura estaba lista, en principio, para servir a otros establecimientos. El paso a multi-empresa no significaba agregar funcionalidades veterinarias nuevas: significaba exponer lo que ya existía de forma configurable y autónoma para cada nuevo cliente, sin que el equipo de desarrollo tuviera que intervenir manualmente en cada alta.

### Por qué era importante resolverlo ahora, y no antes

Antes de definir el alcance operativo de esta fase, se realizó una auditoría arquitectónica dedicada (documentada en el Gate Review de definición de Fase 4) que estableció una separación explícita, institucionalizada desde entonces: el objetivo estratégico de la fase (Plataforma Comercial) debía mantenerse deliberadamente separado de la deuda técnica acumulada en las Fases 2 y 3. Solo un ítem del backlog heredado —el saneamiento tenant-blind (A6, M4, B2, M1 de la Auditoría v2.1.0)— se promovió a entregable de esta fase, por tener dependencia arquitectónica demostrable con el objetivo comercial. Todo lo demás (Outbox, `AgentAutonomyLimit`, Dominio Clínico, `InventoryItem`, pertenencia de `Commission`) quedó fuera, por decisión explícita, no por descuido.

---

## 2. Entregables

### 4.1 — Saneamiento Tenant-Blind
**Resultado:** ✅ Completado (2026-07-09)

Único ítem de la deuda técnica acumulada promovido a esta fase, por ser precondición dura del objetivo comercial. `Appointment.availabilityBucket` + índice único parcial `(tenantId, availabilityBucket, date)` reemplazó la verificación de conflicto no atómica en la reserva de citas (A6) — reconciliado durante la implementación: la unidad real de reserva es el bucket de servicio compartido, no `staffId`, que el sistema no usa para disponibilidad. Las cinco funciones de consulta de `reminder.service.js` y `jobs/reminder.job.js` pasaron a exigir `tenantId` explícito (M4) — reconciliado para acotarse a los consumidores externos al motor conversacional; el consumo interno del motor quedó registrado como deuda pendiente, por el principio "no reescribir el motor" institucionalizado en 3.4. El contexto Recepcionista IA pasó a rechazar explícitamente un mensaje entrante cuyo tenant no resuelve o está inactivo (B2). `User.phone` pasó de unicidad global a `@@unique([tenantId, phone])` (M1), verificado seguro contra los datos reales antes de aplicarse. Es el entregable donde nacieron las dos primeras Reconciliaciones Arquitectónicas formales de la fase.

### 4.2 — Onboarding Autónomo
**Resultado:** ✅ Completado (2026-07-09)

Cerró la brecha encontrada en su propia auditoría: el registro de un tenant (`POST /api/onboarding/register`) creaba un `Tenant` sin sembrar ningún `DigitalEmployee`, dependiendo de un script manual para que quedara operativo — contradecía directamente el objetivo de "sin intervención del equipo de desarrollo". `tenant-provisioning.service.js` se convirtió en el único punto responsable del aprovisionamiento automático de `recepcionista` y `coordinador_agenda` por tenant, reutilizando exclusivamente el caso de uso público de Empleados Digitales; el script manual se refactorizó para consumir el mismo servicio, sin duplicar lógica. Decisión de arquitectura congelada en este entregable: `Tenant` no se reemplaza ni se renombra — el Contexto Negocio completo (`Establecimiento`, `Módulo`, `Configuración del Negocio`, Modelo de Dominio §1), identificado como deuda de implementación durante la auditoría, quedó diferido íntegramente al 4.3.

### 4.3 — Configuración por Establecimiento
**Resultado:** ✅ Completado (Alcance A, 2026-07-09) — Alcance B diferido por Reconciliación Arquitectónica

Su auditoría encontró dos `BusinessConfigReaderPort` casi idénticos (`services`, `staff`), ambos con implementación hardcodeada sin distinción de tenant, y un campo `Tenant.businessHours` persistido pero nunca consultado por ningún servicio de disponibilidad. `business-config.service.js` se convirtió en la única fuente de verdad para módulos activos y tasa de split de comisión, persistidos en `Tenant` de forma aditiva; ambos `PrismaBusinessConfigReader` delegan en él sin cambiar ningún puerto ni caso de uso. La **Reconciliación Arquitectónica del Alcance B** (horarios de atención, zona horaria) es el hito más importante de este entregable: su aplicación real en el flujo de reserva por WhatsApp exigiría modificar `scheduling.service.js`/`availability.service.js`, violando el principio institucionalizado desde 3.4 — se decidió, de forma explícita y documentada, no cruzar esa línea. Queda como deuda diferida, misma categoría que el residuo de M4 dejado por 4.1.

### 4.4 — Facturación / Habilitación Comercial del SaaS
**Resultado:** ✅ Completado (2026-07-10)

Cierra el roadmap interno de la fase. Su auditoría encontró tres hallazgos críticos: `cancelSubscription()` era código muerto mientras la interfaz prometía cancelación sin ningún respaldo funcional; cambiar entre dos planes pagos reutilizaba el flujo de Checkout, creando una segunda suscripción en Stripe en vez de modificar la existente; y `resolveTenant.js` —el middleware de toda la API del dashboard— nunca aplicaba ninguna suspensión comercial, a diferencia del canal de WhatsApp, que ya respetaba `Tenant.active` desde 4.1. Se conectó `cancelSubscription` a una ruta real con botón funcional en el dashboard; se corrigió el cambio de plan con `updateSubscriptionPrice` (Stripe Subscription Item Update, sin duplicar suscripciones); y se aplicó suspensión comercial real usando `Tenant.active` como única fuente de verdad, sin período de gracia ni dunning, unificando la política comercial entre el canal de WhatsApp y el dashboard/API.

---

## 3. Decisiones arquitectónicas más importantes

### Separación explícita entre objetivo estratégico y backlog de deuda técnica

La decisión más importante de la fase, tomada antes de escribir el primer entregable: el objetivo comercial (Plataforma Comercial) no se deja redefinir por la deuda técnica acumulada. Un ítem del backlog solo se promueve a entregable cuando tiene dependencia arquitectónica *demostrable* con el objetivo — no por oportunidad, ni por estar "ya identificado". Este criterio, congelado en el Gate Review de definición de la fase, evitó que la Fase 4 se convirtiera en una fase de limpieza técnica disfrazada de fase comercial.

### El principio "no reescribir el motor" sobrevivió su primera prueba de presión real

3.4 lo institucionalizó sin que nada lo pusiera realmente a prueba todavía. La Fase 4 sí lo puso a prueba, dos veces (4.1 con M4, 4.3 con el Alcance B completo), y en ambos casos el sistema eligió preservar el principio y diferir la funcionalidad, en vez de reabrir el motor. Es, en retrospectiva, la validación más fuerte de que ese principio es correcto: dos entregables completamente distintos, con presión comercial real detrás, llegaron a la misma conclusión de forma independiente.

### Reconciliación del Modelo de Persistencia sobre evidencia de código, no sobre el diseño original

4.1 rediseñó la restricción anti-colisión de citas de `(tenantId, staffId, date)` a `(tenantId, availabilityBucket, date)` al descubrir, durante la implementación, que el sistema real jamás usó `staffId` para calcular disponibilidad. Es la misma disciplina que generó el ADR 005 en la Fase 2 (verificar contra el código real antes de persistir un diseño), aplicada once meses después con el mismo resultado: el diseño se ajusta a la evidencia, no al revés.

### Unificación de política comercial entre canales como criterio de cierre de fase

4.4 no se conformó con hacer funcionar la cancelación y el cambio de plan — verificó explícitamente que la misma regla de suspensión (`Tenant.active`) gobernara tanto el canal de WhatsApp (desde 4.1) como el dashboard/API (nuevo en 4.4). Esa coherencia entre canales, no solo la funcionalidad aislada, fue el criterio real de cierre del último entregable de la fase.

---

## 4. Evolución del proceso de ingeniería a lo largo de la fase

- **4.1** introdujo el patrón de **checkpoint obligatorio de contradicción** antes de cada Macroetapa 2: verificar explícitamente, contra el código real, si el diseño congelado choca con un principio ya institucionalizado, *antes* de escribir la primera línea — no durante, no después.
- **4.2** demostró que el patrón "extraer lógica duplicada a un servicio compartido, sin tocar los consumidores" (ya usado en Fase 2 y 3) también aplica a scripts operativos manuales, no solo a código de aplicación.
- **4.3** dejó el ejemplo más claro de todo el proyecto de una Reconciliación Arquitectónica *preventiva*: el Alcance B se identificó y se descartó en el mismo Gate Review, antes de cualquier intento de implementación — no como una corrección a mitad de camino, sino como una decisión de diseño tomada con toda la información disponible desde el principio.
- **4.4** cerró la fase con el mismo nivel de rigor que la abrió: el checkpoint de contradicción de la Macroetapa 2 confirmó, una vez más, que ninguno de los tres hallazgos de esta auditoría tocaba el motor conversacional — permitiendo implementar sin reservas.

Las cuatro macroetapas institucionalizadas desde la Fase 3 (Auditoría → Diseño Etapas 1-5 + Gate Review → Implementación → Validación y Documentación → Cierre Oficial) se mantuvieron sin cambios de forma en los cuatro entregables — la fase no necesitó modificar el proceso, solo aplicarlo con disciplina creciente.

## 5. Reconciliaciones Arquitectónicas de la fase — panorama completo

- **4.1 / M4:** acotado a consumidores externos al motor conversacional; el consumo interno queda como deuda pendiente de un futuro rediseño del motor.
- **4.1 / A6:** modelo de persistencia rediseñado de `staffId` a `availabilityBucket`, sobre evidencia de código, no sobre el diseño original.
- **4.3 / Alcance B completo:** horarios de atención y zona horaria por establecimiento, deliberadamente no implementados — exigirían modificar el motor conversacional. Es la Reconciliación Arquitectónica de mayor alcance de toda la fase: no se acotó una parte del entregable, se dejó fuera un alcance completo.

Ninguna de las tres quedó oculta ni resuelta implícitamente: las tres están documentadas en su Gate Review y su Completion Report correspondiente, con la evidencia empírica que las motivó.

## 6. Decisiones Diferidas adicionales que la fase dejó abiertas

- **Backlog arquitectónico general heredado de Fases 2-3**, ninguno resuelto por decisión explícita (no por descuido): Outbox de Eventos, `AgentAutonomyLimit` sin consumidor, certificación de eventos propios de Empleados Digitales, Dominio Clínico, `InventoryItem`, pertenencia de `Commission`/`Settlement`.
- **`/api/billing/*` y `/api/onboarding/*` sin autenticación propia** (solo rate-limiting) — deuda A5 de la Auditoría v2.1.0, confirmada abierta al cierre de 4.4 sin que ningún entregable de esta fase la resolviera; se documentó explícitamente como modelo de confianza heredado, no como vulnerabilidad nueva introducida.
- **`Tenant.plan` no se sincroniza automáticamente** al cambiar de plan vía `/change-plan` — misma inconsistencia que el webhook de suscripción ya tenía desde antes de esta fase, no corregida por no estar en el alcance congelado de 4.4.

## 7. Qué mejoró respecto a la Fase 3

- **De andamiaje sin consumidor a andamiaje con consumidor real, al menos en un canal.** La Fase 3 dejó `Tenant.active` como una señal calculada pero no aplicada fuera de WhatsApp. La Fase 4 la convirtió en la única fuente de verdad de suspensión comercial, aplicada de forma unificada en dos canales.
- **De Reconciliaciones Arquitectónicas reactivas a Reconciliaciones preventivas.** La Fase 2 (ADR 005) y la Fase 3 (implícitamente, en el origen del principio de 3.4) llegaron a sus reconciliaciones durante la implementación. La Fase 4, en 4.3, llegó a la suya *antes* de implementar, en el propio Gate Review — la disciplina de checkpoint obligatorio, introducida en 4.1, maduró exactamente para esto.
- **De separación de contextos a separación de fase-vs-backlog.** Ninguna fase anterior había necesitado declarar explícitamente que su identidad estratégica no era negociable frente a la deuda técnica acumulada — la Fase 4 lo hizo desde su propio Gate Review de definición, antes del primer entregable.

## 8. Qué no se resolvió, y queda como riesgo real para la fase siguiente

**El motor conversacional acumula ya dos Reconciliaciones Arquitectónicas sin resolverse — la probabilidad de una tercera no es baja.** Cualquier futura necesidad de personalizar el comportamiento conversacional por tenant (no solo horarios/zona horaria, sino idioma, tono, reglas de negocio propias de un establecimiento) se topará con la misma pared que 4.1 y 4.3 encontraron. La fase no resolvió esto — decidió, con evidencia y de forma explícita, no resolverlo todavía.

**El patrón "eventos log-only", heredado sin cambios de la Fase 3, no se tocó en ningún entregable de esta fase.** La Fase 4 tuvo la oportunidad de resolverlo (varios de sus entregables tocan contextos con publisher propio) y, correctamente según su propio criterio de alcance, no lo hizo por no tener dependencia arquitectónica demostrable con el objetivo comercial. Sigue siendo, tras el cierre de dos fases consecutivas sin tocarlo, el hallazgo más persistente de todo el proyecto.

**La seguridad de las superficies públicas de facturación/onboarding no mejoró.** Se agregaron dos endpoints nuevos y potencialmente más sensibles (`cancel`, `change-plan`) sobre el mismo modelo de confianza sin autenticación propia que ya existía desde antes de esta fase — una decisión consciente y documentada, pero que aumenta la superficie de exposición en vez de reducirla.

## 9. Métricas

| Métrica | Valor |
|---|---|
| Entregables completados | **4** (4.1 → 4.4) |
| Reconciliaciones Arquitectónicas formales | **3** (4.1 ×2, 4.3 ×1) |
| Bounded contexts nuevos | **0** (todo el trabajo fue aditivo sobre `Tenant` y sobre contextos existentes) |
| Modelos de schema modificados | **1** (`Tenant`, campos aditivos: `activeModules`, `commissionSplitRate`, `availabilityBucket` en `Appointment`) |
| Archivos del motor conversacional modificados en toda la fase | **0** |
| Archivos legacy corregidos directamente (fuera de cualquier motor protegido) | `appointment.service.js`, `reminder.service.js`, `user.service.js`, `resolveTenant.js`, `billing.routes.js`, `stripe.service.js` |
| Endpoints públicos sin autenticación propia al cierre | `/api/onboarding/*`, `/api/billing/*` (4 endpoints) |
| Ítems del backlog de deuda técnica promovidos a entregable | **1 de ~15** (saneamiento tenant-blind) |
| Documentos de cierre generados | 8 (4 Completion Reports + 4 Gate Reviews) |

## 10. Estado del producto al cierre de la Fase 4

Al cierre de esta fase, Mateos Pet puede: registrar un nuevo establecimiento de forma completamente autónoma, con sus dos Empleados Digitales base ya activos, sin que el equipo de desarrollo intervenga; operar múltiples tenants con aislamiento real de datos (citas, usuarios, recordatorios); dar de alta, cambiar y cancelar una suscripción de forma real, sin duplicar cargos en Stripe; y suspender el acceso operativo de un establecimiento que deja de pagar, de forma unificada entre WhatsApp y el dashboard. Lo que aún no puede: que un establecimiento en un huso horario distinto o con horarios de atención propios opere el flujo conversacional con esa configuración real — el motor sigue asumiendo un único horario y una única zona horaria para todos los tenants.

## 11. Qué habilita (y qué no habilita todavía) una fase futura

Con el saneamiento tenant-blind, el onboarding autónomo, la configuración básica por establecimiento y el ciclo de facturación completo, la plataforma tiene la base técnica para operar comercialmente más de un establecimiento real. No habilita, todavía, escalar esa operación a establecimientos con necesidades conversacionales realmente distintas entre sí (huso horario, horario, tono), ni a integraciones externas que dependan de eventos de dominio confiables más allá de `CitaCompletada`.

## 12. Recomendaciones que esta fase deja para la siguiente

1. Decidir explícitamente si el patrón "eventos log-only" se resuelve antes de construir cualquier capacidad que dependa de él (integraciones externas, API pública, o automatizaciones más allá de `CitaCompletada`) — dos fases consecutivas lo han dejado abierto por decisión, no por descuido; una tercera decisión consciente, en cualquier sentido, es preferible a que se resuelva por accidente bajo presión de un entregable que lo necesite.
2. Si una futura fase requiere personalizar el comportamiento conversacional por tenant, tratar esa necesidad como la señal de que el principio "no reescribir el motor" debe evolucionar deliberadamente (posible rediseño planeado del motor), no forzarlo por partes en sucesivas Reconciliaciones Arquitectónicas.
3. Aplicar `AgentAutonomyLimit` a al menos una acción real antes de que el sistema opere establecimientos con distintos niveles de riesgo aceptado — recomendación ya hecha al cierre de la Fase 3, reiterada sin cambios porque sigue sin resolverse.
4. Evaluar si las superficies públicas de facturación/onboarding necesitan autenticación propia antes de cualquier campaña de captación real, dado que esta fase añadió acciones más sensibles (cancelación, cambio de plan) sobre el mismo modelo de confianza histórico.

---

## 13. Conclusión

La Fase 4 de la Plataforma Operativa Inteligente de Mateos Pet queda oficialmente cerrada el 2026-07-10, completando el roadmap interno 4.1 → 4.4 en su totalidad.

Lo que se construyó no fue solo la capacidad técnica de tener más de un tenant: fue la disciplina de decidir, con evidencia y de forma explícita, qué parte de esa capacidad se construye ahora y cuál se difiere conscientemente. Las tres Reconciliaciones Arquitectónicas de esta fase no son fallas de diseño — son la prueba de que el principio "no reescribir el motor conversacional", nacido en la Fase 3 sin nada que lo pusiera a prueba, sobrevivió intacto su primera fase de presión comercial real.

La fase también deja, con la misma transparencia que ha caracterizado a todo el proyecto desde su origen, sus límites: un motor conversacional que aún no distingue establecimientos por horario o zona horaria, un patrón de eventos que sigue sin distribución real más allá de un único hecho de negocio, y una promesa de gobernanza de agentes que dos fases consecutivas han dejado sin cumplir.

**La plataforma puede, hoy, comercializarse a un segundo establecimiento real. No puede todavía comercializarse a uno que necesite operar de forma genuinamente distinta al primero.**

---

*Documento generado al cierre de la Fase 4 · Plataforma Operativa Inteligente · Mateos Pet · 2026*
