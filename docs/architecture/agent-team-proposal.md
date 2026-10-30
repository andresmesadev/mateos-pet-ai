# Equipo de agentes de Huella Nex


> Actualización editorial de marca — 28/10/2026: se usa Huella Nex por solicitud de Andrés. Se conservan las fechas, versiones, decisiones y condiciones originales; esta edición no registra nuevas aprobaciones ni autorizaciones de clientes.

Fecha: 2026-10-14. Estado: inventario de código y perfiles de desarrollo; evaluación funcional preliminar para el producto.

## Agentes que ya tiene el producto

El aprovisionamiento de establecimientos declara dos especializaciones por defecto en [tenant-provisioning.service.js](../../backend/src/services/tenant-provisioning.service.js). Sus adaptadores y casos de uso están implementados; este inventario no certifica qué empleados están activos en cada tenant de producción.

| Empleado digital | Responsabilidad implementada | Fuente |
| --- | --- | --- |
| Recepcionista IA | Procesa la conversación de WhatsApp mediante el motor existente y registra tareas, decisiones y escalaciones humanas. | [Recepcionista](../../backend/src/contexts/receptionist/index.js) |
| Coordinador de Agenda IA | Ejecuta el flujo existente de recordatorios con auditoría y aplicación del límite de autonomía; puede escalar en lugar de ejecutarlo. No es un optimizador general de la agenda. | [Coordinador](../../backend/src/contexts/schedule-coordinator/index.js) |

Un empleado digital no necesita usar un LLM en cada paso: el coordinador actual gobierna un proceso existente. El contexto [Empleados Digitales](domain-model-v1.md) proporciona registro, tareas, decisiones, escalaciones y límites; registrar una especialización por sí solo no implementa su trabajo.

El [catálogo de especializaciones](../../backend/src/contexts/agents/application/ports/digital-employee-repository.port.js) admite además `asistente_grooming`, `asistente_recuperacion`, `asistente_financiero`, `asistente_administrativo` y `asistente_clinico`. La búsqueda exhaustiva en backend/src, frontend y scripts solo encontró esas cinco cadenas en la declaración del catálogo: son nombres admitidos para registro, no evidencia de cinco agentes operativos adicionales.

## Agentes para desarrollar y mantener el software

Son perfiles de Codex en `.codex/agents/`, separados de los empleados digitales del producto. Heredan modelo, permisos y MCP de la sesión principal. Sus límites de solo lectura son instrucciones de comportamiento, no un sandbox independiente.

El repositorio ignora `.codex/` por política de [.gitignore](../../.gitignore); estos perfiles se crean localmente en este equipo. No quedan versionados ni se instalarán automáticamente en otro checkout. Se conserva esa política.

| Perfil | Estado en este cambio | Responsabilidad |
| --- | --- | --- |
| `backend-agent` | Ya existía | Express, Prisma y casos de uso del backend. |
| `frontend-agent` | Ya existía | Next.js, dashboard y Portal del Cliente. |
| `phase-2-reviewer` | Ya existía | Conformidad con las reglas del dominio; revisión sin corrección. |
| `qa-agent` | Configuración nueva | Reproducir fallos y verificar regresiones con pruebas locales y evidencia. |
| `security-agent` | Configuración nueva | Revisar autorización por Tenant, autenticación, webhooks y entradas no confiables. |
| `production-diagnostics-agent` | Configuración nueva | Investigar incidentes con fuentes disponibles y acciones de lectura. |

Invocación sugerida: «Usa qa-agent para reproducir este fallo de reserva», «Usa security-agent para revisar el aislamiento de este diff» o «Usa production-diagnostics-agent para investigar este error de Sentry». Cada invocación debe precisar alcance y archivos permitidos. Las tareas paralelas deben asignar propiedad de archivos y conservar cambios ajenos.

El coordinador principal integra los resultados. La revisión de dominio, la revisión de seguridad y las pruebas tienen objetivos distintos; no se deben ejecutar todos los perfiles para cada cambio pequeño. Un perfil configurado no demuestra que haya sido cargado o ejecutado en la sesión actual.

## Evaluación de agentes adicionales dentro del producto

No se declara una fase nueva ni se reabren fases cerradas. Estas opciones se limitan a asistir sobre capacidades operativas ya construidas y requieren demostrar una tarea humana real antes de promoverse a entregable. No están implementadas ni aprobadas por este documento.

La solicitud posterior del responsable de cubrir el trabajo manual operativo se concreta en [la definición funcional de nuevos empleados — Etapa 1](digital-employees-functional-definition.md), aprobada explícitamente el 2026-10-14. Incorpora también Recuperación de Clientes y operaciones con confirmación. Los [casos de uso de la primera entrega — Etapa 2](digital-employees-use-cases.md) también quedaron aprobados; la [arquitectura — Etapa 3](digital-employees-technical-design.md) se presenta para aprobación independiente antes de persistencia y esquema físico.

| Opción a evaluar | Trabajo humano que podría simplificar | Límite inicial |
| --- | --- | --- |
| Asistente de reportes operativos | Buscar e interpretar reportes y cierres financieros existentes para el responsable del establecimiento. | Consultas de lectura por Tenant; cada importe y conclusión debe tener fuente. No genera cierres ni modifica cobros o comisiones. |
| Asistente de consulta de inventario | Buscar existencias y movimientos ya registrados y explicar su trazabilidad. | Lectura de los contratos existentes; no registra compras, ajustes ni consumos. No recomienda reposición sin una política de mínimos/demanda previamente modelada. |

La primera comparación debe ser contra una vista o reporte determinista: si resuelve la tarea, no hace falta introducir un agente. Tampoco debe duplicarse el coordinador para automatizar recordatorios que ya ejecuta.

### Próximo paso de diseño del producto

Antes de elegir una opción, concretar quién la usa, qué consulta repite, frecuencia, fuente autorizada y criterio observable de éxito. Después se aplica [la regla de ejecución](../PHASE_2_EXECUTION_RULE.md):

1. Definición funcional: tarea humana y límites de autonomía.
2. Casos de uso: entradas, identidad, salida, errores y escalamiento.
3. Arquitectura: canal que la invoca y casos de uso existentes; comprobar contratos reales antes de proponer herramientas.
4. Persistencia: evaluar si el registro de tareas y decisiones existente basta, sin crear modelos especulativos.
5. Esquema físico: decidir explícitamente si hay cambios y justificar cualquier migración.

Solo después del diseño y su gate procede implementar el empleado digital. No se agrega acceso directo a Prisma para eludir los contratos de dominio ni se alteran precios, comisiones o aislamiento. Los MCP de desarrollo no se conectan automáticamente a los agentes del producto.

## Validación y alcance

Este cambio agrega instrucciones de desarrollo y este documento. No activa nuevos empleados en la base de datos, no cambia el motor de WhatsApp ni publica una versión funcional. La validación debe comprobar TOML, enlaces documentales, lint y pruebas existentes; el reporte de la tarea debe distinguir configuración validada de ejecución real de cada perfil.

Evidencia local del 2026-10-14:

```text
Validación con Python tomllib:
TOML validado: 6 perfiles
backend-agent.toml OK
frontend-agent.toml OK
phase-2-reviewer.toml OK
production-diagnostics-agent.toml OK
qa-agent.toml OK
security-agent.toml OK

npm --prefix frontend run lint
> frontend@0.1.0 lint
> eslint
Código de salida: 0

node scripts/check-docs.cjs
"checkedLinks": 840,
"broken": [],
"missingDocReferences": [],
"nonPortableLocalLinks": []
Código de salida: 0

npm --prefix backend test -- --runInBand --silent --runTestsByPath src/contexts/agents/__tests__/digital-employee-lifecycle.usecase.test.js src/contexts/receptionist/__tests__/process-incoming-message.usecase.test.js src/contexts/schedule-coordinator/__tests__/process-reminder.usecase.test.js
Test Suites: 3 passed, 3 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Código de salida: 0
```

La ejecución completa `npm --prefix backend test -- --runInBand` terminó con código 1; el segundo intento con `--silent` tampoco aportó un resumen final de Jest en la salida capturada. No se considera aprobada la suite completa ni se atribuye su salida a estos perfiles. El diagnóstico integral queda pendiente. Los tres perfiles nuevos se validaron como configuración; aún no se verificó su carga y ejecución real como roles en una nueva sesión de Codex.

El `phase-2-reviewer` revisó los cuatro archivos sin hallazgos accionables: verificó la separación entre perfiles de desarrollo y empleados del producto, los límites de actuación y el diseño pendiente. Esa revisión no certifica la suite completa del backend.
