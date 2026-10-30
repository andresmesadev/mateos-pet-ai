# Identidad del establecimiento en WhatsApp — HN-06

**Fecha:** 29/10/2026. **Estado:** corrección comprobada y cerrada localmente;
publicación del lote pendiente.

## Problema y contrato funcional

El recordatorio de cita y la representación local de la reactivación contenían
un nombre fijo. Huella Nex es el software; el remitente comercial de esas
atenciones es el establecimiento identificado por el `tenantId` del recorrido
autorizado. No se cambia la marca del centro por la del producto.

- Recordatorio: obtener `Tenant.name` por el identificador de la cita; conservar
  fecha, mascota, servicio y entrega por Comunicación. Si no hay nombre, usar
  una frase neutral. Sin identificador de establecimiento no se envía.
- Reactivación: la vista previa, el contenido persistido y los parámetros del
  proveedor derivan de un mismo cuerpo configurado por establecimiento. Sin
  nombre, plantilla válida o ruta habilitada, no se envía ni se marca contacto.
- La vista previa utiliza exclusivamente el establecimiento del contexto
  autenticado, nunca un identificador del body/query ni un nombre del navegador.

## Arquitectura y persistencia

Es una corrección de adaptadores de presentación sobre las entidades existentes
`Tenant` (modelo de dominio §1) y Comunicación (§10), no un nuevo entregable de
Fase 2. No hay nuevas entidades, reglas de precio, eventos, tablas o migraciones.
No se modifica el motor conversacional ni se llama al proveedor directamente.

Un lector pequeño obtiene el nombre por `Tenant.id` sin caché global. Reactivación
reutiliza `whatsapp-route.service.outbound` y la entrega de plantillas existente;
la infraestructura vuelve a validar la ruta antes del envío. La disponibilidad
del dashboard pasa a ser asíncrona y específica de ese establecimiento.

## Plantilla aprobada y compatibilidad

`WHATSAPP_REACTIVATION_TEMPLATES_JSON` contiene un mapa privado de configuración
del servidor, por identificador de establecimiento, con `name`, `languageCode` y
`body`. Cada entrada debe copiar **exactamente** el cuerpo aprobado en la WABA
de ese establecimiento, sin cabecera ni botones. Contrato soportado: parámetros
posicionales `{{1}}` (cliente) y `{{2}}` (nombre del establecimiento), exactamente
una aparición de cada uno. No se ejecutan expresiones ni sustituciones libres.

Ejemplo exclusivamente sintético, que no acredita aprobación en Meta:

```json
{"tenant-demo":{"name":"reactivacion_demo","languageCode":"es","body":"Hola {{1}}. Somos {{2}}. ¿Deseas agendar una visita?"}}
```

Las antiguas variables globales de nombre/idioma ya no habilitan este recorrido:
no prueban a qué establecimiento pertenece la aprobación y su cuerpo anterior
tenía una identidad fija. No se inventa un cuerpo aprobado ni se cambia la
plantilla existente en Meta. Antes de habilitar el canal se debe comprobar su
aprobación y registrar el cuerpo exacto; si Meta rechaza una plantilla, no se
persiste una entrega exitosa. La nueva configuración no contiene credenciales.

## Validación ejecutada y límites

Proveedores y base de datos simulados: dos establecimientos con nombres y
plantillas distintos, ausencia de nombre, canal pausado/no configurado,
plantilla ausente/malformada, contenido y parámetros equivalentes, selección
cross-tenant rechazada y ninguna métrica de contacto ante entrega no confirmada.
La vista previa del navegador utiliza el cuerpo y las variables posicionales,
con sustitución literal de una sola pasada; no busca un nombre de ejemplo
dentro de otro nombre. También cubre nombres con `$&`, `{nombre}` y `{{1}}`.

Resultados reales del 29/10:

```text
Jest backend: 235 suites passed, 2114 tests passed, 0 failed
Flujos Node: 40 archivos, 258 tests, 258 pass, 0 fail
Frontend npm run lint: exit 0
Frontend tsc --noEmit --incremental false: exit 0
git diff --check: exit 0
```

Las pruebas específicas ejecutan el renderizado, el envío simulado, la campaña
y la ruta HTTP. Comprueban que el tenant de autenticación prevalece sobre body
y query, que falta de nombre/plantilla/ruta bloquea la reactivación y que una
entrega no confirmada no actualiza la métrica de contacto. Las pruebas de
recordatorios conservan hora y marca de envío únicamente tras confirmación.

Se ejecutó el grep sobre el repositorio completo. En código de aplicación
quedan dos referencias técnicas al primer centro: un comentario histórico del
motor de disponibilidad y el slug compatible del arranque local. No quedan
nombres fijos del centro en estos textos salientes. Las demás coincidencias
corresponden a documentación del centro, historia, identificadores técnicos,
ejemplos de configuración y pruebas; no se sustituyen globalmente. El arnés
local de seguimiento usa ahora una vista previa simulada y no configura una
plantilla global ni contacta al proveedor.

No se enviaron mensajes reales, no se consultó información operativa, no se
modificaron plantillas de Meta, credenciales ni variables de producción. La
aceptación externa del canal sigue dentro de HN-04. Publicación pendiente.

## Decisiones diferidas y versión

Un editor de plantillas en el dashboard y una sincronización con Meta quedan
fuera de esta corrección; no son necesarios para retirar la identidad fija.
Las plantillas se habilitan por configuración técnica después de verificarlas.
Este ajuste correctivo no introduce una capacidad que exija una versión menor;
el versionado final del lote acumulado se revisará antes de publicarlo.
