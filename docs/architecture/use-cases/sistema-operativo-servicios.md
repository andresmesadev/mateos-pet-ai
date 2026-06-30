# Casos de Uso — Sistema Operativo de Servicios

**Entregable:** 2.1 (Fase 2 — Sistema Operativo del Negocio)
**Estado:** Implementado y validado. Diseño congelado por `docs/decisions/001-congelamiento-diseno-entregable-2.1.md`; ampliado por `docs/decisions/002-resolver-precio-consulta-atributos-mascota.md`. Ver cierre en `docs/history/ENTREGABLE_2_1_COMPLETION_REPORT.md`.
**Contexto de dominio que cubre:** `Servicios` (ver `docs/architecture/domain-model-v1.md`, sección 5)

---

## Propósito de este documento

Este documento define el contrato funcional del Sistema Operativo de Servicios: qué casos de uso existen, qué hacen, bajo qué reglas, y qué eventos produce cada uno. No describe pantallas, endpoints ni estructuras de datos. Es la capa de aplicación que coordina el contexto `Servicios`, agnóstica a cualquier canal que la invoque (Dashboard, mensajería, API pública, un Empleado Digital o un test automatizado).

Ningún canal debe implementar estas reglas por su cuenta. Todo canal que necesite crear, modificar, desactivar o consultar un servicio, o resolver un precio, invoca uno de estos casos de uso.

### Clasificación por responsabilidad

A partir de este entregable, todo caso de uso del Sistema Operativo se clasifica en una de cuatro responsabilidades. Esta clasificación es un criterio de diseño permanente: se mantiene para todos los entregables siguientes de la Fase 2 (2.2 — Staff, 2.3 — Finanzas).

- **Administración** — Decide y modifica cómo está configurado el dominio (crear, actualizar, desactivar entidades). Lo ejecuta siempre un operador humano.
- **Operación** — Registra una decisión de negocio con peso propio, distinta de una simple edición de atributos (p. ej. una decisión financiera como el precio). Lo ejecuta un operador humano, pero se documenta aparte de la Administración por su naturaleza y sus implicaciones de auditoría.
- **Resolución** — Calcula un resultado del dominio a partir de reglas ya configuradas, sin modificar estado. Lo invoca típicamente otro caso de uso o contexto, no un humano directamente.
- **Consulta** — Expone el estado vigente del dominio para lectura, sin modificarlo ni calcular nada nuevo.

| Caso de uso | Responsabilidad |
|---|---|
| Crear Servicio | Administración |
| Actualizar Servicio | Administración |
| Desactivar Servicio | Administración |
| Cambiar Precio | Operación |
| Resolver Precio del Servicio | Resolución |
| Consultar Servicios Disponibles | Consulta |

---

## 1. Crear Servicio

**Responsabilidad:** Administración

**Objetivo**
Incorporar una nueva prestación al catálogo del establecimiento.

**Actor principal**
Operador del negocio (administrador del catálogo), invocando desde cualquier canal autorizado.

**Precondiciones**
- El establecimiento tiene activo el módulo que habilita la categoría del servicio a crear (p. ej. "grooming" requiere el módulo de peluquería activo).
- No existe ya un servicio activo con el mismo nombre dentro de la misma categoría.

**Flujo principal**
1. El actor solicita crear un servicio, proveyendo nombre, categoría, duración estándar y precio base.
2. El caso de uso valida que la categoría exista y esté habilitada por la configuración del establecimiento.
3. El caso de uso valida que el precio base y la duración sean valores válidos para una prestación (no nulos, no negativos).
4. El servicio se registra en el catálogo en estado activo.
5. Se emite el evento de creación.

**Reglas de negocio involucradas**
- La categoría determina si el servicio aplica split de comisión (grooming 50/50, veterinaria 100% al negocio), según la configuración del establecimiento.
- Un servicio nace siempre activo; no existe creación en estado inactivo.

**Eventos de dominio que produce**
- `ServicioCreado`

**Qué contextos consume**
- `Negocio` — para validar módulos activos y reglas de categorización/split configuradas.

**Qué contextos no debe conocer**
- `Agenda` — no le concierne cómo se usará el servicio en una cita.
- `Finanzas` — no le concierne cómo se cobrará.
- `Clientes` ni `Mascotas` — el catálogo es independiente de quién lo consuma.

**Resultado esperado**
Un nuevo servicio disponible en el catálogo, listo para ser usado por Agenda al momento de agendar.

---

## 2. Actualizar Servicio

**Responsabilidad:** Administración

**Objetivo**
Modificar los atributos descriptivos de un servicio existente: nombre, categoría o duración estándar. (El precio se gestiona mediante el caso de uso **Cambiar Precio**, no aquí — ver justificación en esa sección).

**Actor principal**
Operador del negocio.

**Precondiciones**
- El servicio existe y está activo.
- Si se cambia la categoría, la nueva categoría está habilitada por la configuración del establecimiento.

**Flujo principal**
1. El actor solicita actualizar uno o más atributos de un servicio existente.
2. El caso de uso valida que el servicio exista.
3. Si cambia la categoría, se revalidan las reglas de split y comisión que aplicarán de ahí en adelante.
4. Se persisten los nuevos atributos.
5. Se emite el evento de actualización.

**Reglas de negocio involucradas**
- Cambiar la categoría de un servicio cambia su regla contable (split) hacia adelante. No afecta comisiones ya registradas sobre citas pasadas — los registros financieros son inmutables (Principio del Plan Maestro: las correcciones se hacen con anulación y nuevo registro, nunca modificando el hecho histórico).
- Cambiar la duración estándar no afecta citas ya agendadas con la duración anterior.

**Eventos de dominio que produce**
- `ServicioActualizado`

**Qué contextos consume**
- `Negocio` — para revalidar módulo y reglas de categoría si cambia.

**Qué contextos no debe conocer**
- `Agenda`, `Finanzas`, `Clientes`, `Mascotas` — mismos límites que en Crear Servicio.

**Resultado esperado**
El servicio refleja sus nuevos atributos para toda interacción futura, sin alterar el historial de citas o cobros ya generados con su configuración anterior.

---

## 3. Desactivar Servicio

**Responsabilidad:** Administración

**Objetivo**
Retirar un servicio de la oferta vigente del establecimiento sin eliminar su historial.

**Actor principal**
Operador del negocio.

**Precondiciones**
- El servicio existe y está actualmente activo.

**Flujo principal**
1. El actor solicita desactivar un servicio.
2. El caso de uso marca el servicio como inactivo.
3. El servicio deja de estar disponible para nuevas citas, pero permanece visible en el catálogo histórico y en cualquier cita o cobro que ya lo haya referenciado.
4. Se emite el evento de desactivación.

**Reglas de negocio involucradas**
- Un servicio inactivo nunca se elimina: el dominio no borra historia. Solo deja de ofrecerse hacia adelante.
- La desactivación no afecta citas ya agendadas que usan ese servicio; esa es responsabilidad de Agenda, no de Servicios.

**Eventos de dominio que produce**
- `ServicioDesactivado`

**Qué contextos consume**
- Ninguno adicional — es una operación interna al contexto `Servicios`.

**Qué contextos no debe conocer**
- `Agenda` — Servicios no decide qué pasa con citas futuras ya agendadas sobre un servicio desactivado; eso lo resuelve Agenda al reaccionar al evento si lo necesita.
- `Finanzas`, `Clientes`, `Mascotas` — sin relación directa.

**Resultado esperado**
El servicio deja de poder seleccionarse para nuevas citas, conservando intacta toda referencia histórica.

---

## 4. Cambiar Precio

**Responsabilidad:** Operación

**Objetivo**
Modificar las condiciones de precio de un servicio: su precio base en el catálogo, o una regla de precio específica (por raza, por tamaño, acordada con un cliente o con una mascota en particular).

**Por qué es un caso de uso independiente**
El precio no es un atributo descriptivo del servicio: es una decisión financiera del dominio, con implicaciones de auditoría, de comisiones y de jerarquía de reglas propias. Por esa razón nunca debe mezclarse con la actualización de atributos descriptivos (nombre, categoría, duración) que gestiona **Actualizar Servicio**. Esta separación es la que sostiene la regla permanente del Plan Maestro: "el precio se resuelve en un único lugar".

**Actor principal**
Operador del negocio.

**Precondiciones**
- El servicio existe y está activo.
- Si la modificación es una regla de precio acordada por cliente o por mascota, el cliente o la mascota referenciados existen (validado vía identificador, sin que `Servicios` dependa de los contextos `Clientes` o `Mascotas`).

**Flujo principal**
1. El actor solicita cambiar el precio base del catálogo, o crear/actualizar una regla de precio (por raza, por tamaño, por cliente o por mascota).
2. El caso de uso valida que el nuevo valor sea válido (no negativo).
3. El caso de uso persiste el cambio: ya sea el precio base del servicio, o la regla de precio correspondiente.
4. Se emite el evento de actualización.

**Reglas de negocio involucradas**
- Esta es la única vía autorizada para modificar el precio de un servicio o crear una excepción de precio. Ningún otro módulo del sistema implementa reglas de precio por su cuenta (regla permanente del Plan Maestro: "el precio se resuelve en un único lugar").
- Un cambio de precio nunca es retroactivo: no modifica el precio ya congelado en citas o cobros pasados.
- Esta es una decisión de **configuración del catálogo**, distinta de **Resolver Precio del Servicio**, que es una operación de lectura/cálculo en el momento de uso. Por eso es un caso de uso separado de Actualizar Servicio: cambiar el precio tiene implicaciones de negocio (y de auditoría futura) distintas de cambiar un nombre o una duración.

**Eventos de dominio que produce**
- `ServicioActualizado` (el modelo de dominio actual no distingue un evento propio para cambios de precio; se reutiliza el evento de actualización del servicio).

**Qué contextos consume**
- `Clientes` y `Mascotas` — únicamente para validar la existencia del identificador referenciado en una regla de precio acordada por cliente o por mascota, sin incorporar lógica de esos contextos.

**Qué contextos no debe conocer**
- `Agenda` — no decide ni participa en cómo se agenda con ese precio.
- `Finanzas` — no cobra ni concilia; solo consume el resultado vía `Resolver Precio del Servicio` cuando corresponda.

**Resultado esperado**
El precio base o las reglas de precio del servicio quedan actualizadas, disponibles para que `Resolver Precio del Servicio` las aplique en la siguiente solicitud.

---

## 5. Resolver Precio del Servicio

**Responsabilidad:** Resolución

**Objetivo**
Determinar el precio final correcto para una combinación específica de servicio, cliente y mascota, aplicando la jerarquía de reglas de precio vigente.

**Actor principal**
Otro caso de uso del Sistema Operativo (consumidor interno — típicamente Agenda, al calcular el precio de una cita).

**Precondiciones**
- El servicio existe y está activo.

**Flujo principal**
1. El consumidor solicita el precio de un servicio para una mascota y un cliente determinados.
2. El caso de uso evalúa las reglas de precio en orden de prioridad: precio acordado por mascota (máxima prioridad) → precio acordado por cliente → precio por raza o tamaño → precio base del catálogo.
3. El caso de uso retorna el precio resuelto y el origen de esa resolución (qué regla se aplicó), para que quien lo invoque pueda mostrar trazabilidad si lo necesita.

*Nota de nomenclatura:* se nombra explícitamente "del Servicio" porque la responsabilidad de Resolución es un patrón que se repetirá en otros contextos del Sistema Operativo (p. ej. una futura "Resolver Disponibilidad del Staff" en el Entregable 2.2). El nombre completo evita ambigüedad cuando existan varios resolvedores en el dominio.

**Reglas de negocio involucradas**
- El precio acordado por mascota tiene prioridad sobre cualquier otra regla — es la regla explícita del Modelo de Dominio.
- Esta es una operación de **lectura pura**: no modifica el catálogo ni genera estado nuevo.
- El precio se resuelve siempre en este único lugar; ningún otro caso de uso ni canal debe reimplementar esta jerarquía.

**Eventos de dominio que produce**
- Ninguno. Es una consulta, no una mutación del dominio.

**Qué contextos consume**
- Ninguno de forma directa para las reglas por cliente o por mascota: ya están almacenadas dentro del propio contexto `Servicios` (regla del modelo: "las reglas de precio específicas por cliente/mascota se resuelven internamente cuando Agenda solicita el precio").
- `Mascotas` — **únicamente** a través de un puerto de lectura de atributos (`TargetExistenceReaderPort.getPetAttributes`), para obtener la raza de la mascota y poder evaluar la regla de precio por raza. Nunca conoce el modelo interno de Mascota, solo el atributo puntual que necesita. Esta consulta está formalizada en `docs/decisions/002-resolver-precio-consulta-atributos-mascota.md` — la jerarquía de precio del Modelo de Dominio exige el nivel "por raza", y ese dato no puede resolverse sin esta lectura mínima.

**Qué contextos no debe conocer**
- `Agenda` — Servicios no sabe qué cita está en curso ni por qué se le pide el precio; solo responde a la pregunta con los identificadores que recibe.
- `Finanzas` — no participa en la resolución del precio, solo en su cobro posterior.
- `Mascotas` más allá del puerto mínimo de atributos descrito arriba — nunca su modelo completo, ni sus relaciones, ni su historial.

**Resultado esperado**
Un precio único y trazable, listo para ser usado por quien lo solicitó, sin ambigüedad sobre qué regla lo originó.

---

## 6. Consultar Servicios Disponibles

**Objetivo**
Obtener la lista de servicios disponibles del establecimiento, con sus atributos vigentes, para su uso por el operador o por otro contexto que lo necesite (p. ej. Agenda, al requerir la duración de un servicio).

**Actor principal**
Operador del negocio u otro caso de uso del Sistema Operativo.

**Precondiciones**
- Ninguna especial. Es una operación de lectura abierta dentro de los límites del establecimiento.

**Flujo principal**
1. El actor solicita el catálogo, opcionalmente filtrado por categoría o por estado (activo/inactivo).
2. El caso de uso retorna la lista de servicios que cumplen el filtro, con sus atributos vigentes (nombre, categoría, duración, precio base).
3. No se exponen aquí las reglas de precio específicas por cliente o por mascota — esas se obtienen exclusivamente vía **Resolver Precio del Servicio**, nunca como parte de una consulta general del catálogo.

**Reglas de negocio involucradas**
- Por defecto, la consulta retorna solo servicios activos, salvo que el actor solicite explícitamente incluir los inactivos (necesario para mantener trazabilidad histórica sin contaminar la oferta vigente).

**Eventos de dominio que produce**
- Ninguno. Es una consulta, no una mutación del dominio.

**Qué contextos consume**
- `Negocio` — para filtrar categorías habilitadas según los módulos activos del establecimiento.

**Qué contextos no debe conocer**
- `Clientes`, `Mascotas`, `Agenda`, `Finanzas` — el catálogo es la misma oferta para cualquier consumidor; no se personaliza en esta consulta.

**Resultado esperado**
Una vista confiable y vigente del catálogo de servicios, utilizable tanto por el operador humano como por cualquier otro caso de uso del Sistema Operativo que necesite conocer qué se ofrece.

---

## Notas para la aprobación

- Estos seis casos de uso cubren completamente las responsabilidades que el Modelo de Dominio asigna al contexto `Servicios`. Ninguno introduce una entidad o regla no descrita en `domain-model-v1.md`.
- **Cambiar Precio** y **Actualizar Servicio** se mantienen deliberadamente separados: mezclar la edición de atributos descriptivos con la edición de precio diluiría la regla "el precio se resuelve en un único lugar" y dificultaría auditar cambios de precio de forma aislada en el futuro.
- **Resolver Precio del Servicio** y **Consultar Servicios Disponibles** son los dos únicos puntos de lectura que otros contextos (especialmente Agenda) deben usar para interactuar con `Servicios`. Ningún otro caso de uso de este documento debe ser invocado por un contexto externo.
- Ningún caso de uso de este documento conoce `Agenda` ni `Finanzas` de forma directa, en cumplimiento de la regla del Modelo de Dominio: `Servicios` no gestiona citas ni cobros.

Pendiente de tu aprobación antes de pasar a diseño técnico (entidades de persistencia, contratos de invocación, capa de adaptadores).
