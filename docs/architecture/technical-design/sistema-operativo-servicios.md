# Diseño Técnico — Sistema Operativo de Servicios

**Entregable:** 2.1 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado. Diseño congelado por `docs/decisions/001-congelamiento-diseno-entregable-2.1.md`; consumo adicional de Mascotas en Resolver Precio del Servicio aprobado por `docs/decisions/002-resolver-precio-consulta-atributos-mascota.md`. Ver cierre en `docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`.
**Implementa:** `docs/architecture/use-cases/sistema-operativo-servicios.md` (contrato funcional aprobado)
**Contexto de dominio:** `Servicios`

Este documento traduce el contrato funcional aprobado a una estructura técnica. No contiene código, ni endpoints, ni esquema de base de datos. Define cómo se va a construir, no qué se va a construir — eso ya fue decidido en el documento de casos de uso.

---

## 1. Capa de aplicación

Cada caso de uso del contrato funcional se implementa como **un servicio de aplicación independiente**: una unidad con una sola responsabilidad, que coordina el dominio y no contiene reglas de negocio propias — esas viven en la capa de dominio (sección 3).

| Caso de uso (nombre oficial) | Servicio de aplicación | Responsabilidad |
|---|---|---|
| Crear Servicio | `CreateServiceUseCase` | Administración |
| Actualizar Servicio | `UpdateServiceUseCase` | Administración |
| Desactivar Servicio | `DeactivateServiceUseCase` | Administración |
| Cambiar Precio | `ChangeServicePriceUseCase` | Operación |
| Resolver Precio del Servicio | `ResolveServicePriceUseCase` | Resolución |
| Consultar Servicios Disponibles | `ListAvailableServicesUseCase` | Consulta |

**Convención de nombres:** `<Verbo><Entidad>UseCase`, en inglés, consistente con la nomenclatura ya usada en el dominio existente (`price-resolver.service.js`, `commission.service.js`). El nombre oficial en español del contrato funcional es la fuente de verdad conceptual; el nombre técnico es su traducción literal, sin reinterpretarlo.

**Regla de diseño:** un servicio de aplicación nunca invoca a otro servicio de aplicación del mismo contexto. Si dos casos de uso comparten lógica, esa lógica se extrae a la capa de dominio (sección 3), no se llama un caso de uso desde otro. Esto evita que `ChangeServicePriceUseCase`, por ejemplo, termine orquestando reglas que no le pertenecen.

---

## 2. Contratos de entrada y salida

Cada servicio de aplicación recibe un objeto de entrada explícito (no parámetros sueltos) y devuelve un resultado explícito. Ningún caso de uso recibe ni devuelve un objeto de framework (`req`, `res`) ni un modelo de persistencia (`PrismaService`) — eso pertenece al adaptador, no a la aplicación.

### CreateServiceUseCase
- **Entrada:** `{ establishmentId, name, category, standardDuration, basePrice }`
- **Salida:** `{ service }` — el servicio creado, en su forma de dominio (no la fila de base de datos).
- **Errores de dominio posibles:**
  - `ServiceCategoryNotEnabledError` — la categoría no está habilitada por los módulos activos del establecimiento.
  - `DuplicateServiceNameError` — ya existe un servicio activo con ese nombre en esa categoría.
  - `InvalidServiceAttributesError` — precio o duración inválidos (nulos, negativos).

### UpdateServiceUseCase
- **Entrada:** `{ establishmentId, serviceId, name?, category?, standardDuration? }` (el precio no es un campo válido aquí — ver `ChangeServicePriceUseCase`)
- **Salida:** `{ service }` — el servicio actualizado.
- **Errores de dominio posibles:**
  - `ServiceNotFoundError`
  - `ServiceCategoryNotEnabledError` — si se intenta cambiar a una categoría no habilitada.
  - `InvalidServiceAttributesError`

### DeactivateServiceUseCase
- **Entrada:** `{ establishmentId, serviceId }`
- **Salida:** `{ service }` — el servicio con estado inactivo.
- **Errores de dominio posibles:**
  - `ServiceNotFoundError`
  - `ServiceAlreadyInactiveError`

### ChangeServicePriceUseCase
- **Entrada:** `{ establishmentId, serviceId, target, newPrice }`, donde `target` identifica si el cambio es sobre el precio base del catálogo o sobre una regla de precio específica (`{ type: "base" }`, `{ type: "breed", breedId }`, `{ type: "size", size }`, `{ type: "client", clientId }`, `{ type: "pet", petId }`).
- **Salida:** `{ service, appliedRule }` — el servicio con el precio o la regla actualizada, y la regla aplicada de forma explícita.
- **Errores de dominio posibles:**
  - `ServiceNotFoundError`
  - `InvalidPriceError` — valor nulo o negativo.
  - `PriceRuleTargetNotFoundError` — el cliente o la mascota referenciados en una regla acordada no existen.
  - `DuplicatePriceRuleError` — ya existe una regla de precio activa para el mismo servicio, tipo de destino y destino (ver invariante en `servicios-modelo-persistencia.md`, sección 6, y su doble protección en `servicios-esquema-fisico.md`, sección 3).

### ResolveServicePriceUseCase
- **Entrada:** `{ establishmentId, serviceId, petId?, clientId? }`
- **Salida:** `{ finalPrice, source, trace }` — precio resuelto, origen de la resolución (qué regla se aplicó) y traza completa de cada nivel evaluado, para trazabilidad.
- **Errores de dominio posibles:**
  - `ServiceNotFoundError`
  - `ServiceInactiveError` — no se resuelve precio sobre un servicio desactivado.

  No produce errores de validación de entrada más allá de estos: es una operación de lectura, no valida estructuras complejas de negocio.
- **Dependencia adicional aprobada por ADR:** consume `TargetExistenceReaderPort.getPetAttributes(petId)` para obtener la raza de la mascota y evaluar la regla de precio por raza — ver `docs/decisions/002-resolver-precio-consulta-atributos-mascota.md`.

### ListAvailableServicesUseCase
- **Entrada:** `{ establishmentId, category?, includeInactive? }`
- **Salida:** `{ services: [...] }` — lista de servicios que cumplen el filtro.
- **Errores de dominio posibles:** ninguno. Una consulta sin resultados retorna lista vacía, no un error.

---

## 3. Dependencias

**Servicios de dominio que consume el contexto `Servicios`:**
- Reglas de jerarquía de precio (extensión del `price-resolver.service.js` existente de Fase 1, ahora incorporando además de "precio acordado por mascota" los niveles de "precio acordado por cliente" y "precio por raza/tamaño" que el modelo de dominio exige y que hoy no están implementados — ver nota en la sección 6).
- Reglas de categorización y split (qué categoría aplica qué regla contable), configuradas en `Negocio`.

**Repositorios que necesita (puertos, sin implementación):**
- `ServiceRepository` — persistencia del catálogo de servicios (crear, actualizar, buscar por id, buscar por nombre+categoría, listar con filtros).
- `PriceRuleRepository` — persistencia de las reglas de precio (por raza, por tamaño, por cliente, por mascota), separado de `ServiceRepository` porque su ciclo de vida y sus consultas son distintos al del servicio mismo.
- `BusinessConfigReader` — lectura de módulos activos y reglas de categorización/split del establecimiento (no escritura: `Servicios` no modifica configuración de `Negocio`).

Los casos de uso reciben estos repositorios **inyectados**, nunca los instancian ni conocen su implementación (Prisma, SQL, archivo, lo que sea). Esto es lo que permite que un test invoque un caso de uso sin base de datos real.

**Qué NO debe conocer esta capa:**
- El cliente de Prisma directamente — solo los adaptadores de infraestructura lo conocen.
- `req` / `res` de Express, ni ningún concepto de HTTP.
- Las entidades `Cita`, `Cobro`, `Comisión` — `Servicios` no conoce `Agenda`, `Finanzas` ni `Staff` como dijimos en el contrato funcional. Si `ChangeServicePriceUseCase` necesita validar que un `clientId` o `petId` existen, lo hace a través de un puerto mínimo de verificación de existencia, no importando los repositorios completos de `Clientes` o `Mascotas`.
- Ningún Empleado Digital ni canal de comunicación.

---

## 4. Eventos de dominio

| Caso de uso | Evento que produce | Contextos que podrían consumirlo a futuro |
|---|---|---|
| Crear Servicio | `ServicioCreado` | `Agenda` (para ofrecerlo al agendar); `Automatizaciones` (Fase 3, fuera de alcance ahora) |
| Actualizar Servicio | `ServicioActualizado` | `Agenda` (ya documentado en el modelo de dominio: lo consume para conocer duración y precio vigente) |
| Desactivar Servicio | `ServicioDesactivado` | `Agenda` (para dejar de ofrecerlo en nuevas citas) |
| Cambiar Precio | `ServicioActualizado` (se reutiliza; el modelo de dominio no define un evento propio para cambios de precio — ver nota en sección 6) | `Agenda`, eventualmente `Finanzas` si en el futuro decide reaccionar a cambios de precio vigente |
| Resolver Precio del Servicio | Ninguno (lectura) | — |
| Consultar Servicios Disponibles | Ninguno (lectura) | — |

Los eventos se publican **después** de que el caso de uso confirma la persistencia exitosa, nunca antes. El mecanismo de publicación (bus en memoria, cola, lo que sea) es una decisión de infraestructura, no de aplicación — la capa de aplicación solo declara "este evento ocurrió", no cómo se distribuye.

---

## 5. Estructura de carpetas propuesta

El backend actual organiza el código en `src/services/` (flat) y `src/services/domain/` (servicios de dominio nacidos en Fase 1). Para la Fase 2 propongo introducir, junto a esa estructura existente — sin tocarla todavía —, una organización por contexto que exprese explícitamente la separación Dominio → Aplicación → Infraestructura:

```
backend/src/contexts/services/
  domain/
    rules/
      price-resolution.rules.js       # jerarquía completa: mascota > cliente > raza/tamaño > base
      service-category.rules.js       # qué categoría habilita qué split
    errors/
      service-not-found.error.js
      duplicate-service-name.error.js
      invalid-service-attributes.error.js
      invalid-price.error.js
      service-category-not-enabled.error.js
      service-already-inactive.error.js
      price-rule-target-not-found.error.js

  application/
    use-cases/
      create-service.usecase.js
      update-service.usecase.js
      deactivate-service.usecase.js
      change-service-price.usecase.js
      resolve-service-price.usecase.js
      list-available-services.usecase.js
    ports/
      service-repository.port.js      # contrato esperado, sin implementación
      price-rule-repository.port.js
      business-config-reader.port.js

  infrastructure/
    persistence/
      prisma-service.repository.js    # implementa service-repository.port
      prisma-price-rule.repository.js
    events/
      service-domain-events.publisher.js
```

**Por qué esta forma:**
- `domain/` no importa nada de `application/` ni de `infrastructure/`. Es la única regla no negociable de esta estructura.
- `application/` importa `domain/`, pero solo conoce `infrastructure/` a través de los `ports/` (interfaces), nunca de la implementación concreta.
- `infrastructure/` es lo único que conoce Prisma, y es lo único que se reemplazaría si el negocio cambiara de motor de base de datos.
- Esta estructura convive con `src/services/service.service.js` y `src/services/domain/price-resolver.service.js` existentes durante la transición; no se eliminan en este entregable. Su reemplazo o consolidación es una decisión posterior, fuera del alcance de 2.1.

---

## Principios Permanentes de la Arquitectura de Aplicación

Estos cuatro principios rigen la capa de aplicación de todo contexto del Sistema Operativo, no solo de `Servicios`. Se incorporan aquí porque nacieron al diseñar este entregable, pero aplican igual a los Entregables 2.2 (Staff) y 2.3 (Finanzas).

**1. Los casos de uso conocen capacidades del dominio, no mecanismos de persistencia.**
Un caso de uso depende de un puerto (`ServiceRepository`, `PriceRuleRepository`) expresado en el lenguaje del dominio — "buscar servicio por id", "guardar regla de precio" — nunca de cómo ese dato se guarda o se consulta. Prisma, SQL o cualquier motor de base de datos son detalles de `infrastructure/`, invisibles para `application/`.

**2. Los casos de uso se comunican con otros contextos mediante eventos de dominio, nunca mediante llamadas directas.**
`Servicios` nunca invoca un caso de uso de `Agenda`, `Staff` o `Finanzas`, ni es invocado directamente por ellos para coordinar lógica. La única forma en que un contexto se entera de lo que hizo otro es mediante los eventos que ese contexto publica (sección 4). Esto es lo que garantiza que los contextos sigan siendo independientes y que un canal nuevo no requiera reimplementar la coordinación entre ellos.

**3. El Price Resolver no cambia cuando aparecen nuevas reglas de precio; solo crecen las estrategias o fuentes de resolución que consulta.**
`ResolveServicePriceUseCase` y `price-resolution.rules.js` están diseñados como un mecanismo de evaluación de niveles de prioridad, no como una lista de casos particulares. Agregar un nuevo nivel de precio (por ejemplo, una futura regla por temporada) significa agregar una fuente de resolución más a la jerarquía, no modificar la lógica de quien la recorre. Esto es lo que vuelve sostenible la regla "el precio se resuelve en un único lugar": el lugar no necesita reescribirse cada vez que el negocio define una nueva forma de fijar precio.

**4. Los contratos de los casos de uso son estables y los adaptadores deben adaptarse a ellos, nunca al contrario.**
La forma de entrada y salida de cada caso de uso (sección 2) es la interfaz oficial del Sistema Operativo de Servicios. Un canal nuevo, un cambio de framework HTTP, o una nueva forma de invocar el sistema (un Empleado Digital, una API pública) se adaptan a esos contratos mediante su propio adaptador. El contrato no se modifica para conveniencia de un adaptador particular — si un contrato necesita cambiar, ese cambio se decide a nivel del contexto completo, no a nivel del canal que lo pidió.

---

## 6. Validación arquitectónica

**Contra el Plan Maestro**
La estructura respeta el orden de capas definido en la sección 3 ("Canales → Casos de Uso → Dominio → Empleados Digitales"): los casos de uso son agnósticos al canal (no conocen Express ni HTTP), y el dominio no depende de la aplicación ni de la infraestructura. El precio sigue resolviéndose en un único lugar: `ResolveServicePriceUseCase`, apoyado en `price-resolution.rules.js`, es la única vía de cálculo.

**Contra el Modelo de Dominio**
La estructura no introduce ninguna entidad o regla no descrita en `domain-model-v1.md`. Los límites de "qué contextos no debe conocer Servicios" (Agenda, Finanzas, Clientes/Mascotas directamente) se preservan mediante puertos mínimos de verificación, no mediante acoplamiento directo a esos contextos.

**Contra los Principios Permanentes**
- Principio 2 (dominio sobre tecnología): el dominio (`domain/`) no conoce Prisma ni ningún detalle técnico.
- Principio 4 (cada módulo funciona sin IA): ningún caso de uso depende de un Empleado Digital para ejecutarse.
- Principio 8 (canales reemplazables): los casos de uso no reciben ni devuelven conceptos de ningún canal específico.
- Principio 10 (la pregunta que filtra todo): cada caso de uso ya respondió esa pregunta en el contrato funcional aprobado; este diseño no agrega nada que no haya pasado ese filtro.

**Contra la separación Dominio → Aplicación → Adaptadores**
Se cumple en las tres direcciones: el dominio es importado, nunca importa; la aplicación coordina e inyecta dependencias por puerto, nunca instancia infraestructura; la infraestructura implementa puertos, nunca contiene reglas de negocio.

**Hallazgo abierto, a resolver en la implementación (no bloquea la aprobación del diseño)**
El modelo de dominio exige una jerarquía de precio de cuatro niveles (mascota > cliente > raza/tamaño > catálogo base), pero la implementación actual de Fase 1 (`price-resolver.service.js`) solo soporta tres niveles, y el nivel "precio acordado por mascota" en código real corresponde a `Pet.defaultGroomingPrice` — no existe todavía persistencia para "precio acordado por cliente" ni "precio por raza/tamaño". Esto no es un defecto del diseño: es trabajo de modelado de datos que corresponde a la fase de implementación de `ChangeServicePriceUseCase` y `PriceRuleRepository`, y debe quedar explícito antes de escribir el esquema de persistencia.

---

Pendiente de tu aprobación. Una vez aprobado, el siguiente paso sería diseñar el esquema de persistencia y los contratos de los puertos en detalle — todavía sin escribir código de implementación.
