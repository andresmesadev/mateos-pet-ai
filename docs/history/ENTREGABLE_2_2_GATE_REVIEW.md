# Gate Review — Entregable 2.2: Sistema Operativo de Staff

**Fecha:** 2026-07-01
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Entregable:** 2.2 — Sistema Operativo de Staff
**Proceso aplicado:** `docs/PHASE_2_EXECUTION_RULE.md`

---

## Propósito de este registro

Este documento certifica que el Entregable 2.2 completó, en orden, las cinco etapas de diseño exigidas por la Regla de Ejecución de la Fase 2, y que cada una fue revisada y aprobada antes de avanzar a la siguiente. Queda como el registro histórico de ese cierre.

---

## Etapas aprobadas

**✓ 1. Definición Funcional — Aprobada.**
Cuatro brechas identificadas entre el Modelo de Dominio y el sistema actual: ausencia de liquidación por período, disponibilidad sin reglas propias, ausencia de capa de aplicación para Staff, y capacidades operativas no modeladas. Esta última brecha llevó a ampliar `domain-model-v1.md` con la entidad **Capacidad del Staff**, antes de avanzar — el dominio fue primero.

**✓ 2. Casos de Uso — Aprobados.**
Doce casos de uso, clasificados por responsabilidad (Administración, Operación, Resolución, Consulta). Incluye una decisión funcional explícita sobre el carácter reactivo de `Registrar Comisión por Cita Completada` — su nombre deja claro que no es una acción iniciada por un operador.
Documento: `docs/architecture/use-cases/sistema-operativo-staff.md`

**✓ 3. Arquitectura Técnica — Aprobada.**
Capa de aplicación, contratos, puertos (incluyendo el criterio reafirmado de puertos mínimos), dependencias, eventos y estructura de carpetas, heredando sin redefinir los Principios Permanentes ya establecidos en 2.1. Cierra con la sección "Decisiones Arquitectónicas Diferidas" — ahora una regla permanente de la Etapa 3 para todos los entregables futuros.
Documento: `docs/architecture/technical-design/sistema-operativo-staff.md`

**✓ 4. Modelo de Persistencia — Aprobado.**
Cinco entidades (dos reutilizadas de Fase 1, tres nuevas), con `Miembro del Staff` como Aggregate Root. Decisión explícita de no contener `Comisión` ni `Liquidación` dentro del agregado, consistente con su pertenencia futura abierta a `Finanzas`. `Reactivar Staff` resuelto sin mutación de datos — la restauración de capacidades es un efecto emergente del filtro de actividad, no una operación.
Documento: `docs/architecture/technical-design/staff-modelo-persistencia.md`

**✓ 5. Esquema Físico — Aprobado.**
Migración aditiva y de bajo riesgo: a diferencia de 2.1, ningún archivo de Fase 1 requiere modificación. Incluye una excepción documentada y acotada al Principio Permanente de doble protección (solapamiento de horario base, protegido solo en aplicación, por no justificarse la extensión `btree_gist` para un único invariante).
Documento: `docs/architecture/technical-design/staff-esquema-fisico.md`

---

## Decisiones arquitectónicas registradas (seis en total)

| # | Decisión | Estado | ¿Bloquea implementación? |
|---|---|---|---|
| 1 | Pertenencia futura de `Commission`/`Settlement` a `Finanzas` | Diferida, intencionalmente abierta | No |
| 2 | `commission-calculation.rules.js` vs. `commission.service.js` (Fase 1) | **Resuelta** en la Etapa 5: conviven, no se fusionan | No |
| 3 | Caso de uso `Anular Liquidación` | Fuera de alcance de este entregable | No |
| 4 | Puerto de lectura saliente de Staff | No se construye hasta que otro contexto lo necesite | No |
| 5 | Relación entre `Disponibilidad del Staff` y `Staff.availability` (JSON, Fase 1) | Diferida explícitamente hasta el inicio de la implementación, por decisión expresa del responsable del proyecto | **No bloquea el cierre del diseño — es la primera decisión a resolver al iniciar la implementación de `UpdateAvailabilityUseCase`** |
| 6 | Protección del solapamiento de horario base | Resuelta como excepción acotada (solo aplicación) | No |

## ¿Existe alguna decisión arquitectónica abierta que bloquee la implementación?

**No.** Las seis decisiones registradas están todas correctamente diferidas o resueltas. La Decisión #5 requiere atención al *comenzar* la implementación de la disponibilidad, pero no impide que el diseño se congele hoy — su resolución ya tiene dueño y momento claro: la Etapa 5 del propio proceso lo anticipó así, y el responsable del proyecto confirmó explícitamente mantenerla diferida.

---

## Conclusión

El diseño del Entregable 2.2 queda **oficialmente congelado**.

A partir de este momento, cualquier cambio estructural a los casos de uso, la arquitectura técnica, el modelo de persistencia o el esquema físico aprobados deberá realizarse mediante una decisión arquitectónica explícita (un nuevo ADR), nunca modificando silenciosamente el diseño aprobado durante la implementación.

Comienza ahora la implementación del Entregable 2.2. El objetivo deja de ser diseñar. Es traducir fielmente el diseño aprobado a código — y, primero, resolver con un ADR la Decisión Diferida #5, que ya tiene su contexto completo disponible.

---

*Gate Review · Entregable 2.2 · Plataforma Operativa Inteligente · Mateos Pet*
