# Gate Review consolidado — Corrección del bypass de aislamiento en `resolve-service-price`/`change-service-price` (B3)

**Bloque:** Ecosistema (post-Fase 6)
**Estado:** ✅ Completo — Macroetapas 1-4 completas. Cierre oficial realizado (v2.32.0).

---

## 1. Diseño congelado (Macroetapa 1)

- Origen: hallazgo B3 de `AUDITORIA_ECOSISTEMA_PORTAL_CLIENTE_MVP_V2.md`, ampliado durante la auditoría: el hueco no era solo de `PrismaTargetExistenceReader`, sino de la firma completa de ambos casos de uso (`ResolveServicePriceUseCase`, `ChangeServicePriceUseCase`), que nunca recibían `tenantId`.
- Análisis de severidad práctica: bypass inexplotable en producción hoy (`resolveServicePrice` sin llamadores; `changeServicePrice` con un único llamador ya protegido a nivel de ruta) — corrección preventiva.
- Diseño: `tenantId` opcional + chequeo canónico (mismo patrón de `get-service-category.usecase.js`) en ambos casos de uso; `TargetExistenceReaderPort` extendido; sin migración (`Pet.tenantId`/`User.tenantId` ya existían); `resolve-service-price` permanece excluido del catálogo público.

## 2. Checkpoint de contradicción (previo a Macroetapa 2)

Ninguno — estado del código verificado limpio e idéntico al auditado.

## 3. Implementación (Macroetapa 2)

8 archivos modificados: 2 casos de uso, 1 puerto, 1 implementación Prisma, 1 ruta de dashboard (propagación de `tenantId`), 3 archivos de test. 1 archivo de test nuevo (wiring de la ruta).

## 4. Validación (Macroetapa 3) — resultado consolidado

- Suite completa: **104/104 suites · 681/681 tests** (antes 103/103 · 674/674 — cero regresiones).
- Verificado exhaustivamente: `serviceId`/`clientId`/`petId` de otro tenant rechazados cuando se provee `tenantId`; compatibilidad hacia atrás confirmada (tests sin `tenantId` siguen pasando); `tenantId` en la ruta proviene exclusivamente de `req.tenant.tenantId`; propagación real verificada por test de wiring; `public-api.routes.js` sin diff (`resolve-service-price` sigue excluido); `changeServicePrice` sigue con un único llamador en todo el repo.
- `ServiceRepositoryPort.findById`, `PriceRuleRepositoryPort`, los 5 archivos protegidos del motor conversacional, y `prisma/schema.prisma` confirmados sin diff.

## 5. Decisión del Gate

**Aprobado y cerrado.** Macroetapa 4 ejecutada: commit, bump de versión a `2.32.0`, tag y push realizados bajo autorización explícita del responsable del proyecto.
