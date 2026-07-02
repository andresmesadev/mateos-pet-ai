# ADR 006 — Reconciliación Arquitectónica del cierre de la Fase 2: qué prometió la fase y qué entregó realmente

**Fecha:** 2026-07-02
**Estado:** Aceptado (2026-07-02) — el responsable del proyecto eligió la **Opción A**
**Fase:** Fase 2 — Sistema Operativo del Negocio (cerrada como v2.1.0)
**Origen:** Hallazgo C1 de la auditoría técnica externa de v2.1.0, validado con evidencia reproducible
**Naturaleza de este ADR:** reconciliación arquitectónica entre la declaración oficial de cierre de la Fase 2 (`docs/PLAN_MAESTRO.md`, `CLAUDE.md`) y el código real del sistema — el mismo mecanismo formalizado en `docs/PHASE_2_EXECUTION_RULE.md` y estrenado con el ADR 005.

---

## La contradicción, con evidencia

**Lo que declara la documentación oficial:**

> `docs/PLAN_MAESTRO.md` (sección Fase 2, cierre): *"La auditoría de coordinación —verificar que ningún canal siga orquestando reglas de negocio directamente— [...] quedó validada al completar 2.3: Agenda, Servicios, Staff y Finanzas operan cada uno mediante su propia capa de casos de uso."*

> `docs/PLAN_MAESTRO.md` (objetivo de la Fase 2): *"que el operador humano pueda gestionar la operación diaria completa desde la plataforma"*.

**Lo que muestra el código (verificado el 2026-07-02 sobre el tag v2.1.0):**

1. En todo `backend/src`, el único import de un bounded context fuera de los propios contextos y sus tests es `daily-close.routes.js:5-6` (`getDailyClose`, un caso de uso de consulta). De los ~19 casos de uso construidos en 2.1, 2.2 y 2.3, **uno** es invocado por la aplicación real.
2. No existe endpoint ni pantalla para: generar Cierre del Día, generar Período Financiero, registrar/anular gastos vía caso de uso, gestionar liquidaciones (`Settlement`), ni ninguna operación de los contextos `services` y `staff`.
3. Las rutas reales siguen ejecutando la lógica de Fase 1: `expenses.routes.js:34` (`prisma.expense.create` directo, sin `responsible` ni guard de día cerrado), `appointments.routes.js:293` (el canal orquesta `recordGroomingCommission`), `service.service.js:9-13` (adaptador legacy que admite en su propio comentario que el frontend "todavía no fue migrado a invocar los casos de uso del contexto").
4. Los tests (285/285 en verde) validan los casos de uso contra fakes y los flujos de Fase 1 — ninguno ejercita un camino HTTP → caso de uso → base de datos.

**La declaración y el código no pueden ser ambos ciertos.** El criterio de cierre, tal como está escrito, no se cumple en el sistema que corre.

## El matiz que decide la reconciliación: qué diseñó realmente la Fase 2

Revisadas las cinco etapas de diseño de los tres entregables, **ninguna etapa diseñó jamás la exposición HTTP de los casos de uso**:

- `sistema-operativo-finanzas.md` (Etapa 3): *"Este documento traduce el contrato funcional aprobado a una estructura técnica. No contiene código, **ni endpoints**, ni esquema de base de datos."* Los documentos equivalentes de 2.1 y 2.2 siguen la misma disciplina.
- La única decisión de exposición tomada en toda la fase fue la **adaptación progresiva** de `daily-close.routes.js` (Etapa 3 de 2.3, resuelta en Etapa 5): reescribir un endpoint legado existente para *leer* del nuevo contexto — y esa decisión sí se implementó.
- El alcance congelado y validado de cada entregable fue: dominio + capa de aplicación + persistencia + tests. Las Validaciones Técnica y Funcional de 2.3 verificaron exactamente eso, y pasaron legítimamente.

**Conclusión de la evidencia:** la Fase 2, *tal como fue diseñada, congelada y validada etapa por etapa*, nunca prometió exponer los casos de uso a canales ni operadores. La contradicción no está en el trabajo entregado — está en la **declaración de cierre**, que afirmó un criterio ("Agenda, Servicios, Staff y Finanzas *operan* mediante su capa de casos de uso"; "el operador puede gestionar la operación diaria completa") que describe un sistema en funcionamiento, no una capa construida y probada. El defecto es de sobredeclaración, no de alcance incumplido a escondidas.

## Alternativas

### Opción A — Re-declarar el cierre de la Fase 2 (corrección documental) y convertir la exposición en un entregable puente explícito

La Fase 2 se re-declara como: *"diseño, capa de aplicación, persistencia y validación de dominio completos; exposición a canales pendiente"*. Se crea un entregable puente explícito — **"Exposición del Sistema Operativo"** — con su propio paso por la Regla de Ejecución, como precondición de la Fase 3. Documentos afectados: `PLAN_MAESTRO.md` (criterio de cierre de Fase 2 y precondición de Fase 3), `CLAUDE.md` (estado de fase), `ENTREGABLE_2_3_COMPLETION_REPORT.md` (nota de reconciliación sobre la frase "eventos ya existen", hallazgo M6), `PHASE_2_RETROSPECTIVE.md` (nota de reconciliación).

### Opción B — Sostener la declaración actual y completar la exposición como "corrección" del cierre

Construir ahora los endpoints, la superficie de frontend y el circuito de eventos para que la declaración existente se vuelva cierta retroactivamente.

## Recomendación fundamentada: Opción A

1. **La Opción B falsea el registro histórico.** Implicaría tratar como "corrección de un cierre ya validado" un trabajo que ninguna etapa congelada diseñó. La Regla de Ejecución exige que todo entregable pase por sus etapas antes de implementarse; la exposición nunca pasó por ninguna. Ejecutarla como parche del cierre violaría el proceso que la propia fase institucionalizó.

2. **La exposición no es un cambio mecánico — tiene bloqueantes de dominio abiertos.** Los hallazgos validados C2 (el ingreso por servicios nunca llega a `Transaction`), A1 (la zona horaria del día financiero es una decisión de dominio no tomada), A2 (atomicidad del período) y M1 (rechazo de `tenantId` nulo) deben resolverse **antes** de que `generateDailyClose` sea alcanzable, o el sistema congelará hechos financieros falsos. Un entregable puente con etapas formales es exactamente el vehículo para tomar esas decisiones en orden; un parche no lo es.

3. **La Opción A es consistente con el precedente del ADR 005:** cuando el diseño y una fuente oficial se contradicen, se corrige la fuente que está equivocada. Aquí lo equivocado es la declaración de cierre, no el código ni los diseños congelados — que son internamente coherentes entre sí.

4. **Costo y riesgo:** la Opción A modifica solo documentación (cuatro documentos, cambios acotados y citables); la Opción B abre implementación sin diseño previo sobre el módulo más sensible del sistema (dinero), con cuatro bloqueantes conocidos.

**Orden propuesto si se acepta la Opción A** (no se ejecuta con este ADR):
1. Correcciones documentales de la re-declaración (este ADR pasa a Aceptado y se citan los cambios).
2. Decisiones de dominio pendientes, cada una por su vía: C2 (circuito `CitaCompletada` → `Transaction`, o consolidación desde `Commission` por ADR), A1 (ADR de timezone del día financiero), A4 (anulación de `Commission` o reescritura de la regla en CLAUDE.md).
3. Entregable puente "Exposición del Sistema Operativo" por la Regla de Ejecución completa (incorporando A2 y M1 como invariantes de su Etapa 5, y el criterio de M8: todo camino que toque dinero se valida con al menos un test HTTP → caso de uso → BD).
4. Solo entonces, la Fase 3 queda desbloqueada.

## Qué NO decide este ADR

- No implementa ninguna solución para C1 ni C2.
- No modifica todavía `PLAN_MAESTRO.md`, `CLAUDE.md` ni los completion reports — eso ocurre solo si el responsable acepta una opción.
- No reabre los diseños congelados de 2.1/2.2/2.3, que esta reconciliación encontró internamente coherentes.

## Registro de remediaciones ya ejecutadas de la misma auditoría (contexto)

Previas a este ADR y sin dependencia de él: C3 (baseline del historial de migraciones — `prisma/migrations/20260702000000_baseline_fase1_final_y_fase2/`, marcada como aplicada con `prisma migrate resolve`, verificada con `migrate status` y `migrate diff` limpios), A3 (el proxy del dashboard solo acepta `tenantId` por query para superadmin), A5 (rate limit en `/api/billing` y `/api/onboarding`), M2 (`/api/test` no se monta en producción).
