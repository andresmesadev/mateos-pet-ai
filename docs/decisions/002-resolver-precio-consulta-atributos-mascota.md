# ADR 002 — Resolver Precio del Servicio puede consultar atributos de Mascota vía puerto de lectura

**Fecha:** 2026-07-01
**Estado:** Aceptado
**Fase:** Fase 2 — Sistema Operativo del Negocio
**Entregable:** 2.1 — Sistema Operativo de Servicios
**Origen:** Auditoría funcional del Entregable 2.1 (etapa 6 — Validación, `docs/PHASE_2_EXECUTION_RULE.md`)

---

## Contexto

El contrato funcional aprobado para **Resolver Precio del Servicio** (`docs/architecture/use-cases/sistema-operativo-servicios.md`, sección 5) declara: *"Qué contextos consume — Ninguno externo de forma directa: las reglas de precio específicas por cliente/mascota se resuelven internamente cuando Agenda solicita el precio"*.

Esa afirmación es correcta para las reglas de precio acordadas **por cliente** o **por mascota**: su `targetId` es directamente el `clientId` o `petId` recibido como entrada, sin necesidad de consultar nada externo.

No es correcta para las reglas de precio **por raza**. El Modelo de Dominio exige esa jerarquía (`domain-model-v1.md`, contexto Servicios), pero la raza de una mascota es un atributo que vive en el contexto Mascotas (`Pet.breed`), no en Servicios. Sin conocer la raza de la mascota recibida, el caso de uso no puede evaluar si existe una regla de precio por raza aplicable — la jerarquía mascota > cliente > raza/tamaño > base quedaría incompleta en la práctica.

La auditoría funcional del Entregable 2.1 detectó esta brecha entre el contrato aprobado y lo que el caso de uso necesita para cumplir su propio objetivo declarado.

## Decisión

**Resolver Precio del Servicio puede consultar el contexto Mascotas, exclusivamente a través de un puerto de lectura de atributos (`TargetExistenceReaderPort.getPetAttributes(petId)`), que retorna únicamente los atributos estrictamente necesarios para la resolución de precio (raza, tamaño) — nunca el modelo interno completo de Mascota.**

Esto no es una excepción al límite "Servicios no debe conocer Mascotas directamente". Es la misma forma de acceso ya autorizada para `ChangeServicePriceUseCase` (verificar existencia de un destino), extendida a un segundo método del mismo puerto, con el mismo principio: Servicios nunca importa la estructura de Mascotas, solo lee, a través de una interfaz mínima y explícita, lo que necesita para resolver una regla del propio dominio de Servicios.

## Consecuencias

- El contrato funcional (`sistema-operativo-servicios.md`, sección 5) se actualiza para reflejar esta decisión explícitamente.
- El diseño técnico (`servicios-esquema-fisico.md` y el diseño de arquitectura técnica) ya documentaban `TargetExistenceReaderPort` con el método `getPetAttributes`; este ADR formaliza que su uso por parte de `ResolveServicePriceUseCase` es intencional y aprobado, no una desviación pendiente.
- Ningún otro caso de uso de Servicios queda autorizado a consultar Mascotas más allá de lo ya contratado (verificación de existencia en `ChangeServicePriceUseCase`, lectura de atributos en `ResolveServicePriceUseCase`). Cualquier necesidad adicional requiere su propio ADR.

---

*ADR 002 · Plataforma Operativa Inteligente · Mateos Pet*
