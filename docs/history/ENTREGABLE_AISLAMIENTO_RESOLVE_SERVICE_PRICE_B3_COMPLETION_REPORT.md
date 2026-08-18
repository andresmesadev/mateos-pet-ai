# Cierre del Entregable — Corrección del bypass de aislamiento en `resolve-service-price`/`change-service-price` (B3)

**Bloque:** Ecosistema (post-Fase 6) — décimo entregable, derivado de la Auditoría Integral v2 (`AUDITORIA_ECOSISTEMA_PORTAL_CLIENTE_MVP_V2.md`, hallazgo B3).
**Estado:** ✅ Completado — Macroetapas 1-4 completas. Versión oficial: `2.32.0`.
**Naturaleza del entregable:** endurecimiento arquitectónico preventivo — cierra un hueco de aislamiento tenant que hoy es inalcanzable en producción (cero/un único llamador ya protegido a nivel de ruta), pero que se activaría en el momento en que cualquier entregable futuro conecte estos casos de uso a un input controlado por el llamador.

---

## Objetivo del entregable

La deuda B3 se documentaba como "petId/clientId no acotados por tenant en `PrismaTargetExistenceReader`". La auditoría de Macroetapa 1 encontró que el hueco real era más amplio: ni `ServiceRepositoryPort.findById` ni ninguno de los dos casos de uso (`ResolveServicePriceUseCase`, `ChangeServicePriceUseCase`) recibían `tenantId` en absoluto.

## Diseño congelado (Macroetapa 1)

- **Hallazgo de severidad práctica:** `resolveServicePrice` tiene cero llamadores en producción; `changeServicePrice` tiene un único llamador (`PATCH /services/:id`) que ya verificaba ownership del `serviceId` por tenant *antes* de invocar el caso de uso, y nunca pasa `target.type` `"client"`/`"pet"`. El bypass era real en el código pero inexplotable por cualquier camino de producción existente — corrección preventiva, no respuesta a una explotación posible hoy.
- Mismo criterio canónico ya usado en `get-service-category.usecase.js`: `tenantId` opcional en ambos casos de uso, chequeo `!service || (tenantId && service.tenantId !== tenantId)`.
- `TargetExistenceReaderPort` extendido con `tenantId` opcional en sus 3 métodos; `Pet.tenantId`/`User.tenantId` ya existían en el schema — sin migración.
- Fuera de alcance, explícito: no se reincorpora `resolve-service-price` al catálogo público en este entregable.

## Checkpoint de contradicción (previo a Macroetapa 2)

`git status --short` limpio, coincidente con lo auditado. Sin contradicciones nuevas.

## Resumen de implementación (Macroetapa 2)

**Archivos modificados:**
- `resolve-service-price.usecase.js` / `change-service-price.usecase.js` — `tenantId` opcional en `execute()`, chequeo canónico sobre `service`, propagado a `targetExistenceReader`.
- `target-existence-reader.port.js` — firma de `clientExists`/`petExists`/`getPetAttributes` extendida.
- `prisma-target-existence.reader.js` — `findUnique`→`findFirst` con filtro `tenantId` opcional (sin migración).
- `services.routes.js` — `PATCH /services/:id` propaga el `tenantId` ya resuelto por la ruta a `changeServicePrice` (segunda capa de defensa; la ruta ya bloqueaba esto antes, sin cambio de comportamiento observable).

**Tests nuevos (7):** 3 en `resolve-service-price.usecase.test.js`, 3 en `change-service-price.usecase.test.js`, 1 en `dashboard-services-price-tenant-wiring.test.js` (nuevo). `fakes.js` extendido para soportar filtrado por tenant sin romper compatibilidad con los tests preexistentes.

## 1. Validación Técnica

- **Suite completa:** **104/104 suites · 681/681 tests** en verde (antes 103/103 · 674/674 — +1 suite, +7 tests, cero regresiones).
- `git diff --stat -- ../prisma/` vacío — sin cambios de schema, como correspondía.

## 2. Validación Funcional (grep exhaustivo)

- **`public-api.routes.js` sin ningún diff** — `resolve-service-price` sigue excluido del catálogo público; el alcance de este entregable no se amplió a reincorporarlo.
- **`changeServicePrice` sigue teniendo un único llamador en todo el repo** (`services.routes.js:156-161`) — confirmado por grep exhaustivo, ningún otro archivo lo invoca.
- **`clientExists`/`petExists`/`getPetAttributes` invocados exclusivamente desde los dos casos de uso ya auditados** — confirmado, ningún otro consumidor existe.
- **`tenantId` en `services.routes.js` proviene exclusivamente de `req.tenant.tenantId`** — confirmado por lectura de las 9 apariciones del identificador en el archivo, ninguna desde body/params/query.
- **`ServiceRepositoryPort.findById` y `PriceRuleRepositoryPort` sin ningún diff** — confirmado, el fix se aplicó en el nivel correcto (caso de uso + `TargetExistenceReaderPort`), no en estos dos puertos, como estaba diseñado.

## 3. Validación de Invariantes

- **`serviceId` de otro tenant → `ServiceNotFoundError`** cuando se provee `tenantId`, en ambos casos de uso — verificado por test.
- **`clientId`/`petId` de otro tenant tratados como inexistentes** cuando se provee `tenantId` — verificado: `changeServicePrice` responde `PriceRuleTargetNotFoundError`; `resolveServicePrice` cae al precio base (`getPetAttributes` retorna `null`), sin filtrar atributos de una mascota ajena.
- **Compatibilidad hacia atrás confirmada:** los 14 tests preexistentes (sin `tenantId`) siguen pasando sin ningún cambio de comportamiento — mismo criterio de `getServiceCategory`, donde la ausencia de `tenantId` significa "sin chequeo", no "rechazar".
- **Propagación real del `tenantId` de la ruta verificada por test de wiring:** `PATCH /services/:id` invoca `changeServicePrice` con el `tenantId` exacto de `req.tenant.tenantId`.

## 4. Validación Arquitectónica

- **Motor conversacional intacto** — `git diff --stat` vacío sobre los 5 archivos protegidos.
- **Mismo patrón canónico reutilizado, no inventado** — idéntico al de `get-service-category.usecase.js` (Disponibilidad Real de Horarios, Ecosistema).
- **Sin cambios de schema ni migraciones** — `Pet.tenantId`/`User.tenantId` ya existían.
- **Sin cambio de comportamiento observable** en el único camino de producción real (`PATCH /services/:id`), que ya estaba protegido a nivel de ruta — el fix es una segunda capa de defensa, no una corrección de un defecto observado.
- **Sin Reconciliación Arquitectónica.**

## Hallazgos encontrados durante la Macroetapa 3

Ninguno nuevo — la implementación coincide exactamente con el diseño congelado, y el análisis de severidad práctica hecho en Macroetapa 1 (bypass inexplotable hoy) se confirma sin cambios en esta validación.

## Alcance restante (fuera de este entregable)

`resolve-service-price` permanece excluido del catálogo público — su reincorporación, ahora que el bypass subyacente está corregido, sería una decisión de producto/alcance separada, no una consecuencia automática de este entregable. Deudas B1 (CORS), B2 (expiración de `ApiKey`), creación de `ApiKey` vía API, B4 (`serviceId`↔`Appointment`) y Alcance B de Trazabilidad permanecen sin cambio.

## Versionado

Versión declarada del proyecto actualizada de `2.31.0` a `2.32.0` — mismo criterio de "cambio funcional relevante" (`CLAUDE.md`): endurecimiento arquitectónico real sobre dos casos de uso del contexto Servicios, aunque su efecto observable en producción sea nulo hoy (bypass preventivo, no correctivo). Actualizado en los tres puntos que deben coincidir — `backend/package.json`, `health.service.js` (`APP_VERSION`), `health.controller.js` (fallback de error) — verificados consistentes entre sí antes de este cierre.

## Criterio de cierre cumplido

- ✅ Auditoría exhaustiva previa (Macroetapa 1), incluyendo el hallazgo de que el alcance real del bypass era mayor que lo documentado originalmente, y el análisis de severidad práctica (inexplotable hoy).
- ✅ Alcance implementado exactamente según lo congelado.
- ✅ Sin cambios de schema, migraciones, ni Reconciliación Arquitectónica.
- ✅ Motor conversacional sin cambios.
- ✅ Suite completa en verde (104/104 · 681/681).
- ✅ Macroetapa 4 (versionado a `2.32.0`, commit, tag, push) completada.
