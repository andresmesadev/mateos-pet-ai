# Esquema Físico — Sistema Operativo de Servicios

**Entregable:** 2.1 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado. Migración `backend/scripts/migrations/2.1-servicios-sistema-operativo.sql` aplicada y verificada contra la base real (ver `docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`).
**Implementa:** el modelo conceptual de persistencia, congelado en `docs/decisions/001-congelamiento-diseno-entregable-2.1.md`.

Este documento traduce el modelo conceptual a tipos concretos de Prisma. Es la última etapa de diseño antes de la implementación (Etapa 5 de `docs/PHASE_2_EXECUTION_RULE.md`). El código aquí es una propuesta para revisión — recién se escribe en `prisma/schema.prisma` y se migra después de tu aprobación.

---

## 0. Decisiones de mapeo (conceptual → físico)

Antes de los modelos, dejo explícitas las decisiones de traducción, porque ninguna es automática:

1. **`establecimientoId` → `tenantId`.** El esquema físico actual ya usa `Tenant` como la implementación de la entidad `Establecimiento` del Modelo de Dominio. No se introduce un concepto nuevo; se reutiliza el existente.
2. **`estado` (activo/inactivo) → `Boolean active`.** Un enumerado de dos valores se representa como booleano, consistente con el `Service.active` que ya existe en el esquema actual. No se introduce un tipo enumerado de Prisma para esto.
3. **`tipoDeDestino` → `String targetType` con valores documentados en comentario**, replicando la convención ya usada en `Service.category` (`"veterinary" | "grooming" | "other"`), en lugar de un `enum` nativo de Prisma. Se mantiene consistencia con el resto del esquema existente.
4. **`Servicio.category` (String, actual) se reemplaza por `categoryId` (relación a `ServiceCategory`).** Esto es el único cambio que toca una tabla existente. Es necesario: sin esto, `ServiceCategory` no puede existir como entidad propia, que es justamente lo que el modelo conceptual exige (sección 2 del documento de persistencia).
5. **`duración estándar` → se mantiene el nombre de columna `duration` ya existente**, no se renombra a `standardDuration`. Renombrar una columna existente es un costo de migración sin beneficio de dominio — el nombre conceptual y el nombre físico no necesitan ser idénticos mientras la documentación deje la correspondencia clara, como aquí.

---

## 1. Modelos propuestos

```prisma
model Service {
  id          String   @id @default(cuid())
  tenantId    String?
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])

  name        String
  categoryId  String
  category    ServiceCategory @relation(fields: [categoryId], references: [id])

  duration    Int       // minutos — corresponde a "duración estándar" del dominio
  basePrice   Decimal?  @db.Decimal(10, 2)

  requiresAppointment Boolean @default(true)
  active      Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  appointments Appointment[]
  priceRules   PriceRule[]

  @@index([tenantId, categoryId])
  @@index([tenantId, active])
}

model ServiceCategory {
  id        String   @id @default(cuid())
  tenantId  String?
  tenant    Tenant?  @relation(fields: [tenantId], references: [id])

  name      String
  appliesCommissionSplit Boolean @default(false)
  active    Boolean  @default(true)

  createdAt DateTime @default(now())

  services  Service[]

  @@unique([tenantId, name])
}

model PriceRule {
  id         String   @id @default(cuid())
  serviceId  String
  service    Service  @relation(fields: [serviceId], references: [id])

  targetType String   // "breed" | "size" | "client" | "pet"
  targetId   String   // id de raza/cliente/mascota, o valor literal si targetType = "size"

  price      Decimal  @db.Decimal(10, 2)
  active     Boolean  @default(true)

  createdAt  DateTime @default(now())

  @@index([serviceId, active])
}
```

Nota: `Service.category` (String) y su valor actual se retiran de este modelo porque se reemplazan por `categoryId`. El detalle de cómo migrar los datos existentes (mapear los strings `"veterinary"/"grooming"/"other"` ya guardados a filas reales de `ServiceCategory`) se resuelve en la sección 4 (Migraciones), no aquí.

---

## 2. Claves

**Claves primarias:** `id` en las tres entidades, `String @id @default(cuid())` — consistente con el resto del esquema, sin excepción.

**Claves foráneas:**
- `Service.tenantId → Tenant.id` (ya existente, nullable — se mantiene igual).
- `Service.categoryId → ServiceCategory.id` (nueva, **no nullable** — un servicio siempre tiene categoría; el modelo conceptual lo declara obligatorio).
- `ServiceCategory.tenantId → Tenant.id` (nueva, nullable — sigue el mismo patrón que `Service.tenantId`, por consistencia con el resto del esquema multi-tenant existente, aunque la multiempresa formal sea una capacidad de Fase 4).
- `PriceRule.serviceId → Service.id` (nueva, no nullable — invariante del modelo conceptual: "una Regla de Precio nunca puede existir sin un Servicio válido").

**Sin clave foránea hacia `Cliente` ni `Mascota`:** `PriceRule.targetId` almacena el identificador de un cliente o una mascota cuando `targetType` lo requiere, pero **no** se modela como clave foránea hacia las tablas `User` (Cliente) o `Pet` (Mascota). Esto es deliberado: una clave foránea real obligaría a `Servicios` a conocer la estructura de esas tablas, violando el límite "no debe conocer Clientes ni Mascotas directamente" ya documentado en el contrato funcional y en la arquitectura técnica. La validación de que el destino existe ocurre en la capa de aplicación (`ChangeServicePriceUseCase`, a través de un puerto de verificación), no en la base de datos.

---

## 3. Índices y restricciones

- `Service`: índice compuesto `(tenantId, categoryId)` — soporta el filtro más común de **Consultar Servicios Disponibles** (servicios de una categoría dentro de un establecimiento). Índice `(tenantId, active)` — soporta el filtro por defecto de esa misma consulta (solo activos).
- `ServiceCategory`: restricción única `(tenantId, name)` — aplica directamente el invariante "el nombre de una categoría debe ser único entre categorías del mismo establecimiento".
- `PriceRule`: índice `(serviceId, active)` — soporta la consulta que hace `ResolveServicePriceUseCase` al evaluar la jerarquía de precio para un servicio.

**Restricción pendiente de decisión — no resuelta por una unicidad simple de Prisma:**
El invariante "no pueden coexistir dos Reglas de Precio activas para el mismo (`servicioId`, `tipoDeDestino`, `destinoId`)" no puede expresarse como `@@unique([serviceId, targetType, targetId])` sin matices: esa restricción, tal cual, impediría además guardar el historial de una regla ya desactivada y crear una nueva para el mismo destino (porque Postgres no distingue "activa" de "inactiva" dentro de una unique constraint simple).

Hay dos caminos, y prefiero dejarlo explícito para tu decisión antes de migrar, en lugar de elegir en silencio:

- **(a) Índice único parcial** (`CREATE UNIQUE INDEX ... WHERE active = true`), que Prisma no expresa de forma declarativa en el `schema.prisma` pero puede agregarse como SQL manual dentro de la migración generada. Es la solución más correcta a nivel de base de datos: la garantía vive en el motor, no en la aplicación.
- **(b) Validación exclusivamente en la capa de aplicación** (`ChangeServicePriceUseCase` verifica antes de escribir), sin restricción física. Más simple de migrar, pero la garantía depende enteramente de que ningún otro camino de escritura la viole — lo cual hoy es cierto, porque el Aggregate Root es la única puerta de entrada (Principio 2 del modelo de persistencia), pero es una garantía de disciplina, no del motor de datos.

Mi recomendación es **(a)**, precisamente porque ya establecimos que el Aggregate Root es la única vía de modificación: un índice único parcial es la forma en que la base de datos refuerza esa misma regla, sin contradicción.

**Decisión:** se adoptan **ambos** niveles, no como alternativas sino como protección en capas:

1. `ChangeServicePriceUseCase` valida la ausencia de una regla activa para el mismo destino antes de persistir, y devuelve un error de dominio explícito (`DuplicatePriceRuleError`) al operador si existe conflicto.
2. El índice único parcial sobre `PriceRule` (sección 3) se incluye en la migración, como garantía de integridad a nivel de base de datos.

Esto deja de ser una decisión puntual de `PriceRule` — se formaliza como principio permanente del esquema físico (ver más abajo), aplicable a todo invariante crítico del dominio que se modele de aquí en adelante.

---

## 4. Migraciones

Plan de migración propuesto (sin ejecutar todavía):

1. Crear `ServiceCategory` y poblarla con una fila por cada valor distinto ya presente en `Service.category` (`"veterinary"`, `"grooming"`, `"other"`, y cualquier otro valor real encontrado en los datos), una por cada `tenantId` que ya tenga servicios usándolo.
2. Agregar `Service.categoryId` como columna nullable temporalmente.
3. Backfill: para cada `Service` existente, asignar el `categoryId` correspondiente a su `category` (String) actual, según la fila creada en el paso 1.
4. Una vez verificado que ningún `Service` quedó sin `categoryId`, volver la columna `categoryId` `NOT NULL` y eliminar la columna `category` (String).
5. Crear `PriceRule` desde cero — no requiere backfill: hoy no existe persistencia para reglas de precio por raza, tamaño o cliente. (El precio acordado por mascota, `Pet.defaultGroomingPrice`, permanece donde está; no se migra a `PriceRule` en este entregable — ver nota abajo).
6. Agregar el índice único parcial sobre `PriceRule` (decisión de la sección 3), si se confirma la opción (a).

**Nota importante de alcance:** este entregable no migra `Pet.defaultGroomingPrice` hacia `PriceRule`. Esa migración tocaría el contrato ya vigente de `price-resolver.service.js` (Fase 1), que está fuera del alcance del Entregable 2.1. `ResolveServicePriceUseCase` deberá, en su implementación, consultar ambas fuentes (la existente `Pet.defaultGroomingPrice` y la nueva `PriceRule`) hasta que una decisión arquitectónica explícita unifique ambas. Esto es information para la implementación, no un defecto del diseño: ya estaba anticipado como "hallazgo abierto" en el diseño técnico aprobado.

---

## 5. Validación final

**Contra el modelo conceptual de persistencia (congelado).** Las tres entidades, sus campos y sus relaciones corresponden uno a uno con lo aprobado en `servicios-modelo-persistencia.md`. No se agregó ni se omitió ningún campo.

**Contra los Principios Permanentes del modelo de persistencia.**
- *El dominio nunca se sustituye:* ningún tipo físico (`Decimal`, `Boolean`, `String`) reinterpreta una regla de negocio; son solo su representación de almacenamiento.
- *El Aggregate Root como único responsable:* no existe ninguna clave foránea ni índice que permita escribir `PriceRule` sin pasar por `Service`; toda fila de `PriceRule` requiere un `serviceId` válido.
- *Evolución por extensión:* agregar un nuevo `targetType` en el futuro no requiere alterar la tabla `PriceRule` — es un valor nuevo de un campo `String` ya existente.

**Contra los Principios Permanentes de la arquitectura de aplicación.** Ninguna clave foránea acopla `Servicios` a `Clientes`, `Mascotas`, `Agenda` o `Finanzas` — la única relación de dominio modelada físicamente es `PriceRule → Service`.

**Contra el Plan Maestro y el Modelo de Dominio.** El cambio a una tabla existente (`Service.category` → `Service.categoryId`) es la única alteración a algo ya construido en Fase 1, y es estrictamente necesaria para que `Categoría de Servicio` exista como la entidad propia que el Modelo de Dominio exige — no es un cambio cosmético.

---

## Principio Permanente del Esquema Físico

Este principio rige el esquema físico de toda la Plataforma Operativa Inteligente, no solo del contexto `Servicios`. Se incorpora aquí porque nació al resolver el invariante de `PriceRule`, pero aplica a todo invariante crítico del dominio que se modele de aquí en adelante.

**Todo invariante crítico del dominio se protege en dos niveles, nunca en uno solo.**
La capa de aplicación detecta la violación antes de persistir y comunica un error de dominio explícito y legible — esa es la experiencia correcta para el operador o el canal que invocó el caso de uso. La base de datos, además, garantiza mediante una restricción física (índice único, `CHECK`, clave foránea) que el dato nunca pueda quedar en un estado inválido, sin importar si la violación llegó por un error de implementación, una condición de concurrencia, o un futuro canal de escritura que no pasó por la validación esperada.

Ninguno de los dos niveles sustituye al otro:
- Solo la aplicación, sin restricción física, es una garantía de disciplina — válida hasta que algo (un bug, una migración futura, otro desarrollador) la rompa sin que la base de datos lo impida.
- Solo la base de datos, sin validación en la aplicación, es una garantía silenciosa — el operador recibe un error de motor de datos, no un error de dominio que pueda entender y corregir.

La doble protección es la combinación que sostiene ambas necesidades a la vez: comunicación clara hacia quien usa el sistema, e integridad innegociable del dato hacia el sistema mismo.

---

## Aprobación

Con la decisión anterior, el esquema físico del Entregable 2.1 queda **aprobado**. Las cinco etapas de diseño previas a la implementación (`docs/PHASE_2_EXECUTION_RULE.md`) están completas para este entregable. El siguiente paso es la implementación: escribir el cambio real en `prisma/schema.prisma`, generar y aplicar la migración (incluyendo el índice único parcial vía SQL manual en la migración generada), y construir la capa de dominio, aplicación e infraestructura ya diseñadas.
