# Proveedores comerciales — casos de uso, arquitectura y persistencia

Fecha: 28/10/2026. Base: [ADR 033](../decisions/033-modelo-comercial-dashboard-ia-whatsapp.md)
y [definición funcional](commercial-providers-functional-definition-20261028.md).
Andrés solicitó terminar la capacidad y confirmó cupo mensual configurable,
con cantidades inicialmente por definir. El 29/10 aceptó provisionalmente
100 créditos de prueba, 1.000 mensuales en Básico y 3.000 en Pro, aún sin activar.
La aprobación como Tech Provider no está confirmada.
Documento de diseño para implementación local; no acredita alta externa.

Implementación local comprobada en [el informe de validación HN-04](commercial-providers-validation-hn04-20261028.md).

**Ampliación autorizada 29/10:** [ADR 034](../decisions/034-medicion-ia-duracion-y-contexto.md)
define medición previa de audio, bloques de texto, persistencia JSON sin nueva
migración y huella de política. Reemplaza expresamente la unidad fija por llamada
del diseño inicial para esas operaciones. El proveedor de metadata se ejecuta en
un worker acotado; la aceptación comercial sigue abierta.

## Casos de uso y autoridad

1. Consultar conexión y cupo: administrador vigente del Tenant; solo metadatos,
   nunca secretos. El dashboard conserva su autorización y suspensión comercial.
2. Iniciar conexión: administrador autenticado; reto aleatorio, de un uso, con
   vencimiento, ligado al Tenant, actor y revisión actual de la conexión.
3. Completar conexión: canjear en servidor el código de Facebook Login for Business;
   comprobar aplicación, permisos, vigencia y acceso efectivo al WABA/número.
   Los IDs del navegador son pistas, no una autorización. Suscribir la aplicación
   a los webhooks del WABA. Mantener la conexión pendiente ante una comprobación
   incompleta. No reclamar un número o cuenta previamente asociados a otro Tenant.
4. Desconectar: administrador vigente, revisión esperada; anular ruta y secretos
   locales sin borrar el historial ni liberar su número para otro establecimiento.
   Las rutas privadas del equipo se invalidan y las colas no cambian de destino.
5. Configurar cupo: únicamente administración técnica global, con establecimiento
   explícito y auditoría. El administrador de un negocio no se concede saldo.
6. Consumir IA: contexto de ejecución verificado, reserva atómica, resultado
   aceptado/rechazado/incierto y liquidación idempotente. Sin cupo configurado no
   se inicia IA en el recorrido comercial. No se activan cargos adicionales.

## Arquitectura técnica

La conexión se administra desde un adaptador autenticado y Tenant-scoped. Las
credenciales se cifran con AES-256-GCM y una clave de servidor independiente;
Tenant y conexión participan como datos autenticados del cifrado. No se generan
ni escriben claves reales durante el desarrollo. Sin clave válida no se conecta.

El servidor valida la sesión administrativa actual, el reto, su vencimiento y
su revisión antes de habilitar la ruta. Los cambios de conexión se serializan
por Tenant y preservan unicidad de cuenta y número. La revocación se conserva
como registro; su presencia prohíbe volver al respaldo de variables globales.

Un contexto asíncrono de ejecución transmite Tenant y revisión de ruta, sin
guardar secretos en los jobs. Se establece después de autenticar solicitudes
del dashboard y al resolver metadatos de un webhook firmado. No se obtiene de
un Tenant arbitrario en el cuerpo del mensaje. Audio, operadores privados,
plantillas y texto usan la misma ruta del proveedor; el transporte vuelve a
comprobar la revisión antes de cada efecto. Un contexto de un negocio no se
reutiliza para otro en peticiones concurrentes.

Cada job nuevo conserva un snapshot sin secretos de Tenant, conexión y revisión.
Reintentar no permite adoptar una conexión distinta. Los jobs heredados conservan
su ámbito y deben resolverse sin reclamar números de otro Tenant. La conexión
actual de variables de entorno sigue como compatibilidad limitada al Tenant
activo que corresponde a esa línea, hasta migrarla explícitamente.

La IA gestionada usa la cuenta de proveedor de Huella Nex. Su consumo se atribuye
por contexto, no por la clave de OpenAI ni por el teléfono de un remitente. Se
envuelven todos los caminos de OpenAI del cliente: análisis, respuesta, embeddings,
audio e interpretación operativa. El health check del software es consumo técnico
separado. Se conservan las reglas de dominio y los efectos inciertos existentes.

## Cupo mensual y unidad de medición

El cupo se expresa en unidades de IA de una política versionada del servidor.
La política asigna unidades por operación; los tokens y duración reales se
conservan como evidencia de consumo del proveedor, no como factura del cliente.
Una atención puede realizar varias operaciones: no equivale a un único mensaje
de WhatsApp. Las cantidades y la política comercial deben configurarse y
comunicarse antes de publicar una oferta. No se inventan cupos para Básico o Pro.

Los meses siguen el calendario de Colombia, alcance regional actual del producto.
Se conserva cada período; no se reinicia eliminando consumo. Reservado + utilizado
cuenta contra el límite. Se bloquea el período durante la reserva/conciliación y
se comprueba el saldo dentro de la misma transacción. Un rechazo inequívoco puede
liberar la reserva; una aceptación incierta la mantiene para conciliación. Los
reintentos implícitos del SDK se desactivan en el recorrido medido para no ocultar
intentos de costo. No se descuentan dos veces liquidaciones repetidas.

El agotamiento afecta únicamente llamadas nuevas de IA. No cambia `Tenant.active`,
comisiones, caja o agenda. La UI explica el cupo y la indisponibilidad; la atención
humana por un canal vigente no consume IA.

## Modelo de persistencia y esquema físico

- `WhatsAppConnection`: un Tenant, un canal propio, WABA/número únicos, token
  cifrado opcional, vigencia y versión de ruta. Estados habilitada/revocada;
  no se guarda una credencial habilitada sin comprobación del proveedor.
- `WhatsAppConnectionChallenge`: hash del reto, actor, revisión, estado y
  vencimiento. No contiene código OAuth ni token de Meta.
- `WhatsAppConnectionEvent`: registro de altas, renovaciones y desconexiones,
  con Tenant, revisión y hash del actor; el código solo añade eventos.
- `AiQuotaConfig`: límite mensual y política del Tenant; `AiQuotaChange`
  conserva actor y valores anteriores/nuevos.
- `AiQuotaPeriod`: Tenant + mes únicos, límite y contadores no negativos.
- `AiUsageEntry`: Tenant/período, clave idempotente, unidades, operación,
  estado y metadatos mínimos de consumo, sin prompts, teléfonos ni respuestas.
- `InboundJob.providerRoute`: snapshot JSON sin secreto. No modifica las
  concesiones o checkpoints del ADR 011.

Migración aditiva, sin backfill de credenciales, cuotas comerciales o datos del
centro. FKs restringen borrado; índices y checks impiden cantidades negativas,
unidades inválidas y asociación de un consumo a un período de otro Tenant.
Se genera el cliente Prisma después del cambio. Nunca se aplica la migración
a la VPS o a una base operativa para probar.

## Validación y decisiones diferidas

Pruebas de cifrado/autenticidad, retos vencidos/repetidos/otro actor, permisos
revocados, conexión cruzada, número previamente vinculado, tokens inválidos,
revocación y cola antigua. Dos rutas sintéticas se prueban con texto, plantilla,
audio y equipo. Pruebas de cupo concurrente, repetición, incertidumbre y cambio
de mes. Probar interfaz/autorización y aplicar migración únicamente en base aislada.

La prueba externa y habilitación comercial dependen de Meta, su facturación y
permisos de la aplicación. La coexistencia requiere su recorrido específico y
sincronizaciones: no se activa automáticamente ni se procesa historia o contactos
de la app como mensajes nuevos de clientes. Los cupos iniciales se aceptaron
provisionalmente el 29/10; su costo y ponderación deben validarse. Precios finales
y recargas siguen por decidir; no se habilita una línea de crédito de Meta.

Fuentes técnicas primarias consultadas por Context7: Facebook Login for Business
(canje de código), Graph API WABA/subscribed_apps y Embedded Signup para usuarios
de WhatsApp Business (evento de finalización y coexistencia). El estado real de
la aplicación no pudo comprobarse. El intento inicial de navegador no respondió;
la herramienta de uso del equipo confirmó después que el acceso a navegadores
estaba deshabilitado en Work. Andrés indicó que lo activaría para revisar Meta.
**Seguimiento 29/10:** el acceso permitió crear una app y portfolio independientes
de Huella Nex y confirmar su clasificación de proveedor. No se completó la
verificación documental ni la revisión; [estado y evidencia actualizados](commercial-providers-validation-hn04-20261028.md).

Las reservas sin resultado tras un reinicio no se liberan. Después de 15 minutos
se muestran para conciliación con evidencia, igual que las respuestas inciertas;
solo la administración técnica puede resolverlas. No se reintentan consumos
inciertos ni se concede saldo por vencimiento de una reserva. En modo multilínea,
los jobs anteriores sin snapshot de conexión también requieren revisión.
