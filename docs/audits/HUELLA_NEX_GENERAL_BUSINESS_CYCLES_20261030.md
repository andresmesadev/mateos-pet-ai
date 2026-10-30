# Huella Nex: ciclos operativos por actividad

**Fecha:** 30/10/2026, Colombia. **Estado:** verificación local aprobada.
Corresponde al punto 1 de la revisión del software general solicitada por Andrés.
No declara abierta la beta externa ni acredita una publicación en producción.

## Alcance y resultado

Se crearon tres establecimientos sintéticos independientes, cada uno con un
único módulo activo. Se reutilizaron registro, autenticación NextAuth, proxy
autenticado, adaptadores HTTP, casos de uso y PostgreSQL reales. No se copiaron
precios, clientes, contratos ni credenciales de Mateos Pet.

| Negocio de demostración | Operación | Ingresos | Gastos | Comisión reservada | Saldo tras reserva |
| --- | --- | ---: | ---: | ---: | ---: |
| Veterinaria exclusiva | Consulta, profesional fijo, consumo de una unidad de insumo y pago por transferencia | $80.000 | $5.000 | $0 | $75.000 |
| Peluquería exclusiva | Servicio de $90.000 al 30%, complemento directo de $10.000 y posterior servicio de $40.000 al 40%; pago mixto y efectivo | $140.000 | $5.000 | $43.000 | $92.000 |
| Pet shop exclusivo | Venta de dos unidades de $25.000, sin cita ni cliente obligatorio; $20.000 efectivo y $30.000 transferencia | $50.000 | $5.000 | $0 | $45.000 |

Los tres comenzaron con diez unidades y una base de caja de $40.000. Veterinaria
y peluquería terminaron con nueve unidades por consumo; el pet shop con ocho
por venta. La base no se contó como ingreso. Cada cierre conservó $20.000 como
efectivo para la siguiente jornada.

En peluquería, la comisión original de $27.000 permaneció inmutable después de
cambiar el contrato al 40%; la nueva operación generó $16.000. El complemento
marcado directo no generó comisión. No se impuso 50/50 como regla global.

Se verificaron además:

- Registro de administrador, inicio de sesión, módulo y horario propios.
- Alta de propietario y mascota, reserva, llegada, atención y finalización.
- Alta de productos con existencia inicial y lote/vencimiento.
- Repetición de operaciones con la misma clave sin duplicar producto, consumo,
  venta, salida de inventario ni cobro.
- Cierre oficial, reporte conciliado, persistencia tras recargar y rechazo de
  segundo cierre o modificación de la base cerrada.
- Sugerencia del efectivo retenido mediante el repositorio real. El endpoint
  rechaza consultar una apertura futura; no se cambió el reloj del computador.
- Seis intentos de leer productos de otro establecimiento, todos rechazados.
  Los tres pudieron reutilizar el mismo código interno de producto.
- Caja en navegador a 390 y 1440 píxeles sin desbordamiento horizontal, y cero
  errores JavaScript en las páginas de los tres negocios.

Una primera configuración del ensayo intentó asignar uso `retail` a productos
sin ese módulo activo: el sistema la rechazó correctamente. El ensayo final
usa consumos de insumos en Veterinaria/Peluquería y ventas en Pet shop. Vender
productos además de prestar servicios requiere habilitar también ese módulo;
no se eludió la autorización para hacer pasar la prueba.

## Defecto encontrado y corrección

Al completar una cita, el evento `CitaCompletada` se persistía dentro de la
transacción del comando. La evaluación de automatizaciones recibía ese contexto,
pero lo perdía al registrar su entrega. La escritura mediante el cliente global
no veía todavía el evento sin confirmar y fallaba por clave foránea. Los importes
y el cierre coincidían, pero faltaba la constancia de entrega.

Se corrigió la propagación opcional de `ctx` desde el evaluador, su puerto y
adaptador hasta el mecanismo y repositorio de entregas. El repositorio usa
`ctx.tx` cuando existe y conserva el cliente habitual para invocaciones aisladas.
No se modificaron reglas de precios, contratos, inventario, motor conversacional,
tablas ni migraciones.

La prueba PostgreSQL reproduce el recorrido completo y exige una entrega exitosa
por evento de cita. También fuerza un rollback después de comprobar la entrega
dentro de la transacción: fuera de ella no quedan ni evento ni entrega. Tres
pruebas unitarias cubren la propagación en éxito/fallo y la llamada aislada.

Es una corrección de infraestructura existente, no un nuevo entregable de fase.
Su definición funcional es conservar la trazabilidad del comando; el caso de uso
sigue siendo Completar Cita; la arquitectura mantiene los puertos existentes;
persistencia y esquema físico no cambian. La versión candidata local ya es
2.58.3; no se creó tag ni publicación con esta validación.

## Evidencia de ejecución

Comando reproducible, usando Node 24 y Playwright disponibles en `NODE_PATH`:

```text
node scripts/verify-onboarding-local.cjs --general-business-cycles
Onboarding integration: 18 passed, 0 failed.
PASS own temporary PostgreSQL container removed
```

La ejecución aplica todas las migraciones desde PostgreSQL vacío y comprueba
ausencia de diferencias frente al esquema Prisma. El contenedor es exclusivo,
con puerto aleatorio y almacenamiento temporal; se elimina al finalizar.

Regresión backend completa del 30/10 después de la corrección:

```text
suites: 236, passedSuites: 236, failedSuites: 0
tests: 2117, passed: 2117, failed: 0, pending: 0
```

ESLint del frontend: código de salida 0, sin diagnósticos. Comprobación sintáctica
Node de siete archivos de implementación/pruebas: aprobada. `git diff --check`:
sin errores. No se cambió código del frontend ni fue necesaria una nueva
compilación para este cambio de backend.

Evidencia sintética regenerable en `.cache/general-business-cycles/`:
`business-cycles.json` y seis capturas de caja cerrada. Se mantiene fuera de Git.

## Límites y continuación

El punto queda validado para los recorridos descritos, operados por administradores
de demostración. No equivale a una jornada autónoma de un cliente externo, a una
prueba integral de historia clínica por médico, ni a probar todos los cruces de
módulos o acciones de automatización. No se activaron jobs, proveedores, mensajes,
cargos reales ni recuperación externa.

Persistió una advertencia de deprecación de `pg` sobre consultas concurrentes en
un cliente; no produjo fallos ni diferencias en este ensayo. No se afirma ausencia
absoluta de advertencias o de deuda técnica.

Docker Desktop tuvo un fallo local de arranque por acceso a `engine.sock`.
Se recuperó reiniciando sus procesos, sin reset ni eliminación de datos Docker.
Después respondió con motor 29.9.2 y ejecutó el ensayo. Esto no supuso cambios en
la VPS ni en datos reales del primer cliente.

El siguiente trabajo de producto es hacer repetible la incorporación y soporte
de un negocio independiente, usando estos recorridos como criterio de aceptación.
Los pendientes de publicación, estabilidad, respaldo independiente y admisión
externa permanecen en su evaluación separada.
