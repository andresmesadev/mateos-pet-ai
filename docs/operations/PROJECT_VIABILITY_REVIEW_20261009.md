# Viabilidad de Mateos Pet AI y horizonte de diez años

**Fecha:** 9 de octubre de 2026.
**Base revisada:** `main`, commit `a6991e4`, producto `2.45.0`.
**Alcance:** documentación, arquitectura, implementación representativa del frontend y backend, pruebas locales y contraste con proveedores del mercado. Es una evaluación técnica y de producto; no una certificación exhaustiva de seguridad, carga o viabilidad financiera.

## Mi conclusión

**Sí veo una base viable para construir un negocio sostenible. Todavía no hay evidencia suficiente para afirmar que será exitoso ni que permanecerá diez años en el mercado.**

El proyecto ya conecta varias partes de la operación: clientes y mascotas, agenda, atención veterinaria y peluquería, caja, inventario y seguimiento. Las mejoras recientes del frontend acercan esas capacidades al trabajo cotidiano del equipo. Eso tiene más potencial de permanencia que una función aislada de respuesta automática.

Mi recomendación es continuar con la validación interna y cerrar los requisitos del piloto antes de ampliar el alcance. El siguiente avance decisivo será demostrar uso diario, fiabilidad y disposición a pagar. Más módulos por sí solos no demostrarán esas tres cosas.

| Dimensión | Valoración actual | Qué falta demostrar |
| --- | --- | --- |
| Base técnica | Favorable para continuar | Comportamiento con carga y recuperación ante incidentes completos |
| Frontend y operación | Mejora importante, respaldada por implementación y pruebas | Facilidad de uso con personal real y accesibilidad manual pendiente |
| Diferenciación | Hipótesis plausible: operación integrada para negocios de salud y bienestar animal | Que ese segmento lo prefiera frente a alternativas existentes |
| Viabilidad comercial | Aún no validada en la evidencia revisada | Pago, retención, coste de soporte y margen por establecimiento |
| Permanencia hasta 2036 | Técnicamente posible con mantenimiento continuo | Clientes que permanezcan, capacidad de adaptación y operación sostenible |

No asigno una probabilidad de éxito: no contamos con cohortes, ingresos, costes comerciales ni retención suficientes para calcularla.

## 1. Qué mejoró realmente en el frontend

La mejora no se limita a apariencia. En `2.45.0` hay cambios que reducen trabajo repetido y riesgo operativo:

- **Continuidad entre áreas.** Inicio, agenda, clientes, consultas, peluquería y caja tienen recorridos más conectados y accesos adaptados al perfil del empleado.
- **Formularios que permiten recuperarse.** Validación con foco, conservación de borradores y mensajes de error más útiles evitan obligar a escribir todo de nuevo.
- **Guardados inciertos tratados explícitamente.** Un tiempo de espera agotado no se presenta como prueba de que el servidor canceló la operación. En los recorridos corregidos se puede comprobar el resultado antes de repetir el envío.
- **Caja utilizable con más registros.** Paginación, búsqueda en el conjunto filtrado, totales completos y cobros pendientes de fechas anteriores corrigen límites de la lectura previa.
- **Seguimientos clínicos con fallos visibles.** Un fallo de carga no se representa como una lista vacía confirmada; el reintento conserva el borrador.
- **Edición de precios protegida durante el envío.** El bloqueo de concurrencia y la validación de respuesta reducen anuncios de éxito incorrectos.

Estos comportamientos se respaldan en código como [dashboard-request.ts](../../frontend/lib/dashboard-request.ts), [form-feedback.ts](../../frontend/lib/form-feedback.ts), [use-inventory-operation.ts](../../frontend/lib/use-inventory-operation.ts) y el [proxy autenticado](../../frontend/app/api/proxy/dashboard/%5B...path%5D/route.ts). El inventario conserva una clave de operación para recuperación y reintentos; no debe extenderse esa garantía a todos los comandos financieros, porque el cierre documenta límites diferentes para liquidaciones.

La [publicación 2.45.0](../history/RELEASE_2_45_0_VPS_20261008.md) es la referencia final para despliegue. El [informe de ajustes del frontend](../history/FRONTEND_CIERRE_AJUSTES_20261008.md) describe una etapa local anterior a esa publicación; su frase «sin despliegue en esta ronda» no significa que los cambios sigan sin publicar.

**Límite pendiente:** zoom real de Chrome y lector de pantalla todavía no están certificados. Los ensayos automáticos de teclado, foco, contraste y reflujo son útiles, pero no sustituyen esas comprobaciones ni una prueba de facilidad de uso con recepcionistas, veterinarios y administradores.

## 2. Qué favorece la vida útil del software

La separación entre contextos de negocio, casos de uso, canales e infraestructura permite cambiar componentes sin reconstruir todo el sistema. Tenant como unidad de aislamiento, el resolutor único de precios y las correcciones financieras con trazabilidad son buenas decisiones para un producto que maneja datos y dinero de varios establecimientos.

En los puntos inspeccionados, la identidad del usuario y del establecimiento se transporta desde la sesión mediante el proxy; el backend exige el token interno fuera de pruebas. Son controles relevantes. Esta inspección representativa no certifica todas las rutas ni elimina la necesidad de revisiones periódicas de autorización.

La cola durable de mensajes, los reintentos, las pruebas, CI, los informes de publicación y el procedimiento de recuperación también reducen dependencia de intervenciones improvisadas. El proyecto presenta más disciplina de mantenimiento que un prototipo sin documentación.

**Hay deuda de mantenimiento.** Persisten servicios extensos, como `whatsapp.service.js`, `conversation.service.js` y `scheduling.service.js`, y componentes de interfaz grandes. Su tamaño no demuestra un defecto, pero aumenta el coste de comprender cambios y proteger recorridos existentes. Conviene mantener las separaciones aprobadas y mejorar piezas cuando un cambio real lo justifique, evitando una reescritura general durante el piloto.

Docker, PostgreSQL y Prisma pueden formar parte de una plataforma duradera. No hay evidencia en esta revisión que justifique reemplazarlos para conseguir longevidad. Sí habrá que actualizar versiones, dependencias y contratos de API: Node recomienda versiones LTS para producción y sus ciclos de soporte son mucho menores que diez años. [Política oficial de versiones de Node.js](https://nodejs.org/en/about/previous-releases).

La permanencia depende de conservar datos, reglas y clientes mientras la tecnología evoluciona; no de mantener congelado el código de 2026.

## 3. Mercado y diferenciación

La combinación de agenda, historias, inventario, pagos y WhatsApp ya se ofrece en el mercado. AgendaPro anuncia estas capacidades en su producto veterinario. [Oferta oficial de AgendaPro](https://agendapro.com/ar/veterinario/software-para-clinica-veterinaria).

La IA tampoco es una diferenciación exclusiva: Digitail documenta un asistente que resume historiales y genera comunicaciones para clientes, entre otras funciones. [Documentación oficial de Tails AI](https://help.digitail.io/en/articles/8658432-tails-ai-assistant).

Estas fuentes describen ofertas de sus proveedores; no verifican su calidad, resultados ni cuota de mercado. Sí permiten concluir que necesitamos una razón concreta para que un establecimiento elija Mateos Pet AI.

**Mi hipótesis de diferenciación**, todavía por validar, es ofrecer una operación integrada y sencilla para establecimientos que combinan veterinaria y peluquería, con reglas locales, seguimiento y asistencia en WhatsApp que realmente disminuya la carga del personal. Los horarios por servicio, los festivos, los turnos consecutivos y la recuperación ante fallos son relevantes para esa promesa.

La evidencia que haría defendible esa propuesta sería: menos tiempo coordinando citas, menos errores, mejor seguimiento y personal que usa la plataforma cada semana. Un cliente satisfecho y una operación fiable pueden sostener el negocio aunque los modelos de IA cambien.

## 4. Qué impide afirmar que ya está listo para crecer

Los pendientes siguientes están documentados; no son vulnerabilidades nuevas descubiertas por esta revisión.

| Prioridad | Evidencia actual | Consecuencia y siguiente comprobación |
| --- | --- | --- |
| Alta: recuperación independiente | Hay respaldo cifrado y ensayo de restauración; no está verificada una copia fuera de la VPS | Una pérdida del servidor puede afectar aplicación, base y respaldo a la vez. Verificar copia independiente y restauración antes de beta externa |
| Alta: estabilidad y capacidad | El plan mantiene abiertos observación con carga y período formal de 48 horas | Un despliegue saludable durante minutos no demuestra capacidad sostenida |
| Alta: agenda de extremo a extremo | La matriz recoge reservas, cancelaciones, domingos y festivos; sigue abierta para límites, conflicto y fallo controlado en el canal real | Completar los casos pendientes con evidencia de WhatsApp, cola y agenda |
| Alta antes de piloto externo: preparación operativa | Documentos del piloto y cohorte siguen pendientes en el plan | Definir alcance, responsables, soporte y condiciones de recuperación |
| Condición aplazada: WhatsApp comercial | Se conserva el número de prueba de Meta por decisión del operador | Continuar con validación interna; el plan no autoriza beta externa con esa configuración |
| Media: aceptación del frontend | Falta zoom real y lector de pantalla | Completar esas comprobaciones y observar tareas con personal real |

Referencias: [plan de beta](CLOSED_BETA_READINESS_PLAN_20260919.md), [matriz de agenda](CLOSED_BETA_AGENDA_MATRIX_20260926.md), [respaldo y restauración](DATABASE_BACKUP_AND_RESTORE.md) e [informe del frontend](../history/FRONTEND_CIERRE_AJUSTES_20261008.md).

El plan conserva secciones históricas de Neon. Su tabla vigente y la actualización de migración son las que deben guiar las decisiones: **no propongo contratar Neon ni reabrir ese proveedor**. La base activa es PostgreSQL en la VPS.

La publicación reciente documenta cero transacciones y cero productos de inventario en sus conteos de comprobación. Eso permite verificar que el despliegue preservó datos, pero no demuestra uso comercial significativo de esas áreas. No encontré en la evidencia revisada métricas suficientes de clientes de pago, retención o coste de atención.

## 5. Cómo evaluar éxito sin engañarnos

Recomiendo continuar el plan existente y, cuando sus condiciones permitan el piloto, observar inicialmente un establecimiento con alcance explícito. La decisión de mantener por ahora el número de prueba se respeta.

Medir durante el piloto:

1. **Fiabilidad de agenda:** solicitudes que terminan en una cita correcta, errores de fecha/hora/servicio, conflictos y cancelaciones efectivas.
2. **Respuesta del asistente:** mensajes perdidos, fallos de entrega, tiempo de respuesta y necesidad de intervención humana. Un trabajo `done` no demuestra por sí solo que el cliente recibió una respuesta correcta.
3. **Uso diario:** tareas y perfiles que utilizan cada módulo; operaciones que todavía se hacen por fuera de la plataforma y por qué.
4. **Tiempo ahorrado:** comparar tareas concretas antes y después, incluyendo capacitación y corrección de errores.
5. **Integridad operativa:** diferencias de caja, cobros duplicados, existencias incorrectas y capacidad de recuperar un intento incierto.
6. **Coste por establecimiento:** infraestructura atribuible, IA, mensajería, almacenamiento, comisiones aplicables y horas de soporte.
7. **Valor comercial:** disposición a pagar y, cuando exista una oferta autorizada, renovación y permanencia a 30, 60 y 90 días.

Una aproximación útil al margen es:

```text
Ingreso neto mensual por establecimiento
− coste atribuible de infraestructura, IA y mensajería
− otros costes variables aplicables
− coste del tiempo de soporte
= contribución disponible para mantenimiento, ventas y beneficio
```

No es un resultado financiero calculado: faltan importes reales. Tener una VPS propia elimina la dependencia anterior de la cuota de Neon, pero conserva costes de operación y servicios externos. WhatsApp publica una estructura de precios con categorías y excepciones; conviene medir los mensajes efectivamente facturables, no asumir que toda comunicación tiene el mismo coste. [Precios oficiales de WhatsApp Business Platform](https://whatsappbusiness.com/products/platform-pricing/).

Si el personal usa el sistema, ahorra tiempo y el ingreso cubre soporte y operación, habrá señales comerciales favorables. Si necesita asistencia constante o sigue trabajando fuera de él, debemos corregir esas fricciones antes de ampliar módulos o clientes.

## 6. Qué necesitaría para permanecer diez años

- **Clientes que permanezcan:** resolver problemas recurrentes y mantener una relación de soporte sostenible.
- **Datos recuperables:** respaldo independiente, restauraciones ensayadas y objetivos explícitos de tiempo de recuperación y pérdida máxima tolerable de datos.
- **Mantenimiento continuo:** actualizar dependencias y APIs, conservar pruebas de regresión y revisar permisos y tratamiento de datos.
- **Conocimiento transferible:** otra persona debería poder desplegar, recuperar y diagnosticar con la documentación, sin depender de una sola persona.
- **Disciplina de alcance:** priorizar necesidades demostradas y reducir fricción; cada módulo añade mantenimiento y soporte.
- **Margen suficiente:** financiar mantenimiento y atención sin depender permanentemente de trabajo gratuito del equipo.

No estoy proponiendo nuevas fases ni una nueva arquitectura. Son condiciones de gestión y operación para sostener las capacidades ya construidas. La arquitectura permite avanzar; la permanencia se validará con resultados repetidos, no con una promesa sobre 2036.

## 7. Evidencia y límites de esta revisión

### Ejecutado hoy

Backend:

```text
node node_modules/jest/bin/jest.js --runInBand --silent
Exit: 0
Test Suites: 167 passed, 167 total
Tests:       1337 passed, 1337 total
Snapshots:   0 total
Time:        25.679 s
```

Frontend:

```text
node node_modules/eslint/bin/eslint.js .
Exit: 0
Sin diagnósticos.
```

Pruebas adicionales de unificación, continuidad y caja:

```text
node --test --test-reporter=tap scripts/product-unification.test.cjs scripts/workspace-continuity.test.cjs scripts/pos-cash.test.cjs scripts/pos-history.test.cjs scripts/operational-cash-query.test.cjs
Exit: 0
# tests 25
# pass 25
# fail 0
# cancelled 0
# skipped 0
```

El backend no declara comando de lint; no se presenta como ejecutado. Las pruebas aprobadas comprueban comportamientos cubiertos, no ausencia universal de errores.

### Evidencia previa utilizada

La certificación `2.45.0` documenta compilación, verificaciones con PostgreSQL desechable, recorridos y fallos simulados del frontend, lecturas protegidas y comprobación HTTPS de la VPS, con cola procesada y conteos preservados. Se usa como evidencia de esa publicación; **no volví a inspeccionar la VPS en esta revisión**.

Se consultaron los cuatro documentos fundacionales indicados por las instrucciones del proyecto y los cierres recientes. Se distinguieron diagnósticos anteriores, correcciones implementadas y certificación final para no reportar como pendientes errores que ya se corrigieron.

No se ejecutaron escrituras de negocio, envíos de WhatsApp, despliegues ni cambios de configuración. Tampoco se realizaron entrevistas, ensayos de carga, auditoría legal ni estudio de rentabilidad. Esta revisión deja un informe local; no cambia código ni redefine el roadmap oficial.

**Decisión recomendada:** continuar. La base justifica invertir en cerrar el piloto y medir resultados. La siguiente prueba de éxito es un establecimiento operando de forma fiable y valorando el servicio lo suficiente como para sostener su coste.
