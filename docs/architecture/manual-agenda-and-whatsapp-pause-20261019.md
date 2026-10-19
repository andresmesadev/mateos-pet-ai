# Jornada manual y pausa local de WhatsApp

## 1. Definición funcional

Petición del responsable: operar solo desde dashboard mientras se prueban las citas y registrar las mascotas que ya llegaron hoy. Mostrar horarios del área o, si no hay uno configurado, los habituales del establecimiento. Mantener peluquería cada 20 minutos.

## 2. Casos de uso

La consulta y creación autenticadas del dashboard habilitan modo manual fijado por el servidor: todos los turnos libres de hoy/futuro dentro del horario, sin anticipación de 30 minutos ni obligación de llenar los anteriores. Se admite la hora pasada de hoy, no días anteriores. Se conservan ocupación, intervalos, horario/ausencias del profesional, cierres, excepciones, Tenant y validación transaccional de cruces. Portal y reservas automáticas mantienen anticipación y secuencia actuales; no reciben el modo desde parámetros del usuario.

WhatsApp local se pausa mediante WHATSAPP_ENABLED=false, conservando las credenciales. Se bloquean webhook, envío de texto/plantillas y reclamación de trabajos pendientes; al arrancar no se programan recordatorios ni recordatorios de abandono/inbound mientras esté pausado. No se marca como procesado ningún mensaje pendiente por el solo hecho de pausar.

## 3. Arquitectura técnica

Reutilizar disponibilidad y resolución de horario compartidas con una opción interna manual, únicamente añadida por las rutas del dashboard. Prioridad de horario: excepción fechada, área válida (un cierre explícito se respeta), habitual del día, comportamiento legado solo si falta configuración válida. El flag de WhatsApp se comprueba en ingress/egress/worker; por compatibilidad, su ausencia conserva el comportamiento anterior. El archivo local backend/.env fija false; no publicar credenciales ni modificar Meta/VPS.

## 4. Persistencia

Mismos modelos y restricciones. No mover citas ni limpiar colas. Crear hoy a una hora pasada conserva fecha/hora elegidas y registra la cita como llegada, para que el barrido de ausencias no convierta esta recepción retrospectiva en no_show. Mantiene atención/pago posteriores y no genera cobro recibido automático. La pausa no borra tokens, canales, empleados o conversaciones. Salud informa el worker como pausado intencionalmente, sin inventar un procesamiento exitoso ni penalizar la salud por no iniciarlo.

## 5. Esquema físico y verificación

Sin migración. Probar fallback de área/habitual, área cerrada, minutos y cierre; manual hoy pasado y huecos frente a canal público estricto, fechas anteriores rechazadas y autenticación/aislamiento. Probar pausa sin llamadas HTTP, sin encolado ni reclamación; Jest completo y Chrome/PostgreSQL desechable. Verificar pausa efectiva en proceso local antes de declarar lista la jornada.

## Decisiones diferidas

Registro de días históricos, activación de WhatsApp/Meta y configuración por establecimiento del flag global no forman parte del pedido. El ajuste de agenda manual es una precisión operativa nueva, no una reescritura del motor conversacional. [ADR 027](../decisions/027-agenda-manual-sin-anticipacion-ni-secuencia.md).
