# Huella Nex — servicios propios y proveedores externos

**Fecha:** 28/10/2026. **Estado:** definición funcional del modelo comercial
seleccionado por Andrés; implementación local validada, aceptación externa pendiente.
**Base:** [ADR 033](../decisions/033-modelo-comercial-dashboard-ia-whatsapp.md).

## Producto que se venderá

El establecimiento contrata Huella Nex para gestionar su operación y, según
su plan, utilizar IA con un cupo definido. No necesita administrar una cuenta
de OpenAI para utilizar esa IA. Si quiere WhatsApp integrado, conecta una cuenta
y número propios y paga a Meta los cargos que le correspondan.

La cuenta de un establecimiento no recibe credenciales, historial, conocimiento,
saldo de IA ni configuración de otro. El Tenant sigue siendo la unidad de
aislamiento. El negocio puede utilizar el dashboard sin conectar WhatsApp.

El software conserva una identidad general, distinta del nombre y la identidad
comercial de cada establecimiento. Esta definición no constituye jurídicamente
a la iniciativa Nexo Web ni identifica todavía al futuro prestador contractual.

## Recorridos funcionales a completar

### 1. Contratar y configurar el software

El administrador elige un plan, conoce sus funciones, precio, cupo de IA y
exclusión del consumo de Meta. El plan se habilita por confirmación del proveedor
de suscripción. Se reutiliza la facturación del SaaS; no se mezcla con la caja,
ventas o pagos de clientes del establecimiento.

Los valores de referencia hoy visibles no son una oferta final aprobada.
El período mensual fue aprobado. El 29/10/2026 Andrés aceptó provisionalmente
100 créditos de prueba una sola vez, 1.000 mensuales para Básico y 3.000 para
Pro; Personalizado se cotiza. Es una bolsa por establecimiento. Las ponderaciones
y el costo de usos largos deben validarse antes de activar la oferta. No se
han configurado estos cupos en producción ni asignado automáticamente a planes.

### 2. Conectar WhatsApp del establecimiento

Un administrador vigente solicita la conexión desde su propio Tenant. El
propietario autoriza acceso a su cuenta/número mediante el recorrido permitido
por Meta. Introducir un teléfono, ID o un token en un formulario no demuestra
por sí solo titularidad ni acceso a esos activos.

La conexión debe comprobar cuenta de WhatsApp Business, número, permisos de
la integración y correspondencia del receptor del webhook. Puede estar pendiente
sin habilitar envíos. Se activa solo cuando esas comprobaciones son satisfactorias.
No se reemplaza la conexión de otro negocio ni se permite reclamar su número.

El administrador ve su estado y puede desconectarla/revocar el uso. Las credenciales
no se devuelven como texto al navegador. El recorrido de coexistencia con la app
WhatsApp Business se evalúa expresamente; no se pide eliminar la app o migrar
un número real sin comprobar antes el procedimiento y sus consecuencias.

### 3. Recibir y enviar mensajes

Un webhook firmado identifica una conexión vigente por los activos verificados
del proveedor. El cuerpo del mensaje, el teléfono del destinatario o una selección
del navegador no eligen otro Tenant. Texto, plantillas, respuestas automáticas,
atención humana, recordatorios y operadores internos respetan esa misma ruta.

Cada negocio usa sus plantillas y permisos, con las restricciones del proveedor.
Un fallo o suspensión de su conexión no habilita el uso de otra. Una entrega
incierta conserva esa condición y no se repite como si se hubiera rechazado.
Las colas pendientes deben verificar nuevamente la vigencia de la ruta antes
de enviar; la desconexión no las redirige a otro negocio o a la línea global.

### 4. Utilizar IA gestionada por Huella Nex

La plataforma asume el costo de OpenAI y atribuye el consumo al Tenant que
solicitó la operación. La información enviada a IA se limita al contexto autorizado
de ese establecimiento; una credencial de proveedor común no es una autorización
para consultar historiales o documentos de otros negocios.

El cupo se consulta antes de iniciar consumo y debe soportar solicitudes
concurrentes, llamadas múltiples por atención, reintentos y respuestas inciertas.
No basta registrar el total de tokens en logs. Debe quedar evidencia persistente,
con una regla explícita para medir texto, audios, embeddings y otras funciones
que el plan realmente incluya. El monitoreo técnico de Huella Nex se registra
aparte y no se atribuye arbitrariamente a un establecimiento.

El administrador puede consultar disponibilidad y consumo de su cupo. La unidad
mostrada debe corresponder a una regla publicada y versionada; no se presenta
una estimación como factura de OpenAI o de Meta.

### 5. Agotar el cupo o perder una conexión

| Situación | Comportamiento esperado |
| --- | --- |
| Cupo de IA agotado | No iniciar nuevos consumos de IA. Mostrar el estado y permitir gestión manual del negocio. No cobrar excedentes automáticamente. |
| Meta indisponible, conexión revocada o sin permisos | Detener los envíos afectados; conservar su estado y habilitar la gestión desde el dashboard mientras su suscripción siga activa. |
| OpenAI indisponible | No presentar una respuesta como generada ni una operación como realizada. Permitir atención humana y conciliar cualquier consumo incierto. |
| Suscripción del software suspendida | Mantener el bloqueo comercial existente y el acceso administrativo limitado a gestionar la suscripción, según HN-03. |

El agotamiento de IA no modifica `Tenant.active`. La continuidad de atención
humana por WhatsApp requiere que esa conexión siga vigente; no implica que
Meta funcione cuando su propia conexión falla.

## Criterio para cerrar la capacidad comercial

- Dos Tenant de demostración pueden conectar rutas independientes y revocables.
- Todos los recorridos salientes y entrantes mantienen la ruta correcta, incluso
  tras una desconexión, cambio de credencial o reintento de cola.
- Los secretos se protegen en servidor y el cliente no puede consultar los ajenos.
- Consumo/cupo de IA aislados, medidos y conciliables, sin doble descuento por
  reintentar ni liberación injustificada ante una aceptación desconocida.
- El agotamiento de IA y la indisponibilidad de proveedores no bloquean el
  dashboard cuando la suscripción del software sigue habilitada.
- Oferta comercial: precio/cupo/renovación/exclusiones definidos, sin declarar
  funciones pendientes como disponibles ni activar cargos no aceptados.
- Pruebas simuladas y verificación del recorrido de Meta. La aceptación externa
  requiere una conexión de prueba autorizada, con titularidad y pagos comprobados;
  no se envían mensajes a clientes reales para completar el diseño.

## Diseño realizado y decisiones aún por fijar

Los casos de uso, arquitectura, persistencia y esquema físico se concretaron
en el [diseño técnico](commercial-providers-technical-design-20261028.md).
La implementación se comprobó en PostgreSQL desechable, con dos conexiones y
proveedores simulados; [evidencia](commercial-providers-validation-hn04-20261028.md).
Esto no aprueba modificaciones de cuentas externas ni activa credenciales reales.

Pendientes concretos: validar ponderaciones y costos de los cupos iniciales
aceptados, ajustar el audio por duración, política de ampliación y recorrido
de alta de Meta validado para la integración. El
período es mensual, con horario de Colombia; no hay excedentes automáticos.
No es necesario cambiar el número habitual para comprobar la parte local.
