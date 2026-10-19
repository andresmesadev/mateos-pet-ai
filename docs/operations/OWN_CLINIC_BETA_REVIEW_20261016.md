# Revisión para beta operativa en la veterinaria propia

**Fecha:** 16 de octubre de 2026, Colombia. **Versión revisada:** 2.48.0, publicación certificada en `9ee264d`. **Alcance indicado por el responsable:** usar primero el sistema en su veterinaria y, después de comprobarlo allí, comercializarlo.

**Aplicación posterior autorizada:** consultar [cambios aplicados y pendientes](OWN_CLINIC_BETA_APPLICATION_20261016.md). Se registraron los dos empleados y comenzó la observación persistente. Las cifras y afirmaciones de solo lectura de esta revisión describen la captura anterior a esa aplicación.

**Dictamen:** preparado para organizar un ensayo supervisado del negocio. La apertura con datos y operaciones reales necesita completar los puntos de puesta en marcha indicados abajo. Esta revisión no habilita una beta comercial externa ni certifica cumplimiento jurídico. No se activaron empleados, cambiaron cuentas, importaron datos, enviaron mensajes o ejecutaron operaciones productivas.

## Lo comprobado y lo que no debe repetirse desde cero

| Control | Evidencia al revisar | Implicación |
| --- | --- | --- |
| Publicación | 2.48.0; salud pública database/OpenAI/worker `ok`; contenedores saludables; [CI final aprobado](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38915754654) | Hay base técnica publicada; un HTTP 200 no acredita uso del equipo |
| Regresión | 195 suites/1.552 pruebas backend, 60 PostgreSQL de empleados, 13 de cola; Administración adicional 15 casos y CI aprobado | Conservar pruebas y cierres; añadir solo regresiones de hallazgos nuevos |
| Agenda, paso 8 | [Cierre del 13 de octubre](ASSISTANT_BOOKING_SAFETY_TRIAL_20261010.md) | No volver a presentar toda la matriz como nunca ejecutada; hacer un recorrido dirigido con la configuración real |
| Operadores | Dos credenciales Staff activas; el [ensayo previo](INTERNAL_PILOT_CAPACITY_TRIAL_20261013.md) usó cuentas de ejemplo autorizadas y administrador | No confundirlas con la asignación personal definitiva del equipo |
| Empleados | En la consulta productiva aparecen una Recepcionista y un Coordinador de Agenda activos; cero solicitudes operativas y cero vínculos privados | Financiero y Administración/Inventario están publicados, pero falta darlos de alta desde Asistentes y comprobar su uso con el responsable |
| Base operativa | Cero productos de inventario y cero transacciones financieras en la comprobación | Falta preparar catálogo/saldos/corte de operación si esas áreas entran en la beta; no inferir un negocio cargado a partir de pantallas disponibles |
| Cola | 244 trabajos `done/complete`, sin otros estados en la consulta | Procesamiento acumulado correcto; no demuestra 244 mensajes humanos ni todas las entregas |
| Recursos | Snapshot sin presión: backend ~194 MiB, frontend ~83 MiB, PostgreSQL ~61 MiB; CPU instantánea cercana a cero | No comprar infraestructura ni rediseñar el worker por este dato; tampoco presentarlo como capacidad bajo carga |
| Backup VPS | Servicio `success`, salida 0, timer activo; copia previa al despliegue del 16 de octubre verificada | Mecanismo vigente; no equivale a restauración ensayada de las 52 migraciones |
| Copia independiente | `mateos-pet-ai-20261016T081412Z`, checksum cifrado coincidente; tarea local 03:35, `LastTaskResult=0` | La copia independiente sí funciona. No inventar que falta por el rechazo de una copia manual adicional durante el despliegue |
| Estabilidad | Archivo de 2.46.7: 261 muestras, 21,6676 horas, cero fallos/huecos/reinicios; veredicto `incomplete` | No se completaron 48 h de esa versión. No hay una ventana nueva de 48 h para 2.48.0 |
| Privacidad | [Paquete 1.1](../legal/README.md) cerrado para participante individual, escenarios ficticios y sin atención/cobros reales | Revisar su alcance antes de trabajar con datos de propietarios, personal, historias o dinero reales |

La [publicación 2.48.0](../history/RELEASE_2_48_0_VPS_20261016.md) conserva las pruebas HTTPS y conteos antes/después. Esta revisión posterior fue de lectura y metadatos agregados, sin consultar conversaciones, contactos privados ni claves. La copia independiente se verificó localmente sin descifrar ni trasladar datos nuevos.

## Qué falta y qué modificar

| Prioridad | Trabajo concreto | Criterio de cierre | Tipo |
| --- | --- | --- | --- |
| Antes de datos reales | Revisar el aviso/política y condiciones que correspondan a la veterinaria; finalidad, responsables, acceso del equipo, proveedores y conservación | Documentos aplicables al alcance real, medio de información y decisiones/evidencias que correspondan; revisión del responsable y asesoría jurídica cuando proceda | Ajuste operativo/documental; no rehacer identidad/contactos ya guardados privadamente |
| Antes de empezar una jornada | Completar responsables, suplente, operadores, soporte, horarios y áreas incluidas | Acta breve con personas reales y alcance aprobado; cada operador ingresa con su propia cuenta y comprueba permisos | Configuración y coordinación |
| Antes de usar caja/stock | Preparar servicios, precios, productos y existencias de apertura; fijar desde qué fecha/corte se registra y cuál será la fuente de verdad | Cifras de apertura conciliadas por el negocio, sin mezclar registros de ensayo o duplicar cobros | Configuración y carga controlada; cualquier importación requiere su alcance y autorización |
| Antes de usar empleados nuevos | Registrar Financiero y Administración/Inventario en Asistentes con el responsable; un gasto y una entrada ficticios en un entorno de ensayo, luego uso real supervisado autorizado | El equipo entiende propuesta, corrección, confirmación, recibo y recuperación; no hay doble registro | Usar las capacidades publicadas; no añadir otro agente |
| Para cerrar estabilidad | Ejecutar una ventana nueva de 48 h sobre 2.48.0 y revisar cola, entregas, errores y tráfico representativo | Serie continua de una versión, sin errores/reinicios/huecos bajo los criterios existentes; evidencia de entregas y uso, no solo salud | Operación; preservar todas las ventanas anteriores |
| Para recuperación actual | Ensayar restauración aislada de una copia posterior a las 52 migraciones y revisar el procedimiento de privacidad frente a solicitudes/revisiones/auditoría nuevas | Restauración comprobada, relaciones íntegras, resultado documentado; solicitudes resueltas no reaparecen al restaurar | Ensayo acotado, con destino y tratamiento de la copia autorizados |
| Para decidir capacidad | Probar la carga del equipo y remitentes realmente acordados mientras usan agenda/bandeja/caja | Registrar identidades distintas, latencia, entregas, backlog, errores y recursos en ese alcance | No exigir cinco remitentes si no representan el negocio; no cerrar el paso por una simulación |
| Antes de operar sin acompañamiento | Un recorrido de jornada con responsables de recepción, atención y caja | Cita correcta → atención → registro/cobro → stock si aplica → conciliación/cierre; incidencias y correcciones trazables | Aceptación humana del flujo existente |

El acuerdo ficticio actual dice expresamente que no se presta atención ni se hacen cobros reales. Cambiar el nombre de la beta no modifica ese alcance. Los placeholders públicos protegen información privada y **no demuestran que falte identificar al responsable**. Tampoco conviene trasladar automáticamente la regla de treinta días tras cierre a historias, cobros y auditorías de operación real: revisar sus finalidades, obligaciones y excepciones. La [SIC](https://www.sic.gov.co/boletin-juridico-abril-2018/obligaciones-de-los-responsables-del-tratamiento-con-la-expedicion-del-decreto-090-de-2018) distingue el registro de bases de las demás obligaciones de políticas, autorizaciones cuando sean necesarias, procedimientos y seguridad. Se usa como orientación de revisión, no como certificación del caso concreto.

Los ensayos de privacidad/restauración del 14 de octubre preceden a las tablas operativas y privadas de 2.48.0. El fallo de CI por intentar borrar un Tenant auditado confirmó que las restricciones nuevas son efectivas. No quitar FKs ni borrar auditoría para facilitar una solicitud: probar su resolución acotada y su fundamento, conforme al procedimiento ya aprobado.

## WhatsApp: decidir por canal, sin frenar todo el dashboard

- Se conserva la decisión de no registrar por ahora un número empresarial. El número de Meta documentado sigue siendo de prueba; esta revisión no comprobó nuevamente sus cupos en el panel ni lo convierte en una línea apta para todos los clientes.
- El ensayo del dashboard del equipo puede prepararse mientras WhatsApp sigue limitado a destinatarios de prueba autorizados. No afirmar que el número de prueba sustituye la atención habitual de la veterinaria.
- Si el alcance incluye atender a propietarios reales por el bot, revisar la línea empresarial y su configuración con el responsable antes de cambiarla. No migrar ni desconectar el número actual a ciegas.
- Falta prueba real de recordatorios fuera de la ventana de atención con plantilla apta. La corrección actual evita marcar un recordatorio omitido como enviado. La ausencia de error del worker no significa que el cliente fue notificado. La [política de WhatsApp](https://whatsappbusiness.com/policy/) exige plantillas aprobadas fuera de las 24 h, permisos y caminos claros de atención humana. Si se aplaza ese recorrido, debe existir un responsable y alternativa manual explícita; no prometer recordatorios automáticos completos.
- Financiero y Administración/Inventario por WhatsApp permanecen apagados, con cero vínculos. No son condición para usar esos empleados desde el dashboard. Su activación debe ser un ensayo separado de vinculación, permisos, revocación y confirmación en la línea autorizada.
- Reactivación/campañas: la configuración de nombre/idioma de la plantilla de reactivación sigue ausente. Mantener ese recorrido fuera del alcance hasta verificar proveedor, permisos de destinatarios y recepción real.

## Qué quitar del alcance de esta primera beta

1. **Venta del SaaS, suscripciones/Stripe y expansión a otros negocios como condiciones de arranque.** No eliminar sus componentes ni sus controles de aislamiento; simplemente no hacer depender el piloto de su activación comercial.
2. **Nuevos agentes y autonomía adicional.** Primero medir Recepcionista/Agenda y los dos empleados operativos existentes. Conservar la confirmación humana de gastos y stock.
3. **Campañas y funciones que aún no tienen un envío real certificado.** No presentarlas como listas solo porque la interfaz o los tests responden.
4. **La obligación universal de cinco/diez participantes y pruebas repetidas sin objetivo.** Medir el alcance real acordado; conservar la evidencia aprobada y repetir solo recorridos afectados o necesarios para la jornada.
5. **Usar demostraciones como operación definitiva.** No borrar datos o fichas automáticamente; clasificar los registros de prueba y acordar el corte/carga con el responsable.

## Qué agregar o completar usando lo que ya existe

- **Acta de alcance de una página:** establecimiento, áreas, personas, datos reales permitidos, fecha de corte, responsable/suplente, soporte y condiciones para detenerse. La [guía existente](INTERNAL_PILOT_RUNBOOK.md) ya contiene campos; faltan sus valores reales.
- **Lista de apertura/cierre:** comprobar agenda/precios, atención humana disponible, pendientes, gastos, caja e inventario; revisar operaciones inciertas antes de repetirlas.
- **Medición de jornada:** tareas correctas, tiempos, ayuda requerida, costo de IA/mensajería/soporte, duplicados, diferencias de caja/stock y respuesta realmente entregada. Reutilizar la hoja existente, con objetivos acordados y sin recopilar datos personales innecesarios.
- **Observación que sobreviva al cierre del PC:** proceso persistente para las muestras acotadas y alerta externa existente. El workflow horario de salud ya sirve como alerta, pero no reemplaza una serie cada cinco minutos ni mide entrega de WhatsApp. No contratar otro proveedor por defecto.
- **Recuperación practicada por un suplente:** acordar RPO/RTO según el negocio y ensayarlos. Un backup diario no acredita recuperación en minutos ni pérdida máxima de unos pocos minutos.
- **Aceptación de uso real:** recorrido con teclado, zoom y pantallas del equipo, más tareas del día con cada perfil. No duplicar funciones para resolver un problema que puede ser de configuración o capacitación.

## Orden recomendado

1. Completar el acta y revisar el alcance de datos reales; elegir las áreas de la primera jornada.
2. Configurar cuentas personales, servicios/precios y, si aplica, inventario/caja; comprobar el recorrido con el equipo y los empleados del dashboard.
3. Ejecutar y revisar la nueva observación de 48 h, carga acordada y restauración actual; no abrir funcionalidades que aún no estén comprobadas.
4. Iniciar jornadas supervisadas en la veterinaria con registro de incidencias, conciliación diaria y soporte identificado. Ampliar áreas cuando sus resultados lo justifiquen.
5. Evaluar comercialización a otros negocios después de esos resultados; conservar esa decisión separada del arranque propio.

No se propone una fase nueva ni se reabren las fases cerradas. El cambio de foco es de preparación y alcance operativo del piloto. La revisión identifica tareas; no instala observadores, modifica documentos privados, cambia credenciales ni autoriza operaciones reales en nombre del equipo.
