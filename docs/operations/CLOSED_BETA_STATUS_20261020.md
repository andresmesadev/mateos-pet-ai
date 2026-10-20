# Beta cerrada de la veterinaria propia — estado al 20 de octubre de 2026

**Actualización posterior:** el responsable autorizó commit, push y despliegue.
El lote descrito abajo como local fue publicado en 2.53.0 el 20/10 a las 17:28
Colombia, con CI, respaldo, migración y lecturas autenticadas correctos.
[Certificación](../history/RELEASE_2_53_0_VPS_20261020.md).
Las capturas inferiores conservan el momento de la revisión anterior.
La ventana 2.52.0 quedó incompleta con 18,50236 horas y cero fallos/huecos;
la observación vigente corresponde a 2.53.0 y no certifica todavía 48 horas.
Se mantienen pendientes las aceptaciones operativas descritas para el paso 10.

Revisión solicitada antes de incorporar más cambios. Contrasta el plan de diez
pasos, las publicaciones, el trabajo local y lecturas productivas agregadas.
No modifica la aplicación, datos, servicios ni habilita canales.

## Conclusión

La operación supervisada del dashboard ya comenzó; su aceptación y cierre de
beta siguen pendientes. Al iniciar esta revisión, la documentación del 16 de
octubre todavía aplazaba Caja/Inventario y conservaba el acta sin completar,
mientras la VPS ya registraba citas, cobros, inventario y un cierre diario.
Posteriormente se confirmó y documentó la organización del paso 10, como se
detalla abajo. No confundir ese uso con una beta comercial externa aprobada ni
con estabilidad certificada.

## Los diez pasos originales

| Paso | Estado comprobado | Trabajo que permanece |
| --- | --- | --- |
| 1. Worker entrante | Cerrado históricamente: corrección publicada y regresiones conservadas. Hoy el worker está pausado por el alcance dashboard. | Su pausa no certifica procesamiento o entrega de mensajes nuevos. |
| 2. Capacidad de la base | PostgreSQL en VPS y ensayo ligero anterior aprobados. Ya existe uso del equipo. | Medir una jornada representativa con los operadores reales: tiempos, errores, concurrencia y recursos. No exigir un número arbitrario de participantes. |
| 3. Dependencias y runtime | Paso cerrado por actualización publicada y CI. No se modificaron dependencias en los ajustes locales actuales. | Conservar revisión de seguridad y CI en la próxima publicación; no se hizo un nuevo escaneo de vulnerabilidades en esta revisión documental. |
| 4. Observabilidad | Sentry/alertas configurados y comprobados según el plan. Salud HTTPS actual correcta; observador persistente activo. | Revisar incidentes durante uso real. Una lectura de salud no sustituye esa aceptación. |
| 5. Backup/restauración | Mecanismo cerrado previamente. Ejecución diaria VPS exitosa; copia independiente del 20 de octubre comprobada por tamaño y SHA-256. Restauración técnica del 16 de octubre aprobada. | Ensayar recuperación de una copia del esquema actual y practicarla con el suplente; acordar pérdida de datos/tiempo tolerables. No se ha restaurado la copia actual durante esta revisión. |
| 6. WhatsApp empresarial | Aplazado por decisión del responsable. La beta opera por dashboard; trabajador pausado. | Número real, habilitación y entregas se revisarán cuando se decida incorporar ese canal. No bloquea esta beta manual. |
| 7. Documentación del piloto | Paquete individual ficticio cerrado el 14 de octubre. | El anexo de operación propia/datos reales sigue en borrador y el acta privada sin completar. Contrastar documentos vigentes de la veterinaria y registrar el alcance efectivo; no afirmar que el paquete ficticio cubre automáticamente datos reales. |
| 8. Matriz de agenda | Cerrada el 13 de octubre; posteriormente se publicaron horario real, recepción cada 20 minutos, búsqueda propietario/mascota y flujo manual. Regresiones recientes aprobadas. | Aceptación dirigida con servicios, horarios y personas del centro; conservar los cierres anteriores, sin repetir toda la matriz desde cero. |
| 9. Estabilización | Ventana actual 2.52.0 en curso, 187 muestras y 15,502 horas, cero muestras fallidas y cero huecos al consultar. | Completar y revisar 48 horas continuas de la versión, más incidencias/carga. Las ventanas anteriores no certifican retrospectivamente esta versión. |
| 10. Jornada y aceptación | Registros productivos, cuentas personales y cierre del 19/10. Responsable/suplente, comparación con registro habitual y reporte presencial confirmados y documentados; ingresos conciliados con el responsable. | Aceptar recorridos clínicos/stock por perfil, conciliar existencias y completar los controles operativos restantes. Registrar resultados y decidir continuar/restringir/cerrar la beta. |

## Qué ya está publicado y se utiliza

- Alta y acceso personal, importación de propietarios/mascotas y sus teléfonos.
- Agenda manual con horarios del centro/área, turnos de peluquería cada 20 minutos,
  búsqueda por propietario o mascota y asignación del único peluquero.
- Finalización de atención separada del pago; carrito único con productos y
  adicionales; ingreso reconocido al confirmar en Caja.
- Contrato/porcentaje por profesional y check de reparto por servicio/área;
  cobros mixtos y corrección autorizada de las dos comisiones omitidas.
- Cierre oficial del día, reserva de comisiones, historial y stock vinculado a
  ventas/consumos. La reserva de comisión no es un desembolso al profesional.

La revisión agregada productiva constató 258 propietarios, 307 mascotas,
6 citas, 8 cobros activos pagados, ninguna obligación activa pendiente de pago,
8 productos y 12 movimientos. Un cierre oficial: 19/10/2026. Son conteos, no una
conciliación de exactitud de cada registro. No se publican identidades ni importes.

Hay una cuenta activa de administración y una de veterinaria. El perfil activo
de peluquería no tiene credencial propia; completar ese acceso solo si esa persona
va a operar el sistema. Su ausencia no impide que administración registre su trabajo.

## Qué está terminado en local y todavía no está publicado

1. Separación del menú y accesos rápidos en móvil.
2. Formato móvil del diálogo de cierre diario.
3. Inventario: existencias iniciales, corrección de cantidad/costo y retiro de
   productos equivocados sin borrar su auditoría. Migración 63 solo en desarrollo.
4. Ficha de cita de Agenda: cabecera compacta, estado único, datos/domicilio
   organizados y acciones fijas en escritorio y móvil.

Evidencia: [Inventario](../history/INVENTORY_REGISTRATION_LOCAL_VERIFICATION_20261020.md)
y [ficha de cita](../history/APPOINTMENT_DETAIL_LAYOUT_LOCAL_VERIFICATION_20261020.md).
Último recorrido conjunto: 57 comprobaciones de navegador aprobadas; 166 helpers;
lint y compilación correctos. Inventario: 45 comprobaciones PostgreSQL; backend:
214 suites y 1.766 pruebas, según sus verificaciones. Estos resultados locales
no convierten el lote en una publicación productiva.

## Comprobación actual de operación y respaldo

- VPS en commit `472bd06`, checkout limpio y versión HTTPS 2.52.0, HTTP 200,
  base `ok`. Backend/frontend en ejecución, cero reinicios.
- Observador activo. Serie iniciada el 19/10 a las 22:53:04 Colombia; última
  muestra revisada el 20/10 a las 14:23:11. Solo modo `paused` del trabajador.
  Fin previsto de 48 h: 21/10 a las 22:53, condicionado a continuidad y revisión.
- Servicio de backup con `Result=success` y `ExecMainStatus=0`; timer activo.
  Copia independiente de `20261020T081344Z` recibida a las 03:35 Colombia:
  cifrada, 475.782 bytes, tamaño y SHA-256 coincidentes con recibo/checksum.
- La lectura de la tarea programada de Windows dio acceso denegado en el
  contexto de herramientas. No se usa ese intento como evidencia de ejecución;
  la copia recibida hoy y su integridad sí fueron comprobadas directamente.
- No se modificó producción ni se realizaron cobros, cierres, mensajes o
  movimientos durante esta revisión.

## Próximo orden de trabajo

**Avance posterior del paso 10, confirmado el 20/10:** responsable y suplente
definidos privadamente; pruebas supervisadas con ambas cuentas, reporte de fallos
presencial al responsable en el centro y comparación con el registro habitual.
Ingresos del 19/10 confirmados por el responsable. La consulta revisada fue real
con historia en el registro habitual; no se duplicó. Se decidió conservar sin
ajustes el inventario histórico de esa jornada de prueba. La organización queda
documentada, pero faltan la aceptación del recorrido clínico en la aplicación y
un recorrido de stock operativo/conteo; el paso 10 sigue parcialmente abierto.
No se modificaron cobros, cierre, historia clínica ni existencias.

1. Conservar la organización ya confirmada en el acta privada; completar las
   decisiones de datos y recuperación pendientes sin volver a pedir responsables,
   suplente, canal de incidencias o comparación con el registro habitual.
2. Contrastar una jornada con registros del centro: citas/atenciones, cobros y
   métodos de pago, servicios/profesionales/comisiones, cierre e inventario físico.
   Distinguir las correcciones detectadas de lo que ya fue aprobado.
3. Lote publicado en 2.53.0 tras autorización, versión y 63 migraciones
   verificadas; nueva ventana activa y serie anterior conservada. Continuar su
   observación sin reiniciar las demás comprobaciones cerradas.
4. Completar la medición/estabilidad y el ensayo actual de recuperación con el
   suplente. Registrar la decisión de aceptación; WhatsApp y venta a otros centros
   siguen siendo decisiones posteriores separadas.

Fuentes: [plan original](CLOSED_BETA_READINESS_PLAN_20260919.md),
[revisión propia](OWN_CLINIC_BETA_REVIEW_20261016.md),
[hoja de jornada](OWN_CLINIC_STARTUP_WORKSHEET.md),
[runbook](INTERNAL_PILOT_RUNBOOK.md),
[publicación 2.52.0](../history/RELEASE_2_52_0_VPS_20261019.md).
