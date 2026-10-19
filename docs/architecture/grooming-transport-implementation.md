# Domicilios de peluquería: diseño de implementación

Fecha: 2026-10-16. Alcance autorizado: completar este flujo antes de publicar el lote y cargar clientes. Requisitos iniciales en `grooming-transport-functional-definition.md`; decisiones resueltas en ADR 023.

**Ajuste de experiencia solicitado el 17 de octubre:** la [simplificación posterior](grooming-transport-simplification.md) sustituye la captura obligatoria de logística al reservar y añade el recargo independiente en la ficha. La lectura de totales anteriores, el cierre y la comisión de este diseño se conservan. La verificación enlazada registra ambos recorridos y su evidencia actual.

## 1. Definición funcional

Configurar recogida/entrega sin duración ficticia. Conservar precios de peluquería en el centro y total especial con domicilio por mascota. Al preparar una atención, elegir modalidad, zona, dirección e importe confirmado o pendiente. Mostrar peluquería, transporte y total. Excluir transporte de la comisión y cobrarlo una sola vez.

## 2. Casos de uso

- Administración mantiene zonas y referencias para ida/vuelta, recogida y entrega; permite retirar una zona conservando las atenciones anteriores.
- Administración o quien puede ajustar precios confirma el importe; recepción puede solicitar transporte pendiente. El equipo confirma manualmente excepciones y cobros compartidos.
- Seleccionar un traslado cobrado en otra cita del mismo propietario, establecimiento y día. Solo se referencia una cita no cancelada, con transporte confirmado, que no sea ya compartida. No se admite referencia a sí misma ni cadenas. No cancelar ni retirar el cobro principal mientras cubra otras atenciones activas. Completar primero la principal evita cerrar una cita cubierta antes de asegurar el cobro del transporte.
- Completar una atención con desglose resuelto congela peluquería y transporte; genera una comisión solo por peluquería y un cobro por el total en la transacción existente. Una cita con transporte pendiente no puede completarse.
- Importar los precios cuando el texto distingue inequívocamente «sin» y «con» domicilio. Los datos ambiguos, importes de grupos o servicios diferentes se conservan en notas sin repartirlos. Un precio «con» aislado se conserva como acuerdo total pendiente de desglose.

## 3. Arquitectura técnica

Resolver todas las decisiones de importe en `price-resolver.service.js`. Conservar `resolvePrice` y `resolveAppointmentPrice` para el precio del servicio y añadir resolución del desglose completo. El mapper del dashboard muestra el total; el editor de precio sigue editando peluquería. La integración `CitaCompletada` conserva `resolvedPrice` como base de comisión y envía el total a Finanzas. La finalización congela los importes con bloqueo de la cita en su unidad de trabajo.

Un servicio de aplicación de transporte valida referencias tenant-scoped, estados, permisos e importes, usando el mismo resolver para cotizar y confirmar. Adaptadores HTTP exponen zonas, cotización y edición. Frontend usa `proxyUrl`, permite revisar propuestas y confirmar explícitamente; no calcula diferencias de precios por su cuenta.

Decisiones diferidas: rutas, conductor, hora de llegada garantizada, traslado entre destinos distintos y reclasificación automática de datos históricos ambiguos. Ningún dato real se carga para probar el software ni se reactiva WhatsApp.

## 4. Persistencia

- `Pet.defaultGroomingPrice`: peluquería en centro; `defaultGroomingWithTransportPrice`: total individual pactado ida/vuelta.
- `GroomingTransportZone`: configuración por Tenant, nombre, tres precios opcionales, activo.
- `Appointment`: modalidad, zona y nombre de referencia, dirección confirmada, precio y fuente del transporte, alcance y referencia opcional a la cita que lo cobra. El principal no se duplica; el compartido aporta cero al cobro de esa cita.
- La referencia compartida usa FK compuesta por Tenant e ID de cita. Importes pendientes quedan nulos. El registro de comisión no cambia.
- `Service.duration` pasa a nullable; reservas mantienen duración positiva. `requiresAppointment` se valida y persiste dentro del caso de uso, sin el segundo INSERT/UPDATE previo del adaptador. Precio base nulo se permite sin convertirlo en cero.

## 5. Esquema físico y validación

Migración aditiva con valores por defecto compatibles para citas anteriores, columna nullable de duración y restricciones de importes no negativos. Generar Prisma tras editar el schema. Probar resolver central, acuerdo particular sobre zona, total aislado sin base, gratuidad explícita frente a pendiente, comisión de 95.000 y cobro de 103.000, reintentos, cobro compartido y permisos/aislamiento. Comprobar migración y flujo con PostgreSQL local, lector CSV, frontend, lint y suite completa antes de declarar cierre. La publicación y carga real siguen posteriores a la verificación.
