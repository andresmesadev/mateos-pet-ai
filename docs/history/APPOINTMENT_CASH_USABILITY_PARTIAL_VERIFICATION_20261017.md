# Ensayo de agenda y Caja — ajustes verificados y decisión pendiente

Registro histórico parcial. La decisión posterior del responsable y el recorrido completo de pago están implementados y verificados en [la continuación del mismo día](APPOINTMENT_PENDING_PAYMENT_VERIFICATION_20261017.md); sus resultados sustituyen el estado pendiente descrito aquí.

17 de octubre de 2026, después del ensayo local del responsable. [Cinco etapas](../architecture/appointment-cash-usability.md). Estado: dirección, acciones de agenda, desglose y scroll implementados localmente; **cambio del cobro automático e icono de pago pendientes de concretar el comportamiento financiero**. No se declara terminado el conjunto.

## Alcance implementado

- La lista y detalle de mascotas conservan `owner.address` del cliente autenticado. Se presenta como Dirección y barrio en la ficha completa y operativa. El texto importado se conserva entero; no se infiere ni almacena una segunda dirección en Mascota.
- La cita recibe `clientAddress`; el resumen de domicilio la muestra y la propone en el editor. Cambiar la modalidad conserva la dirección propuesta. El equipo puede corregirla y confirmarla para esa atención; la dirección ya confirmada en la cita sigue siendo su referencia.
- Agenda de hoy incorpora acciones directas Llegó, En atención y Finalizar, con permisos/área/asignación, tolerancia de llegada y confirmación del cierre. No se cambian reglas de estado del servidor. Regularizar una llegada anterior conserva confirmación explícita del administrador.
- Agenda y cierre/entrega de peluquería muestran por separado servicio, domicilio y total procedentes del resolver central. No se recalcula un precio en el frontend ni se cambia la base de comisión.
- Buscador de propietarios en POS con altura máxima, scroll vertical, desplazamiento táctil y seguimiento de la opción activa al usar flechas. Se mantiene selección por Enter y cierre por Escape.

## Evidencia

```text
Backend: 199 suites passed; 1628 tests passed; 40.434 s
Chrome + NextAuth + PostgreSQL temporal: 17 passed, 0 failed
Frontend: build y TypeScript correctos; 32 páginas generadas
Frontend ESLint: código 0, sin salida
git diff --check: código 0
```

La prueba real de navegador abrió una mascota desde el listado, verificó la dirección del propietario y su propuesta en el transporte. Usó Llegó y En atención en Inicio sin abrir la ficha, y comprobó la presencia de Finalizar. Revisó el cierre con importes separados, preparó ocho propietarios ficticios con nombres coincidentes y desplazó los resultados del POS con rueda y teclado. Captura privada revisada: `.cache/onboarding-verification/14-pos-client-scroll.png`. La suite añade una regresión para que el mapper del listado no descarte de nuevo dirección e identidad del propietario.

El último ajuste de confirmación de llegadas anteriores pasó build/lint; ese caso no se presentó en el recorrido de Agenda de hoy, que usa la fecha actual. Finalizar está implementado mediante el endpoint de cierre existente y conserva su comportamiento financiero hasta resolver el punto siguiente. La prueba de navegador no certifica aún el nuevo recorrido de pago.

Las 55 migraciones existentes se aplicaron a una base temporal vacía, sin diferencias con Prisma. Los avisos de eventos no sembrados en fixtures y de consultas concurrentes descritos en la verificación de transporte no produjeron fallos. Los fixtures se eliminaron al finalizar. No se añadieron migraciones para estos cuatro ajustes y no se alteraron los clientes reales del ensayo del responsable.

## Caja: pendiente, sin cambios de ingresos

Se comprobó que `CitaCompletada` actualmente genera una Transaction activa con `paidAt` y método efectivo por defecto; el cobro está además vinculado a la verificación de integridad del cierre diario de ADR 007. Cambiar únicamente el botón dejaría intacto el ingreso automático y no cumpliría el requerimiento.

Pregunta funcional enviada al responsable: dejar la atención Pendiente de pago sin sumar dinero recibido hasta confirmación, o no crear ningún cobro hasta pulsar el icono. Sin respuesta todavía al registrar esta evidencia. No se cambió el disparador financiero ni se añadió un icono que aparente que ese cambio está terminado. La implementación posterior debe resolver la coherencia entre pagos, ingresos, cierre diario, reintentos y cobros históricos, conservando una sola comisión y un solo ingreso por atención.

Versionado evaluado junto al lote local: capacidad nueva que requiere versión menor al publicarlo; producción continúa en 2.49.0. No se hizo commit, push, tag ni despliegue en este ajuste. La evidencia no certifica cierre de beta ni del cambio financiero pendiente.
