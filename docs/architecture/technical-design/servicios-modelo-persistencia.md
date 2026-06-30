# Modelo Conceptual de Persistencia — Sistema Operativo de Servicios

**Entregable:** 2.1 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado. Diseño congelado por `docs/decisions/001-congelamiento-diseno-entregable-2.1.md`. Ver cierre en `docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`.
**Implementa:** el contrato funcional y la arquitectura técnica ya aprobados para el contexto `Servicios`.

Este documento describe qué necesita persistir el dominio, no cómo se va a guardar. El objetivo es que cualquier desarrollador pueda diseñar después el esquema físico (Prisma, migraciones) sin tener que volver a discutir qué representa cada dato o por qué existe.

---

## 1. Entidades persistentes

El contexto `Servicios` necesita persistir tres conceptos del dominio, ni uno más:

1. **Servicio** — la prestación que ofrece el establecimiento.
2. **Categoría de Servicio** — la clasificación que determina la regla contable aplicable.
3. **Regla de Precio** — una excepción de precio sobre un servicio, atada a un destino específico (una raza, un tamaño, un cliente o una mascota).

No se modela aquí ninguna entidad de `Agenda`, `Staff`, `Finanzas`, `Clientes` ni `Mascotas`. Cuando una Regla de Precio necesita referenciar a un cliente o una mascota, lo hace por identificador, nunca incorporando su estructura.

---

## 2. Responsabilidad de cada entidad

### Servicio
Representa una prestación concreta que el establecimiento puede vender: qué es, cuánto dura por defecto y cuánto cuesta por defecto. Existe porque sin él no hay catálogo — es la oferta misma del negocio. Resuelve el problema de que la oferta del negocio esté dispersa en la cabeza del operador o en una hoja externa.

### Categoría de Servicio
Representa la clasificación contable de un servicio: determina qué regla de split de comisión le corresponde (definida en `Negocio`). Existe porque el sistema necesita saber, sin ambigüedad, qué reglas financieras aplican a cada servicio sin que esa decisión se tome caso por caso. Resuelve el problema de que el split de comisión se decidiera manualmente cada vez que se prestaba un servicio.

### Regla de Precio
Representa una excepción de precio: una situación en la que el precio base del catálogo no aplica porque existe un acuerdo o una condición más específica (la raza, el tamaño de la mascota, un acuerdo con un cliente, o un acuerdo con una mascota puntual). Existe porque el negocio real no cobra siempre el precio de lista — y esa realidad necesita un lugar explícito donde vivir, en vez de quedar en la memoria del operador o resuelta de forma inconsistente cada vez.

---

## 3. Campos

### Servicio

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `establecimientoId` | Identificador (referencia a Negocio) | Sí | El servicio pertenece exactamente a un establecimiento. |
| `nombre` | Texto | Sí | Único entre servicios activos de la misma categoría y el mismo establecimiento. |
| `categoríaId` | Identificador (referencia a Categoría de Servicio) | Sí | Determina la regla de split aplicable. |
| `duraciónEstándar` | Numérico (minutos) | Sí | Debe ser mayor a cero. |
| `precioBase` | Decimal | Sí | Nunca puede ser negativo. |
| `estado` | Enumerado (`activo` \| `inactivo`) | Sí | Nace siempre `activo`; nunca se elimina, solo se desactiva. |
| `creadoEn` | Fecha | Sí | Metadato de auditoría temporal. |
| `actualizadoEn` | Fecha | Sí | Metadato de auditoría temporal. |

### Categoría de Servicio

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `establecimientoId` | Identificador (referencia a Negocio) | Sí | Cada establecimiento define sus propias categorías, aunque coincidan en nombre con las de otro. |
| `nombre` | Texto | Sí | Único entre categorías del mismo establecimiento. |
| `aplicaSplitDeComisión` | Booleano | Sí | Si es verdadero, debe existir una regla de split configurada en `Negocio` para esta categoría. |
| `estado` | Enumerado (`activo` \| `inactivo`) | Sí | Una categoría con servicios activos asociados no se elimina, solo se desactiva hacia nuevos servicios. |

### Regla de Precio

| Campo | Tipo conceptual | Obligatorio | Regla de negocio asociada |
|---|---|---|---|
| `id` | Identificador | Sí | — |
| `servicioId` | Identificador (referencia a Servicio) | Sí | Toda regla de precio pertenece exactamente a un servicio; no existen reglas de precio genéricas. |
| `tipoDeDestino` | Enumerado (`raza` \| `tamaño` \| `cliente` \| `mascota`) | Sí | Determina qué representa `destinoId` y en qué nivel de la jerarquía se evalúa. |
| `destinoId` | Identificador o valor (según `tipoDeDestino`: id de raza, id de cliente, id de mascota, o el valor literal de tamaño) | Sí | Debe corresponder a un destino existente al momento de crear la regla. |
| `precio` | Decimal | Sí | Nunca puede ser negativo. |
| `estado` | Enumerado (`activo` \| `inactivo`) | Sí | Permite desactivar un acuerdo de precio sin perder el historial de que existió. |
| `creadoEn` | Fecha | Sí | Metadato de auditoría temporal. |

---

## 4. Relaciones

**Categoría de Servicio (1) → Servicio (N) — uno a muchos.**
Una categoría agrupa muchos servicios; un servicio pertenece exactamente a una categoría. Se justifica porque la categoría determina una única regla contable aplicable — un servicio con dos categorías tendría dos reglas de split simultáneas, lo cual no tiene sentido de negocio.

**Servicio (1) → Regla de Precio (N) — uno a muchos.**
Un servicio puede tener muchas reglas de precio (una por raza, una por tamaño, una por cada cliente o mascota con acuerdo propio); cada regla de precio pertenece exactamente a un servicio. Se justifica porque un precio acordado siempre es relativo a una prestación específica — no existe, en el modelo de dominio, un acuerdo de precio que aplique "a todo lo que el cliente compre" (eso es conceptualmente una promoción o membresía, no una regla de precio — ver sección 7).

**No existen relaciones muchos a muchos en este modelo.**
Si en el futuro un mismo acuerdo de precio debiera aplicar a varios servicios a la vez, ese no es un caso de extender `Regla de Precio` a una relación muchos-a-muchos: es una entidad distinta (una campaña o promoción) que el Price Resolver consultará como una fuente adicional, sin alterar la forma de `Regla de Precio` (ver sección 7 y el Principio 3 de la arquitectura de aplicación).

**Relación con `Cliente` y `Mascota`:** `Regla de Precio` los referencia por identificador cuando `tipoDeDestino` es `cliente` o `mascota`, pero `Servicios` no posee ni gestiona esas entidades — son propiedad de los contextos `Clientes` y `Mascotas`. Esta es una referencia, no una relación de dominio que `Servicios` deba mantener consistente más allá de validar su existencia al crear la regla.

---

## 5. Agregados

**Aggregate Root: `Servicio`.**

Todo cambio sobre `Regla de Precio` ocurre exclusivamente a través del agregado `Servicio` — en la práctica, a través de `ChangeServicePriceUseCase`, el único caso de uso autorizado a crear, modificar o desactivar una regla de precio. `Regla de Precio` nunca se crea, modifica ni elimina de forma independiente fuera de ese agregado, porque su consistencia (que no haya dos reglas activas para el mismo destino, que siempre pertenezca a un servicio válido) solo puede garantizarse evaluándola en conjunto con el servicio al que pertenece.

**`Categoría de Servicio` es un agregado independiente, no parte del agregado `Servicio`.**
Una categoría es administrada por su cuenta (es compartida por muchos servicios, y modificar un servicio nunca debe poder alterar su categoría como efecto colateral). `Servicio` la referencia por identificador, pero no la contiene ni la gestiona.

---

## 6. Invariantes

Estas reglas nunca pueden romperse, sin excepción:

- El `precioBase` de un Servicio nunca puede ser negativo.
- El `precio` de una Regla de Precio nunca puede ser negativo.
- Un Servicio en estado `inactivo` nunca puede aparecer como resultado de **Consultar Servicios Disponibles**, salvo que se solicite explícitamente incluir inactivos.
- Una Regla de Precio nunca puede existir sin un Servicio válido al que pertenezca — no hay reglas de precio huérfanas.
- Una Regla de Precio nunca puede apuntar a un destino (`cliente`, `mascota`) que no existe al momento de su creación.
- No pueden coexistir dos Reglas de Precio activas para la misma combinación de (`servicioId`, `tipoDeDestino`, `destinoId`) — evita ambigüedad sobre cuál regla aplica.
- El `nombre` de un Servicio debe ser único entre los servicios activos de la misma categoría y el mismo establecimiento.
- Una Categoría de Servicio o un Servicio nunca se eliminan: solo se desactivan. El dominio no borra historia.

---

## 7. Preparación para evolución

El modelo ya soporta, sin modificarse, las extensiones de precio explícitamente exigidas por el Modelo de Dominio:

- **Precios por cliente, por mascota, por raza, por tamaño** — ya cubiertos por los valores existentes de `tipoDeDestino` en `Regla de Precio`. Agregar un nuevo destino de este tipo (si alguna vez aparece uno) significa agregar un valor al enumerado, no una tabla nueva ni un cambio estructural.

Lo que **no** se fuerza dentro de este modelo, porque tiene una forma de negocio distinta:

- **Campañas, membresías, promociones.** Estos conceptos no son "un destino con un precio fijo": tienen vigencia temporal, condiciones de activación, y con frecuencia aplican como porcentaje de descuento sobre varios servicios o varios clientes a la vez, no como un precio absoluto sobre uno solo. Forzarlos dentro de `Regla de Precio` rompería su invariante más simple (un destino, un precio). Se modelarán en su momento como entidades propias, nuevas, que el Price Resolver aprenderá a consultar como una fuente adicional de la jerarquía — exactamente lo que garantiza el Principio 3 de la arquitectura de aplicación: el resolver no cambia, solo crecen las fuentes que consulta.

Esto es deliberadamente el límite de la preparación para el futuro en este entregable: el modelo no anticipa campos ni tablas para campañas o membresías, porque hacerlo hoy sería sobreingeniería sobre conceptos que todavía no están definidos en el Modelo de Dominio oficial. Lo único que se garantiza es que agregarlos después no obligará a romper lo que se construye ahora.

---

## Principios Permanentes del Modelo de Persistencia

Estos tres principios rigen el modelo de persistencia de toda la Plataforma Operativa Inteligente, no solo del contexto `Servicios`. Se incorporan aquí porque nacieron al diseñar este entregable, pero aplican a todo modelo de persistencia que se diseñe de aquí en adelante.

**1. El modelo de persistencia representa al dominio, pero nunca lo sustituye.**
Las tablas, columnas y relaciones descritas en este documento son una proyección del dominio para fines de almacenamiento — no son el dominio. La fuente oficial de verdad sobre qué es un Servicio, una Categoría o una Regla de Precio sigue siendo `domain-model-v1.md`. Si en algún momento el esquema físico y el modelo de dominio entran en conflicto, el dominio gana y el esquema se corrige.

**2. El Aggregate Root es el único responsable de mantener la consistencia de sus entidades internas.**
Ningún contexto externo, caso de uso ajeno, ni acceso directo a infraestructura puede crear, modificar o eliminar una `Regla de Precio` sin pasar por el agregado `Servicio`. Esta regla ya gobernaba el diseño conceptual (sección 5); se formaliza aquí como principio permanente porque debe sobrevivir a cualquier entidad interna de cualquier agregado futuro (p. ej. dentro del Entregable 2.2, ninguna entidad externa podrá modificar directamente una Comisión sin pasar por el agregado al que pertenezca).

**3. El modelo debe evolucionar por extensión, no por ruptura.**
Las nuevas estrategias o fuentes de precio —y, en general, cualquier nueva variante de un concepto ya modelado— se incorporan agregando nuevas fuentes que el resolver correspondiente consulta, nunca modificando la forma ni el significado de las reglas ya existentes. Un cambio que requiera alterar una entidad existente para acomodar un caso nuevo es una señal de que ese caso necesita su propia entidad, no una extensión forzada de la actual.

---

## 8. Validación final

**Contra el Plan Maestro.** El modelo no introduce ninguna entidad de un canal ni de un Empleado Digital. El precio sigue resolviéndose en un único lugar: todas las fuentes de precio (`precioBase`, `Regla de Precio`) son insumos del Price Resolver, no decisiones tomadas en otro punto del sistema.

**Contra el Modelo de Dominio.** Las tres entidades modeladas (Servicio, Categoría de Servicio, Regla de Precio) son exactamente las que `domain-model-v1.md` describe para el contexto `Servicios` — ninguna entidad nueva, ninguna omitida. Los límites de qué contextos no debe conocer `Servicios` se preservan: `Cliente` y `Mascota` se referencian por identificador, nunca se incorporan.

**Contra el contrato funcional.** Cada campo de cada entidad existe porque algún caso de uso del contrato lo necesita (p. ej. `tipoDeDestino` y `destinoId` existen porque `ChangeServicePriceUseCase` y `ResolveServicePriceUseCase` los requieren explícitamente). No hay campos especulativos.

**Contra la arquitectura técnica.** El modelo es compatible con los puertos ya definidos: `ServiceRepository` opera sobre `Servicio`, `PriceRuleRepository` opera sobre `Regla de Precio`, y `BusinessConfigReader` sigue siendo la única vía para conocer las reglas de split — `Categoría de Servicio` no almacena el porcentaje de split, solo la bandera de si aplica, preservando que esa regla vive en `Negocio`.

**Contra los Principios Permanentes de la capa de aplicación.** El agregado `Servicio` es la única puerta de entrada para modificar `Regla de Precio` (Principio 4: contratos estables, un solo punto de cambio autorizado). La estructura de `Regla de Precio` está diseñada para que el Price Resolver crezca en fuentes, no en lógica (Principio 3).

---

Pendiente de tu aprobación. Una vez aprobado este modelo conceptual, el siguiente paso es el esquema físico: tipos de Prisma, índices, claves foráneas y migraciones.
