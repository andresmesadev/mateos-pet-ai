# Huella Nex: resultado de la demostración técnica

**Fecha:** 30/10/2026. **Modalidad autorizada por Andrés:** solo demostración
técnica, sin participante externo. **Resultado:** 30 comprobaciones aprobadas,
0 fallos. No es un acta de aceptación de un cliente independiente.

## Qué se ejecutó

Se combinaron la incorporación guiada, los ciclos operativos de tres negocios
y el resumen de estado del servicio en una ejecución sobre PostgreSQL temporal.
Se usaron registro, autenticación, APIs, navegador y persistencia del candidato
local 2.58.3. Los datos, cuentas, productos y operaciones fueron sintéticos.

```text
node scripts/verify-onboarding-local.cjs --guided-business-setup --service-visibility
Onboarding integration: 30 passed, 0 failed.
PASS own temporary PostgreSQL container removed
Automated demonstration elapsed seconds: 59.8
```

Los **59,8 segundos** corresponden al proceso automatizado completo, incluidas
preparación, migraciones, navegador, capturas y limpieza. No son el tiempo que
tardaría un cliente en aprender ni el tiempo humano hasta la primera venta.

## Conciliación de los datos ficticios

| Actividad | Ingresos | Gastos | Comisión reservada | Saldo tras gasto y reserva | Stock final de su producto |
| --- | ---: | ---: | ---: | ---: | ---: |
| Veterinaria | $80.000 | $5.000 | $0 | $75.000 | 9 de 10 |
| Peluquería | $140.000 | $5.000 | $43.000 | $92.000 | 9 de 10 |
| Pet shop | $50.000 | $5.000 | $0 | $45.000 | 8 de 10 |
| Total de importes de la demostración | $270.000 | $15.000 | $43.000 | $212.000 | No se suman productos distintos |

Cada negocio abrió con $40.000 de base, separados del ingreso, y conservó
$20.000 para la siguiente jornada. En Veterinaria y Peluquería se descontó una
unidad por consumo; en Pet shop, dos por venta. Los valores del cierre y reporte
coincidieron con las operaciones esperadas del ensayo. No se compararon con
existencias físicas, dinero ni cuentas bancarias de un negocio real.

La comisión de peluquería se calculó con 30% sobre $90.000 ($27.000) y 40%
sobre una operación posterior de $40.000 ($16.000). El complemento directo de
$10.000 no generó comisión. Cambiar el contrato conservó la comisión original.
La reserva de $43.000 no se registró como entrega de dinero al profesional.

## Evaluación por tarea

| Tarea del procedimiento | Resultado técnico observado | Límite |
| --- | --- | --- |
| C1 Cuenta e ingreso | Registro por navegador del recorrido base y registro de los tres negocios por servicio; ingreso real NextAuth, revocación y rechazo de acceso ajeno. | No se observó a una persona completar el registro. |
| C2 Preparar negocio y equipo | Módulos propios, profesional/contrato cuando corresponde y navegación de guía; conservación de borrador y reintento de guardado tras error. | Parte de la configuración se preparó por API; no mide comprensión o administración humana de permisos. |
| C3 Catálogo, horarios y existencias | Servicios, turnos disponibles, producto con stock inicial y lote; guía adaptada, sin exigir agenda en Pet shop. | Datos de demostración; no se importó ni cotejó un catálogo real. |
| C4 Base y primera operación | Citas para servicios y venta sin cita en Pet shop; efectivo, transferencia y mixto en sus casos. Repetir con la misma clave no duplicó la operación. | La creación operacional usa APIs autenticadas; no demuestra que todas las tareas se hayan completado mediante formularios. |
| C5 Historial y consulta | Reporte/historial financiero y persistencia del cierre tras recargar. | El diálogo de comprobante no se volvió a abrir en esta combinación; su verificación previa figura en la revisión del punto 4. No se evaluó la capacidad humana para localizarlo. |
| C6 Conciliación y cierre | Importes, comisiones y existencias coincidentes; rechazo de cierre duplicado y de modificar la base de una jornada cerrada. | Conciliación contra valores sintéticos conocidos; no sustituye conteo físico ni validación del cliente. |
| C7 Contingencia y soporte | Estado del servicio visible; error 503, respuesta con tenant ajeno, reintento y recuperación; cupo agotado y sondeo fallido diferenciados. | No hubo práctica verbal de una persona ni incidente real atendido por soporte. |

También se verificaron seis rechazos de inventario ajeno, cero errores de
navegador y cero solicitudes externas. La guía se comprobó en 320, 390, 768 y
1440 px; el resumen de estado en 320, 390 y 1440 px. Las respuestas de salud
fueron señales sintéticas: no se contactó a OpenAI ni a Meta.

## Evidencia y alcance de la conclusión

Resultados y capturas sintéticos: `.cache/external-business-demo/`, incluyendo
`business-cycles.json`, guía, cierre por actividad y estados de servicio.
El contenedor temporal propio se eliminó; se conservó el contenedor local de
desarrollo. Solo se ajustó la ruta de salida del arnés para separar esta
demostración de las evidencias anteriores. No cambió el código del producto.

Referencias de comprobaciones anteriores, no repetidas como resultados nuevos:
[configuración y comprobantes](HUELLA_NEX_TENANT_CONFIGURATION_REVIEW_20261030.md),
[soporte y salida](HUELLA_NEX_SUPPORT_LIFECYCLE_REVIEW_20261030.md) y
[visibilidad](HUELLA_NEX_SERVICE_VISIBILITY_REVIEW_20261030.md).

**Dictamen:** demostración técnica satisfactoria en el alcance ejecutado.
Tiempo humano, ayuda requerida por el participante, satisfacción, intención de
continuar y aceptación de precio: **no medidos**. BETA-07 conserva pendiente la
evaluación con un negocio externo. No se activaron proveedores ni se importaron
datos reales; no se hizo commit, push, despliegue o apertura de beta.
