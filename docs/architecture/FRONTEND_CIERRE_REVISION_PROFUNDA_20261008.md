# Revisión profunda para cerrar las mejoras generales del dashboard

Fecha de la revisión: 8 de octubre de 2026, hora de Colombia.

## Decisión propuesta

**Propongo completar cuatro bloques finales y después cerrar esta ronda de mejoras.** La estructura del dashboard y los recorridos normales cuentan con verificaciones; el diagnóstico encontró pendientes en la recuperación ante fallos, la revisión de pagos y dos formularios.

Estos bloques completan capacidades existentes. Su alcance respeta el aislamiento por establecimiento, los permisos actuales, la inmutabilidad de los registros financieros y la resolución central del precio. No requieren nuevos módulos del producto.

## Qué se revisó

- Inventario de 153 archivos de componentes y utilidades del dashboard; identificación de 58 archivos con solicitudes `fetch`. Este inventario orienta la búsqueda y no equivale a una revisión línea por línea de todos esos archivos.
- Lectura dirigida de formularios financieros, carga de historia clínica y seguimientos, edición del precio de citas, recuperación de solicitudes y autorización.
- Reproducción en navegador de respuestas incompletas, resultado incierto, latencia y fallo de lecturas auxiliares, usando un servidor de prueba.
- Revisión del acceso a cobros pendientes al cambiar de día o superar el límite de movimientos.
- Regresión de recorridos normales y pruebas de permisos, módulos y conservación del espacio de trabajo.

Las reproducciones usan respuestas controladas y no alteran datos del negocio ni envían mensajes. No demuestran que los errores simulados hayan ocurrido en la VPS.

## Hallazgos y orden de trabajo

### 1. Guardados con un límite de espera y un resultado comprobable

**Prioridad alta para la recuperación; prioridad media para validar la respuesta.**

Hay tres comprobaciones relacionadas:

1. **Espera sin límite propio.** Manteniendo pendiente la solicitud de «Revisar pago» durante 21 segundos, el formulario continúa bloqueado, sin una explicación de demora ni una acción de recuperación. El componente y el proxy no establecen un plazo de solicitud. La prueba demuestra el bloqueo durante ese intervalo; la lectura del código confirma la ausencia de un límite de aplicación.
2. **Confirmación con una respuesta incompleta.** Una respuesta HTTP 200 con `{}` cierra el formulario y anuncia que el método de pago quedó confirmado. Se comprueba el estado HTTP, pero no el contenido del cobro guardado.
3. **Reenvío tras un resultado incierto.** Después de un HTTP 503 se permite otro POST inmediatamente. Falta comprobar primero el estado persistido del cobro. La prueba no muestra duplicación de dinero: el comando existente actualiza la revisión del cobro. El riesgo demostrado es repetir una operación cuyo resultado aún se desconoce.

**Evidencia del código:**

- `frontend/components/dashboard/pos/review-payment-dialog.tsx:42`: solicitud sin plazo; en las líneas 47–48 basta `response.ok` para ejecutar `onSaved`.
- `frontend/app/api/proxy/dashboard/[...path]/route.ts:94`: solicitud al backend sin señal de cancelación ni plazo propio.
- `backend/src/contexts/finance/application/use-cases/pos/settle-system-charge.usecase.js`: comportamiento existente de revisión de método y notas; se conserva su contrato de negocio.

**Ajuste propuesto:** establecer plazos coherentes, preservar el contenido del formulario, distinguir error confirmado de resultado incierto y consultar el cobro antes de ofrecer otro guardado. Validar identidad, importe y método de la respuesta antes de anunciar éxito. Reutilizar los patrones de recuperación ya presentes en ventas e inventario.

Abortar la espera del navegador no prueba que el servidor haya cancelado la escritura. Esa situación debe pasar a «resultado por comprobar», con una consulta de recuperación.

**Criterio de cierre:** una demora o desconexión ofrece un estado comprensible; una respuesta incompleta no anuncia éxito; un resultado incierto se comprueba antes de repetir la escritura.

### 2. Poder revisar todos los cobros pendientes autorizados

**Prioridad alta: pendiente operativo que puede quedar sin una acción accesible.**

La caja operativa consulta únicamente los movimientos del día actual y limita la respuesta a los últimos 200. «Revisar pago» está disponible en esa pantalla. El historial permite identificar cobros «Por revisar», pero remite al usuario a Caja diaria y no incorpora el editor de revisión.

Por tanto, el recorrido disponible no permite recuperar desde esas pantallas un cobro pendiente de un día anterior o que haya quedado fuera de los últimos 200. Los conteos de esa lista también pueden dejar fuera pendientes; la pantalla sí avisa que sus importes corresponden a los movimientos cargados.

**Evidencia del código:**

- `backend/src/routes/dashboard/access.routes.js:63`: ruta `/cash/operational`; filtro diario en la línea 67 y `take: 200` en la línea 69; pendientes calculados sobre esa lista en la línea 74.
- `frontend/components/dashboard/pos/operational-cash.tsx:69`: aviso del límite; editor de pago en la línea 72.
- `frontend/components/dashboard/pos/transaction-history.tsx:121`: instrucción de revisar cobros en Caja diaria. La búsqueda completa del componente `ReviewPaymentDialog` confirma que su consumidor operativo está en caja.

Este hallazgo está confirmado por lectura del código y comprobación automatizada de sus restricciones. No se crearon 201 cobros reales ni se modificaron fechas de datos del negocio.

**Ajuste propuesto:** completar la consulta operativa de pendientes con acceso a fechas anteriores y paginación; ofrecer la revisión desde el historial a quien tenga autorización. Los totales deben indicar claramente su alcance. Mantener el permiso de caja de recepción y los límites de acceso a reportes y finanzas.

El flujo debe respetar los cierres oficiales y la auditoría existentes: corregir el acceso al pendiente no autoriza a reescribir movimientos cerrados ni a recalcular ingresos históricos.

**Criterio de cierre:** un cobro pendiente de ayer y uno fuera de la primera página son localizables y revisables mediante el recorrido autorizado, con conteos coherentes.

### 3. Completar los estados de seguimientos y el guardado del precio

**Prioridad media: dos errores reproducidos en formularios existentes.**

**Seguimientos clínicos:** si la historia clínica carga correctamente pero la consulta de próximas acciones responde HTTP 503, el registro aparece normal y las acciones quedan representadas por una lista vacía. Al abrir su gestión tampoco aparece el aviso de fallo de esa lectura.

- Evidencia: `frontend/components/dashboard/vet-record-sheet.tsx:250` inicializa la lista vacía; en la línea 300 solo procesa la lectura cuando `actionsRes.ok`, sin un estado visible para la respuesta fallida.
- Ajuste: distinguir «cargando», «sin seguimientos» y «no se pudieron cargar». Reintentar únicamente esa sección y conservar el contenido de la consulta clínica.
- Cierre: una respuesta fallida no se presenta como ausencia confirmada de seguimientos.

**Precio de una cita:** al guardar $50.000, el campo permanece editable durante la espera. Si se escribe $55.000 antes de recibir la respuesta, termina guardándose el primer importe y se cierra el editor, perdiendo el segundo valor escrito.

- Evidencia: `frontend/components/dashboard/appointment-detail-dialog.tsx:104` envía el importe capturado; la línea 109 cierra el editor; el campo de la línea 141 permanece habilitado mientras los botones sí se bloquean.
- Ajuste: bloquear los campos del formulario durante el guardado, conservarlos ante un error y validar la respuesta antes de cerrar. Mantener la tarifa acordada por mascota y el resolutor de precio existentes.
- Cierre: el usuario no puede modificar un importe que el formulario ya está enviando; un fallo conserva el valor preparado.

### 4. Una comprobación final con criterios finitos

**Prioridad de cierre: completar evidencia, corregir los hallazgos y publicar una única entrega.**

Después de los tres bloques anteriores:

1. Convertir las reproducciones de este diagnóstico en pruebas que exijan el comportamiento corregido.
2. Probar pagos antiguos y paginados, latencia, respuestas incompletas y consultas auxiliares fallidas.
3. Completar la comprobación HTTP de las combinaciones de áreas y permisos, incluyendo un permiso retirado durante un formulario abierto. Las pruebas unitarias ya cubren cuatro roles, siete combinaciones de módulos y permisos opcionales; esa cobertura no sustituye todos los recorridos reales de navegador y backend.
4. Repetir lint, pruebas de los recorridos afectados y compilación sobre el código actualizado.
5. Completar zoom real de Chrome y lector de pantalla. En la ronda anterior, la herramienta nativa de Windows no pudo iniciar en dos intentos. La comprobación automática de redistribución y contraste no certifica por sí sola esa experiencia manual.
6. Revisar documentación y versionado, y preparar commit, push y despliegue cuando se soliciten.

**Condición para cerrar:** los cinco comportamientos reproducidos deben quedar corregidos, el acceso a pendientes antiguos y paginados debe comprobarse, y las verificaciones pendientes deben tener un resultado documentado. Después de cumplir esos criterios, se cierra esta ronda de mejoras generales.

## Evidencia ejecutada en esta revisión

### Diagnóstico de fallos

Comando: `node scripts/audit-dashboard-closure.cjs`, con las dependencias de navegador del runtime local.

Resultado final: código de salida **0**. Cinco reproducciones de navegador y una comprobación del código:

```text
REPRODUCED: Payment shows confirmation for HTTP 200 with an empty object, without validating the saved transaction.
REPRODUCED: An uncertain payment response permits another POST directly; there is no check-result action. This test does not claim a duplicate charge.
REPRODUCED: A payment request held for 21 seconds still locks both actions and Escape without an explanatory timeout state.
REPRODUCED: A clinical next-actions HTTP 503 is silently represented by an empty list, while the saved record displays normally.
REPRODUCED: Appointment price remains editable while saving; a later typed value is lost when the earlier save closes the editor.
REPRODUCED: Source confirms operational cash is restricted to today and 200 rows; history can identify review-needed charges but has no review-payment editor.
Diagnostic findings reproduced: 6. Fixture-only responses, no business data or outgoing messages.
```

El código de salida 0 certifica que el diagnóstico reprodujo los problemas esperados; este script todavía no es una prueba de aceptación del producto corregido. Durante la preparación se ajustaron selectores y la interceptación de la solicitud de precio del servidor de prueba.

### Lint y pruebas unitarias

- ESLint completo del frontend: ejecución desde `frontend/`, código de salida **0**, sin diagnósticos. El primer intento desde la raíz no localizó la configuración; se corrigió el directorio de ejecución.
- Sintaxis de `scripts/audit-dashboard-closure.cjs`: código de salida **0**.
- `node --test scripts/product-unification.test.cjs scripts/workspace-continuity.test.cjs scripts/pos-cash.test.cjs scripts/pos-history.test.cjs`:

```text
tests 21
pass 21
fail 0
cancelled 0
skipped 0
```

### Regresión del navegador

Comando: `node scripts/verify-general-dashboard.cjs`, reutilizando la compilación aislada validada en la ronda anterior. Código de salida **0**:

```text
PASS: 17 module/section screens at 320 px, no horizontal overflow, HTTP 500 or browser runtime errors.
PASS: 17 module/section screens at 768 px, no horizontal overflow, HTTP 500 or browser runtime errors.
PASS: 17 module/section screens at 1440 px, no horizontal overflow, HTTP 500 or browser runtime errors.
PASS: receptionist available screens and finance privacy follow authenticated capabilities.
PASS: vet available screens and finance privacy follow authenticated capabilities.
PASS: groomer available screens and finance privacy follow authenticated capabilities.
PASS: cash failure is explicit and retry restores the screen, with no business writes.
PASS: zero business writes, zero external messages and all business-data reads tenant-scoped.
```

Son 51 comprobaciones de pantallas para administrador, además de los recorridos de recepción, veterinaria y peluquería. Se verificaron también la privacidad financiera, el fallo de carga de caja y su reintento. Las reproducciones especiales del diagnóstico anterior cubren fallos que esta regresión normal no simula.

## Relación con las comprobaciones anteriores

Validación documental de esta revisión: `node scripts/check-docs.cjs`, código de salida **0**; 280 documentos, 265 archivos Markdown y 713 enlaces comprobados, sin enlaces rotos, referencias faltantes, errores de catálogo ni duplicados exactos. `git diff --check` de los archivos de esta revisión terminó con código **0**, sin diagnósticos.

La ronda anterior verificó formularios secundarios, compilación e integración con PostgreSQL. Su evidencia está en [Formularios secundarios e integración](../history/FORMULARIOS_SECUNDARIOS_INTEGRACION_20261008.md). Esos resultados siguen siendo evidencia de los escenarios ejecutados; los fallos adicionales de esta revisión amplían los criterios de cierre.

## Estado del trabajo

El diagnóstico y sus reproducciones anteriores se conservan como antecedentes. El usuario aprobó ejecutar los cuatro bloques; su implementación, pruebas de aceptación y límites restantes están en [Ajustes de cierre del frontend](../history/FRONTEND_CIERRE_AJUSTES_20261008.md). No debe interpretarse el resultado de las reproducciones originales como el estado del código corregido.
