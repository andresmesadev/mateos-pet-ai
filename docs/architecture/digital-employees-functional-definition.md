# Empleados digitales para el trabajo manual operativo — Etapa 1

Fecha: 2026-10-14. Estado: Etapa 1 aprobada explícitamente por el responsable. No habilita implementación sin las etapas restantes.

Aprobación recibida en esta conversación: «Aprobar y pasar a casos de uso». Comprende los tres empleados y sus límites, comenzando por Finanzas y Administración/Inventario. Los casos de uso de la primera entrega se presentan en [Etapa 2](digital-employees-use-cases.md).

## Solicitud y objetivo

El responsable del producto pidió crear más empleados digitales como el Recepcionista y el Coordinador de Agenda, para cubrir «todas las tareas que se hacen manuales».

El objetivo es reducir búsqueda, transcripción y coordinación repetitiva sobre las operaciones que el software ya ofrece. Se organiza el trabajo por responsabilidad y autoridad, no creando un agente por pantalla. Esta definición propone tres especializaciones adicionales que el catálogo ya admite: `asistente_financiero`, `asistente_administrativo` y `asistente_recuperacion`.

«Todas» define la dirección de cobertura, no certifica que conozcamos cada procedimiento humano ni autoriza cualquier efecto externo. El inventario de abajo procede del código existente; cada tarea adicional debe identificarse y contrastarse con el dominio antes de incorporarse. La primera implementación tendrá un conjunto cerrado de tareas aprobado en los casos de uso.

## Coherencia con el producto

- Se apoya en [Empleados Digitales y los contextos operativos del modelo](domain-model-v1.md), los [principios y criterios del Plan Maestro](../PLAN_MAESTRO.md) y las capacidades ya implementadas.
- No declara una fase futura ni reabre las fases cerradas. La solicitud funcional actual justifica evaluar asistentes sobre esos módulos; no promueve deudas técnicas ni incorpora un dominio nuevo.
- Conserva Tenant como aislamiento, el dominio como autoridad, los precios centralizados y los hechos financieros inmutables.
- Los dos empleados existentes conservan sus responsabilidades. No se duplica el motor de conversación ni el job de recordatorios.
- El catálogo de nombres no equivale a agentes implementados. Este documento define trabajo por construir; no registra ni activa empleados en producción.

## Equipo funcional propuesto

| Empleado | Responsabilidad | Trabajo manual que simplifica |
| --- | --- | --- |
| Recepcionista IA — existente | Atención conversacional y reservas por WhatsApp dentro de su flujo actual. | Responder y guiar solicitudes de clientes. |
| Coordinador de Agenda IA — existente | Recordatorios con auditoría y límite de autonomía ya implementado. | Revisar y enviar recordatorios del flujo actual. |
| Asistente Financiero — nuevo | Consultar y explicar información financiera existente; preparar operaciones admitidas para confirmación. | Buscar reportes, distinguir cifras preliminares de cierres oficiales y transcribir datos para gastos/caja/cierres. |
| Asistente Administrativo — nuevo | Asistir en inventario y en consultas administrativas de servicios y staff permitidas al operador. | Buscar productos, existencias, lotes, movimientos y alertas existentes; preparar operaciones repetitivas de inventario. |
| Asistente de Recuperación — nuevo | Asistir al administrador en selección, revisión y seguimiento de campañas de reactivación ya disponibles. | Revisar candidatos y preparar una selección y una vista previa del envío, con resultados trazables. |

Los nombres de catálogo se reutilizan con responsabilidad acotada: `asistente_administrativo` no obtiene acceso universal a la plataforma y `asistente_financiero` no adquiere autoridad bancaria.

## Mapa inicial de tareas manuales

| Trabajo ya soportado por el software | Responsable funcional | Tratamiento propuesto |
| --- | --- | --- |
| Conversar con el cliente y gestionar el flujo actual de reserva | Recepcionista existente | Conservar el flujo; identificar por separado cualquier brecha observada. |
| Recordar citas y retomar reservas abandonadas dentro del motor actual de recordatorios | Coordinador existente | Conservar responsabilidades y política de autonomía actuales. |
| Buscar información de ventas, gastos, cobros, comisiones y cierres | Financiero | Consultar únicamente fuentes y reportes existentes autorizados. No inventar un reporte cuando falte un contrato. |
| Interpretar historial financiero de un intervalo | Financiero | Explicar cifras con fuente, período y condición de preliminar/oficial. La agregación y las reglas financieras siguen en Finanzas. |
| Registrar gastos y asistir en cobros/ventas/cierres existentes | Financiero | Recoger datos y presentar operación completa. Ejecutar solo el comando aprobado y confirmado por un operador autorizado. Los comandos concretos se seleccionan en Etapa 2. |
| Buscar existencias disponibles, lotes y alertas existentes | Administrativo | Consulta con los permisos efectivos y el módulo del operador; distinguir stock físico de disponible. |
| Consultar movimientos de un producto | Administrativo | Respetar el permiso de administración exigido por el historial completo; no ampliar el permiso de lectura de catálogo. |
| Preparar entradas, consumos, ajustes o devoluciones de inventario | Administrativo | Usar las operaciones ya admitidas y sus motivos/referencias. Confirmación antes de registrar; no convertir una devolución financiera en una física. |
| Consultar catálogo de servicios y personal disponible | Administrativo | Solo la información que el operador ya puede consultar. No sustituir reglas de disponibilidad ni resolver precios por su cuenta. |
| Cambiar precios, horarios, permisos o configuración sensible | Administrador humano | Mantener el control actual. No se entrega ejecución de estas operaciones a los nuevos agentes en este alcance. |
| Revisar candidatos de recuperación y preparar destinatarios/plantilla | Recuperación | Reutilizar criterios y selección existentes. Mostrar datos necesarios y origen, sin inventar teléfonos o contactos. |
| Enviar una campaña de reactivación | Recuperación | Confirmación de selección y contenido exactos; canal y plantilla válidos. El envío usa Comunicación y se respeta el resultado por destinatario. |
| Atenciones clínicas/grooming y decisiones profesionales | Profesional humano | Mantener los flujos existentes; la solicitud general de automatizar trabajo manual no define ni aprueba un nuevo asistente clínico. |

La ejecución con efectos es parte del objetivo funcional, pero no significa que cada fila se publique en una primera entrega. La Etapa 2 debe cerrar una lista mínima de comandos y consultas por empleado, con dependencias y criterios de aceptación específicos. Ninguna fila autoriza a crear una operación de negocio inexistente.

## Autonomía y confirmación

### Consultas

El agente puede consultar datos que el operador autenticado ya está autorizado a ver, dentro del establecimiento activo y de los módulos habilitados. Debe pedir los datos que falten, respetar paginación y distinguir un resultado vacío de una fuente inaccesible.

### Operaciones con efectos

El operador debe revisar y confirmar una vista previa concreta antes de registrar dinero o existencias o enviar una campaña. La vista previa identifica acción, recursos, importes/cantidades, fecha, motivo y destinatarios cuando corresponda. Un cambio relevante exige nueva confirmación. «Automatiza todas las tareas» no sustituye la confirmación de una operación particular.

La implementación deberá revalidar identidad, permisos y datos vigentes al ejecutar, y evitar ejecución duplicada. El mecanismo exacto de confirmación/idempotencia se decide en arquitectura, no queda resuelto por una frase del prompt ni por registrar un empleado digital.

Esta política es propia de los comandos seleccionados para los nuevos empleados. No modifica la regla existente de ausencia de configuración de autonomía del Coordinador de Agenda.

### Auditoría y escalamiento

Cada trabajo debe quedar asociado al empleado y a una tarea con resultado y decisiones auditables, reutilizando el contexto existente. Cuando el problema requiere intervención humana se usa la escalación existente. La falta de permisos no puede transformarse en una escalación que ejecute el comando con privilegios ajenos: se rechaza la operación.

No se presentan como hechos datos que no pudieron verificarse ni como completadas operaciones fallidas. Si un efecto externo tiene resultado incierto, se informa la incertidumbre y se evita un reintento ciego.

## Operador y canal inicial

La propuesta usa el dashboard autenticado como punto de entrada del personal. Finanzas, administración e historial completo de inventario mantienen el acceso administrativo actual. Cualquier consulta disponible para otros roles conserva sus permisos y restricciones existentes. El acceso real debe reevaluarse en cada operación; no se acepta un rol afirmado por el navegador ni una identidad omitida tratada como administrador.

El WhatsApp del cliente continúa atendido por el Recepcionista. Añadir preguntas internas del negocio al teléfono del cliente requeriría un mecanismo de identidad de operador y otro diseño; no se presupone por compartir el canal WhatsApp. No se añade un canal ni una ejecución programada en esta definición.

## Evidencia de capacidades existentes

- [Aprovisionamiento](../../backend/src/services/tenant-provisioning.service.js): dos especializaciones predeterminadas actuales.
- [Catálogo de especializaciones](../../backend/src/contexts/agents/application/ports/digital-employee-repository.port.js): admite los tres nombres propuestos; no prueba su implementación.
- [Finanzas](../../backend/src/contexts/finance/index.js): consultas de historial/cierres/períodos y comandos ya expuestos. `getFinancialHistory` distingue los días cerrados y las vistas preliminares; un cierre inexistente no se inventa.
- [Inventario](../../backend/src/contexts/inventory/index.js) y [sus consultas](../../backend/src/contexts/inventory/application/use-cases/inventory.reads.js): catálogo, detalle, movimientos y autorización por actor/Tenant. `inventory_read` no equivale a `inventory_manage`.
- [Acceso al dashboard](../../backend/src/services/dashboard-access.service.js): capacidades por rol y módulo.
- [Reactivación](../../backend/src/services/dashboard-reactivation.service.js) y [rutas de clientes](../../backend/src/routes/dashboard/clients.routes.js): selección, campaña y resultados por destinatario existentes. La Etapa 2 debe verificar qué contratos pueden reutilizarse desde el dominio y qué parte sigue siendo un adaptador.

## Criterios funcionales de aceptación

1. Se puede distinguir quién pidió el trabajo, qué empleado lo atendió y qué establecimiento y permisos efectivos se aplicaron.
2. Una consulta devuelve datos con fuente y período o explica qué falta; no inventa cifras, stock, IDs o permisos.
3. Cambiar el Tenant o el ID del recurso no permite consultar ni modificar datos de otro establecimiento.
4. Un operador con permiso de catálogo no obtiene por el agente el historial administrativo de inventario ni los reportes financieros.
5. Toda operación con efectos definida en Etapa 2 exige confirmación concreta y revalidación; no se repite por duplicación o reintento.
6. Una operación de inventario respeta unidades, lotes, disponibilidad y reglas ya construidas; Finanzas conserva sus propias correcciones e invariantes.
7. Las campañas identifican éxitos, fallos y resultados inciertos sin reenviar un mensaje ya confirmado por falta de actualización de una métrica.
8. Tareas, decisiones y escalaciones permiten auditar resultados. La UI diferencia propuesta, pendiente de confirmación, completado y fallo; los estados persistidos concretos se resuelven en diseño.
9. El responsable valida con ejemplos reales qué tarea manual se redujo. No se promete un ahorro porcentual sin medir el flujo anterior y el asistido.

## Alcance aprobado

Se aprobó esta Etapa 1: tres empleados con responsabilidades delimitadas, consultas autorizadas, preparación de operaciones existentes y ejecución solo mediante confirmación y contratos aprobados. Se comienza por Finanzas y Administración/Inventario y se trata Recuperación después, sin mezclar los tres en una implementación simultánea.

No se promete automatización íntegra de todos los procedimientos del negocio. Una tarea todavía no identificada, una regla nueva, un dominio diferido o una acción sin autorización exige definición adicional antes de incorporarse.

## Puerta de avance

La [regla obligatoria de ejecución](../PHASE_2_EXECUTION_RULE.md) exige: «Cada etapa se aprueba explícitamente antes de avanzar a la siguiente».

La aprobación de esta definición permite diseñar y presentar los casos de uso de la primera entrega. Le siguen arquitectura técnica (incluidas decisiones diferidas), persistencia y esquema físico. Solo con las cinco etapas aprobadas procede implementar. Esta aprobación no aprueba por sí misma esas etapas ni registra un cierre de entregable.

## Validación documental de esta etapa

```text
node scripts/check-docs.cjs
"checkedLinks": 852,
"broken": [],
"missingDocReferences": [],
"nonPortableLocalLinks": []
Código de salida: 0

node --test scripts/check-docs.test.cjs
tests 6
pass 6
fail 0
Código de salida: 0

npm --prefix frontend run lint
> frontend@0.1.0 lint
> eslint
Código de salida: 0
```

Esta evidencia comprueba documentación y lint del repositorio, no ejecución de agentes nuevos. La suite completa del backend no fue certificada en la tarea anterior y este cambio documental no resuelve ese diagnóstico pendiente.

Revisión técnica del `phase-2-reviewer`: sin hallazgos accionables sobre coherencia de dominio, permisos, aislamiento o avance secuencial. No sustituye la aprobación funcional del responsable.
