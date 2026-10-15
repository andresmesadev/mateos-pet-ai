# Empleados operativos — cierre de implementación local

Fecha: **2026-10-15**, hora de Colombia. Versión local: **2.47.0**. Se completó la primera entrega aprobada del Asistente Financiero y del Asistente de Administración e Inventario. Este informe no certifica despliegue, migraciones en una base real, activación de empleados en producción ni envíos externos.

## Autorización y alcance

El responsable aprobó expresamente las cinco etapas en esta conversación: [definición funcional](../architecture/digital-employees-functional-definition.md), [ocho casos de uso](../architecture/digital-employees-use-cases.md), [arquitectura](../architecture/digital-employees-technical-design.md), [persistencia](../architecture/digital-employees-persistence-model.md) y [esquema físico](../architecture/digital-employees-physical-schema.md). La última respuesta fue «Aprobar Etapa 5 e implementar». El despliegue conserva autorización separada.

| Empleado | Capacidad entregada |
| --- | --- |
| Financiero | Consultar historial, cierre existente y período oficial; preparar, corregir, descartar y confirmar gastos. Una consulta no genera cierres ni períodos. |
| Administración e Inventario | Buscar productos y alertas; consultar detalle, lotes, vencimientos y movimientos; preparar, corregir, descartar y confirmar entradas. |

La pantalla `/dashboard/assistants` permite registrar cada especialización mediante el caso de uso de Empleados Digitales existente, elegir empleado y tarea, describir una solicitud o completar un formulario, revisar su propuesta y confirmar por separado. El producto se selecciona del catálogo. La atención se recupera al recargar; se conservan referencias locales por Tenant y operador, sin guardar el contenido financiero completo en el navegador.

Recuperación de Clientes conserva su definición para una entrega posterior. No se amplió esta entrega a campañas, operaciones clínicas, agenda ni tareas manuales todavía no identificadas.

## Arquitectura y garantías comprobadas

- Continúa el contexto Empleados Digitales y sus entidades Tarea/Decisión. Los asistentes invocan Finanzas e Inventario; no implementan otra contabilidad ni otro inventario. Tenant sigue siendo la única unidad de aislamiento.
- Identidad y alcance provienen del operador autenticado. Se revalidan permisos, sesión, módulos y estado del empleado. Una consulta protegida mantiene el bloqueo de autoridad durante la lectura y conserva la huella de los permisos con que se obtuvo; un cambio de rol invalida su recuperación.
- El modelo solo extrae una intención del catálogo cerrado y sus campos. No recibe herramientas de confirmación. La ausencia o fallo del proveedor ofrece el formulario; no autoriza una escritura.
- Solicitud UUID, entrada canónica, revisiones inmutables, revisión esperada y recibo único impiden duplicar efectos al repetir peticiones. Una entrada verifica también que el payload observado coincide con la revisión bloqueada, antes de modificar stock.
- Gasto/entrada, decisión, cierre de tarea, recibo e intenciones de evento se guardan atómicamente. Los fallos posteriores a la ejecución del dominio revierten todo el conjunto. Un recibo confirmado puede recuperarse después de pausar al empleado, siempre bajo los permisos actuales del operador.
- Registrar/anular gastos y generar cierre comparten barrera por Tenant y día civil, con transacción Serializable y reintento del conjunto. El cierre no puede omitir silenciosamente un gasto concurrente. Los eventos de los comandos humanos afectados se publican después del commit.
- El worker de intenciones certifica con ID estable, lease y generación. La notificación se reclama una sola vez; un resultado incierto exige revisión y no se reenvía automáticamente. El retry genérico excluye los eventos gestionados por estas intenciones. No se promete entrega externa exactamente una vez.
- Las conexiones Prisma fijan explícitamente UTC, conservando otras opciones de conexión. La prueba adicional reprodujo que el adaptador instalado pierde el desplazamiento al leer `timestamptz` en una sesión no UTC. Se corrigió la configuración del pool y se comprobó contra una URL que solicita Bogotá. Otra prueba SQL verifica la comparación del trigger bajo una sesión Bogotá. Esto no cambia la zona civil ni las reglas de Agenda.
- Se conservan las reglas existentes de dinero, permisos, precios, lotes y stock. No se modificó el motor conversacional de WhatsApp ni el comportamiento de Recepcionista/Coordinador de Agenda.

## Persistencia y migraciones

Se integraron cinco tablas de soporte en el esquema activo: `OperationalRequest`, `OperationalAction`, `ActionRevision`, `ExecutionReceipt` y `PublicationIntent`. Se conservan los campos y relaciones de los modelos anteriores. Hay claves compuestas de alcance, restricciones diferidas para la coherencia del grafo, revisiones/recibos inmutables y controles de enlace con auditoría y eventos.

Migraciones nuevas, en orden:

1. `20261014180000_operational_assistant_storage`: tablas, índices y relaciones aditivos.
2. `20261014181000_operational_assistant_guards`: checks y triggers de coherencia e inmutabilidad.
3. `20261014182000_operational_assistant_event_catalog`: tipos existentes requeridos, sin reactivar los deshabilitados.
4. `20261015100000_operational_assistant_timestamp_guards`: coherencia de tareas de consulta y comparación UTC explícita con las fechas históricas de eventos.

La secuencia completa se aplicó en PostgreSQL/pgvector desechable, enlazado solo a `127.0.0.1:55432`, base `operational_test`. La base de desarrollo habitual y el VPS no recibieron migraciones. Se ejecutaron `prisma validate` y `prisma generate` con Prisma 7.10.0. Para una publicación futura se necesita respaldo, aplicar esta secuencia completa antes de arrancar el backend y regenerar el cliente; `db push` no instala estos triggers.

## Validación real

Comandos ejecutados con Node 24.15.0; los tests SQL no cargan `.env` ni aceptan una URL de producción.

```text
Backend Jest: --runInBand --silent --json
exit: 0
Test Suites: 191 passed, 191 total
Tests:       1535 passed, 1535 total

node --test backend/tests/postgres/operational-assistants.test.cjs
tests 33 / pass 33 / fail 0

node --test scripts/operational-assistants-proxy.test.cjs
tests 8 / pass 8 / fail 0

npm --prefix frontend run lint
> eslint
exit: 0

npm --prefix frontend run build
Compiled successfully
Finished TypeScript
Generating static pages (30/30)
exit: 0
```

También se verificaron 50 migraciones aplicadas desde una base vacía, los archivos JavaScript modificados con `node --check`, 920 enlaces documentales sin destinos rotos y las seis pruebas del comprobador documental. La base desechable se recreó tras detenerse Docker durante la sesión; la ejecución final de SQL pasó en el entorno nuevo, sin depender del historial anterior. Se retiraron el contenedor y el archivo de esquema temporal; los servidores y la pestaña de prueba no permanecen activos.

La suite SQL cubre peticiones y confirmaciones concurrentes, aislamiento Tenant/principal, revocación de sesión, cambio de rol durante una lectura, pausa durante la confirmación, revisión concurrente de inventario, deriva del producto, rollback integral, inmutabilidad, caducidad, reclamaciones vencidas, consultas sin efectos y carreras gasto/anulación/cierre en ambos órdenes. También verifica certificación estable, coherencia de fechas bajo distintas zonas de conexión y notificación incierta sin repetición.

La revisión inicial encontró huecos de concurrencia en la lectura autorizada y en el payload de inventario. Se corrigieron y se incorporaron regresiones SQL específicas, incluidas en el resultado anterior. Los hallazgos de lease y fechas históricas también se corrigieron. La verificación final es local; no se atribuye una aprobación posterior a un revisor independiente que no la emitió.

En el navegador se recorrieron autenticación, proxy y API reales sobre un establecimiento sintético: registrar ambos empleados desde cero, preparar y confirmar un gasto de prueba, recuperar su recibo al recargar, buscar «Guantes de prueba», preparar y confirmar tres cajas y recuperar su recibo al recargar. Las notificaciones se mostraron pendientes porque esta fixture no ejecuta jobs ni envía mensajes. [Captura de la recuperación](operational-assistants-local-20261015.jpg); los rótulos técnicos observados en esa captura se tradujeron posteriormente y la compilación final incluye esos ajustes.

## Límites y cierre

### Revisión adicional antes de commit, push y despliegue — 2026-10-15

El responsable pidió evaluar mejoras antes de publicar. Se aplicó una revisión de corrección, permisos, recuperación y despliegue sobre los cambios locales. Los ajustes conservan el alcance y la versión 2.47.0, todavía sin commit:

| Hallazgo o refuerzo | Corrección y evidencia |
| --- | --- |
| Una corrección podía leer la revisión 1 y, con un número esperado 2 y una actualización concurrente, combinar el payload viejo con la revisión 2. | Se compara la revisión y la huella del snapshot con la acción bloqueada antes de crear otra revisión. Regresión SQL verifica rechazo, conservación de la cantidad concurrente y corrección posterior válida. |
| El worker devolvía éxito si perdía su lease antes de la lectura protegida, aunque no certificara ningún evento. | Devuelve el resultado real de la transacción. Regresión SQL verifica `false`, ausencia de certificado y recuperación posterior con generación nueva. |
| El intérprete recibía el catálogo de ambas especialidades, aunque la aplicación ya rechazaba los cruces. | El esquema y la validación de salida se limitan ahora a la especialidad elegida. Quince pruebas con SDK sustituido cubren catálogo, falta de proveedor, refusals, JSON inválido, respuestas incompletas, identidad inyectada y ausencia de herramientas de ejecución. |
| Next.js puede construir su URL con el host interno del servidor detrás del reverse proxy. Compararla directamente con `Origin` podía rechazar las mutaciones legítimas del dashboard público. | Se usa el origen configurado por `AUTH_URL`/`NEXTAUTH_URL`, con fallback local, sin confiar en cabeceras para elegir el dominio permitido. Se mantiene el rechazo cross-site y la política `no-store` en la respuesta del proxy. Ocho pruebas del handler real comprueban ambos ajustes, autenticación y selección de Tenant. |

Resultado final de la revisión: 191 suites y 1.535 pruebas Jest, 33 pruebas SQL y 8 del proxy aprobadas; lint y build del frontend aprobados. No se añadieron especialidades, delegación automática entre empleados ni otra fase. Antes de producción sigue pendiente comprobar el dominio público configurado en el entorno de destino y hacer la prueba controlada del proveedor real, además del respaldo y las migraciones ya indicados. Commit, push y despliegue no se ejecutaron como parte de esta revisión.

La validación inicial no incluyó llamadas facturables ni envíos reales a clientes. Posteriormente, el responsable autorizó reutilizar la clave actual y se completó una [prueba interna con OpenAI real](PRUEBA_INTERNA_EMPLEADOS_20261015.md): 12 controles aprobados, cuatro llamadas en el recorrido final y cero mensajes. Esa prueba también inyectó una desconexión HTTP después del commit y recuperó el recibo sin duplicar el gasto. La comprobación de navegador anterior verificó recuperación por recarga; no se atribuye a esa navegación la desconexión que se ejercitó después mediante HTTP.

La prueba real corrigió una brecha adicional del contrato: categorías y formas de pago escritas en español se devuelven ahora como códigos admitidos mediante enums compartidos con la validación. Se comprobaron importes colombianos y producto pendiente sin inventar ID. Después del ajuste volvieron a pasar las 191 suites/1.535 pruebas y las 33 pruebas SQL. Queda resuelta la prueba del proveedor que figuraba pendiente en la revisión anterior; la configuración del dominio público y la publicación siguen pendientes.

El backend no declara un comando de lint; la evidencia de lint corresponde al frontend. Las pruebas SQL emiten una advertencia deprecada del driver `pg` por consultas en curso dentro de transacciones; no provocó fallos en la versión instalada.

El cambio incorpora capacidades nuevas: se evaluó versionado y se incrementó `backend/package.json` y su lock de 2.46.7 a **2.47.0**. Salud toma la versión de ese mismo paquete. No se creó commit, tag, PR ni publicación en esta entrega. El Plan Maestro conserva su roadmap: la implementación corresponde a las especializaciones aprobadas sobre los contextos existentes, sin declarar otra fase ni cerrar una fase por inferencia.

Queda habilitada una base comprobada para ampliar tareas cuando exista un caso funcional concreto y se apruebe su diseño. Esta entrega cierra únicamente los ocho casos indicados.
