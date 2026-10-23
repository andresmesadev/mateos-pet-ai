# Puesta en marcha de la veterinaria propia

**Preparado:** 16 de octubre de 2026. Completar la copia de trabajo fuera de Git. No registrar aquí personas, contactos, importes del negocio o evidencias de clientes: este repositorio es público.

Usar junto al [procedimiento del piloto](INTERNAL_PILOT_RUNBOOK.md). Las casillas vacías son decisiones pendientes, no valores asumidos. La primera jornada se habilita por áreas comprobadas; la venta del SaaS, Stripe y campañas no condicionan ese arranque.

**Seguimiento actualizado el 22/10:** consultar el [estado vigente de los diez ítems](CLOSED_BETA_STATUS_20261022.md).
La operación es real desde el lunes 19/10: clientes, citas de peluquería y
veterinaria, venta de medicamentos y registro de pagos. No se usan datos
ficticios para esas operaciones. Responsable/suplente, cuentas personales,
reporte presencial y comparación con registro habitual están confirmados; los
ingresos de la jornada revisada también. No volver a solicitar esas decisiones.
Las tablas y casillas siguientes son la plantilla privada para documentar lo que
falte y jornadas nuevas; no prueban por sí solas que se haya aceptado cada área.

**Alcance inicial del 16 de octubre, histórico:** agenda y recepción primero;
caja e inventario después. El catálogo/conteo/conciliación debía prepararse antes
de ampliar esas áreas. El alcance real posterior sustituye esa limitación de
arranque. Quedan comprobaciones específicas de stock/base/reportes, recuperación
y decisiones documentales; la historia clínica revisada se conserva en el
registro habitual confirmado, sin exigir duplicarla.

**Canal y datos de arranque:** solo dashboard, sin WhatsApp. La [base limpia del
16/10](DASHBOARD_ONLY_CLEAN_START_20261016.md) es el corte histórico de apertura;
después se cargaron datos y se registró operación real. No volver a vaciarla ni
reimportar para repetir ese arranque. Conservar las decisiones y fuentes privadas.

## Acta breve de la primera jornada

| Decisión | Valor privado que confirma el responsable |
| --- | --- |
| Establecimiento / tenant | Confirmar el establecimiento de la sesión, sin pegar su identificador en Git |
| Áreas incluidas y excluidas | Agenda/recepción; veterinaria; peluquería; caja; inventario: elegir expresamente |
| Responsable de operación / suplente | Cargos y personas; aceptación de ambos |
| Operadores y permisos | Cuenta personal por participante; sustituir accesos de ejemplo mediante Equipo → Acceso |
| Datos permitidos | Ficticios o categorías reales expresamente revisadas con el paquete aplicable |
| Inicio / fin / soporte | Fecha y horas Colombia; canal de soporte y persona disponible |
| Corte y fuente de verdad | Fecha/hora y registro que manda antes/después; evitar llevar cobros duplicados |
| Recuperación | RPO tolerable y RTO objetivo, contrastados con frecuencia y ensayo reales |
| Confirmación de apertura | Responsable, fecha y áreas efectivamente listas |

## Apertura de jornada

- [ ] Confirmar versión, salud y worker; revisar incidentes, cola y entregas pendientes.
- [ ] Confirmar último respaldo íntegro, copia independiente y ensayo de recuperación vigente.
- [ ] Entrar con cada cuenta personal y comprobar área, establecimiento y permisos. Conservar historial al reemplazar credenciales de ejemplo.
- [ ] Contrastar servicios, precios resueltos y horarios con el negocio; no cambiar horarios solo para que pase una prueba.
- [ ] Revisar citas y pendientes; identificar quién toma atención humana y recordatorios manuales si el canal automático no está certificado.
- [ ] Para caja/stock, conciliar y aprobar las hojas de apertura siguientes antes de registrar movimientos.
- [ ] Confirmar soporte disponible y condiciones de parada; si falta un área, excluirla expresamente de la jornada.

## Preparación de catálogo y apertura

Estas hojas son revisión manual; **no existe un importador nuevo ni se cargan filas automáticamente**. Mantener valores reales en la copia privada. Un saldo bancario o efectivo de apertura no se registra como una venta o gasto ficticio para cuadrar el sistema.

| Servicio | Categoría / área | Precio y excepciones | Duración | Horario / responsable | Revisado |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

| Producto / referencia única | Presentación / unidad | Usos / categoría | Precio / costo | Conteo físico / fecha | Lote / vencimiento si aplica | Aprobado |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

1. Revisar duplicados, unidades y política de lote antes de crear cada producto desde Inventario.
2. Registrar existencias físicas aprobadas mediante entrada y motivo de apertura; guardar referencia privada del movimiento. No volver a cargar el mismo lote/corte por un timeout.
3. Conciliar el total cargado contra conteo físico y movimientos. Los ajustes se hacen por operaciones trazables, sin alterar historia.
4. En caja, acordar qué cobros/gastos se empiezan a registrar desde el corte.
   Desde 2.55.0, confirmar la base de efectivo en Caja; no es ingreso. Al cerrar,
   registrar cuánto se deja; aparece como sugerencia para la siguiente apertura
   y debe confirmarse. No inventar saldos de jornadas anteriores ni registrar
   ventas/gastos ficticios para cuadrarlos. Conciliar bancos por separado.

## Recorrido de aceptación de los empleados

Desde **Asistentes**, comprobar primero consultas: Financiero → reporte/cierre y Administración e Inventario → búsqueda/detalle. Un catálogo vacío debe mostrarse vacío; no crear productos de demostración en producción para esta comprobación.

En el entorno aislado, ensayar un gasto y una entrada ficticios: preparar → revisar → corregir → confirmar → recuperar el mismo recibo. Repetir la confirmación sobre esa acción, nunca crear otra propuesta para simular reintento. Comprobar permisos con perfiles distintos y ausencia de doble registro. Las pruebas automatizadas existentes cubren SQL/concurrencia; el operador debe practicar además el recorrido visible.

El primer gasto/entrada real necesita los valores y confirmación del responsable de esa operación. El alta de los empleados no los autoriza a gastar ni a reponer stock solos. WhatsApp privado sigue siendo un ensayo separado.

## Cierre y decisión del día

- [ ] Contrastar citas atendidas, finalizadas, canceladas y pendientes con lo ocurrido; conservar responsable de cada discrepancia.
- [ ] Conciliar cobros/gastos por medio de pago y recibos; revisar resultados inciertos antes de repetir.
- [ ] Si aplica, conciliar ventas/consumos/entradas contra stock físico y lotes.
- [ ] Revisar mensajes fallidos/no entregados y recordatorios pendientes; asignar seguimiento humano.
- [ ] Registrar tareas terminadas, tiempos, ayuda requerida, errores y diferencias en la [hoja de medición](INTERNAL_PILOT_RUNBOOK.md#hoja-semanal-de-medición).
- [ ] Responsable y suplente deciden continuar, restringir un área o detenerla; registrar incidentes y su nueva comprobación.

**Detener el recorrido afectado** ante cita/cobro duplicado, reserva incorrecta, datos de otro establecimiento, pérdida de datos o resultado incierto sin recuperación. Preservar evidencia mínima y usar atención manual acordada. No borrar auditoría ni repetir escrituras para resolver la incertidumbre.
