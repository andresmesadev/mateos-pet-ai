# HN-04 — Aislamiento de la línea única de WhatsApp

**Seguimiento:** la contención de este documento está implementada localmente,
pero Andrés pidió completar la capacidad comercial multilínea antes de cerrar
HN-04. El [ADR 033](../decisions/033-modelo-comercial-dashboard-ia-whatsapp.md)
recoge el modelo elegido y las condiciones del trabajo pendiente.

**Fecha:** 28/10/2026. Corrección del punto 4 solicitada por Andrés en la
[revisión de Huella Nex](../audits/HUELLA_NEX_PRODUCT_REVIEW_20261028.md).

## 1. Definición funcional

Huella Nex conserva una única conexión de Meta por entorno. Sus credenciales
no habilitan automáticamente a todos los establecimientos. Solo el Tenant
activo cuyo identificador técnico `phone` coincide con
`WHATSAPP_PHONE_NUMBER_ID` puede usar esa conexión. El teléfono de contacto
del centro o del propietario no prueba esa vinculación.

Un canal propio en la base de datos no representa una segunda conexión de
Meta. La ausencia de una línea propia no permite utilizar la de otro negocio.
La pausa global sigue vigente. Sin identidad comprobable se rechaza el envío,
sin invocar el transporte ni guardar un mensaje como enviado.

## 2. Casos de uso

- Texto libre y plantilla: transportar el Tenant y el canal resueltos por
  Comunicación hasta el proveedor; comprobar su correspondencia al entregar.
- Canal global heredado: solo puede utilizarlo el establecimiento vinculado
  a la línea configurada. Un segundo Tenant no lo hereda.
- Tenant sin línea, inactivo, con otra línea o sin identidad explícita: rechazo.
- Mensaje entrante de otra línea: no delegarlo al motor de atención de cliente
  usando las credenciales de la línea configurada.
- Operadores internos: conservar la resolución explícita ya implementada
  (receptor, Tenant, canal, versión de ruta y autoridad vigente).

## 3. Arquitectura y reconciliación delimitada

Se refuerza el aislamiento existente en los adaptadores. El contrato del puerto
de envío incorpora un contexto de ruta `{ tenantId, channelId }`, obtenido en
los casos de uso y propagado por el registro de proveedores. No contiene token
ni datos suministrados por un destinatario. El proveedor comprueba la vigencia
del canal y del Tenant antes de usar el transporte global.

La resolución del canal por defecto deja de ofrecer un canal WhatsApp global
a cualquier Tenant. Una comprobación de infraestructura compartida valida la
correspondencia entre Tenant y línea; el proveedor la repite al entregar para
no confiar exclusivamente en una selección anterior.

El adaptador de recepción rechaza un receptor distinto del configurado antes
de resolver el negocio. No se reescribe `whatsapp.service.js`, no se cambia el
wizard de reserva ni se agregan reglas de precios o de operación.

La decisión histórica de credenciales globales permanece como límite técnico.
Se resuelve aquí su contención entre establecimientos, no la contratación ni
la conexión autónoma de múltiples líneas. No se implementan OAuth, un almacén
de tokens por Tenant, nuevas plantillas ni una segunda cuenta de proveedor.

## 4. Persistencia

Se reutilizan `Tenant.phone`, `Tenant.active`, `Channel.tenantId`, tipo y estado
del canal. No se cambian líneas, clientes, conversaciones o credenciales reales.
No se crea un canal automáticamente al dar de alta un negocio.

## 5. Esquema físico y validación

Sin cambios de schema ni migraciones. Pruebas con dos Tenant ficticios y una
línea sintética, con HTTP/Prisma simulados. Probar texto, plantillas, canal propio
y global, receptor entrante diferente, suspensión y pausa, canal revocado entre
la selección y el envío, y ausencia de persistencia/certificación de un envío
rechazado. Ejecutar regresión del backend y controles del repositorio.

No se enviarán mensajes reales ni se activará WhatsApp o una segunda línea.

## Resultado local — contención aplicada

Implementado en el candidato 2.58.3, sin commit ni publicación. La selección
del canal y el proveedor usan una comprobación compartida de Tenant activo y
línea técnica. El proveedor vuelve a comprobar además el canal (existencia,
tipo, vigencia y pertenencia) antes del transporte. Los casos de uso de texto
y plantilla propagan la identidad explícita a través del registro de proveedores.

El adaptador de recepción descarta líneas diferentes o ausentes antes de
consultar el Tenant. El recorrido privado de operadores conserva sus controles
preexistentes de receptor, Tenant, canal, versión, configuración y autoridad.
No se cambiaron sus permisos ni se creó un nuevo recorrido privado.

```text
Jest: 227 suites passed; 2025 tests passed; 0 failed.
Node scripts: 36 files; 237 tests passed; 0 failed.
Frontend lint: exit 0.
JavaScript: 9 archivos de implementación comprobados con node --check; 0 errores.
Documentación: 460 documentos; 1413 enlaces comprobados; 0 rotos.
```

Las nuevas pruebas recorren caso de uso, repositorio, registro, proveedor y
transporte real con HTTP/Prisma simulados. Cubren una línea heredada y una
propia correctamente vinculadas; segundo Tenant, línea distinta, teléfono de
contacto sin vinculación técnica, falta de identidad o credenciales, pausa,
suspensión, revocación entre selección y entrega y caída de la verificación.
Ningún rechazo invoca HTTP ni persiste/certifica un envío como aceptado.
El recorrido HTTP de respuesta manual también prueba el rechazo de una línea
ajena. Las pruebas de entrada comprueban receptor configurado, ausente o ajeno
y Tenant inactivo/no resoluble.

El grep del repositorio completo identificó las dos llamadas a las funciones
de transporte (texto y plantilla) exclusivamente dentro de infraestructura de
Comunicación. El diff de los motores `whatsapp.service.js`,
`conversation.service.js`, `scheduling.service.js` y `availability.service.js`
permanece vacío. No hubo cambios de schema, datos reales, credenciales ni VPS.

**Límite vigente:** HN-04 queda contenido para una sola línea por entorno;
no certifica soporte multilínea. Antes de activar el canal hay que verificar
la correspondencia entre el identificador técnico del Tenant y la línea del
proveedor. Sin esa correspondencia el envío queda bloqueado, sin reasignar
datos automáticamente. Habilitar WhatsApp para un segundo negocio exige un
diseño e implementación específicos de credenciales y rutas independientes.
