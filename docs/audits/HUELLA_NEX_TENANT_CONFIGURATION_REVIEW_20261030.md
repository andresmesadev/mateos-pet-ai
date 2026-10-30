# Huella Nex: configuración propia de cada establecimiento

**Fecha:** 30/10/2026. **Punto 4 de la revisión del software general.**
Revisión local del candidato, sin publicación ni cambios en datos reales.

## Resultado y correcciones

Se separaron los datos públicos y horarios de cada negocio de la identidad del
producto y de los identificadores técnicos de integración. Mateos Pet continúa
como primer cliente; no aporta una plantilla de contactos, precios o contratos
para los nuevos establecimientos.

- Un registro nuevo crea los siete días cerrados, sin horas preseleccionadas.
  Debe configurar su atención antes de ofrecer citas. No se modifican los
  horarios existentes ni se elimina su compatibilidad histórica.
- El comprobante consulta la identidad del establecimiento propietario del
  cobro. Pantalla e impresión usan el mismo nombre, dirección y teléfono de
  contacto verificados. Durante la carga o un fallo no permite imprimir;
  ofrece reintento y rechaza una respuesta de otro establecimiento.
- La ficha PDF de mascota usa `contactPhone`, nunca el identificador técnico
  `phone` de la conexión WhatsApp.
- La respuesta de horarios menciona únicamente las áreas activas y conserva
  minutos reales, por ejemplo 09:30–13:45. El pet shop consulta el horario
  general y no presenta una invitación a reservar una cita.
- La guía distingue ausencia de horario de una configuración sin días abiertos.
  El correo administrativo del ejemplo de entorno es genérico.

Diseño y límites acordados en
[Separación de configuración](../architecture/product-tenant-configuration-review-20261030.md).

## Evidencia de comprobación

Se crearon tres establecimientos sintéticos en PostgreSQL temporal, con
contactos, direcciones y franjas distintos. El recorrido reutiliza registro,
autenticación, APIs, navegador, operación y cierre reales del candidato.

| Actividad exclusiva | Horario propio | Ingresos | Comisión | Saldo tras gasto y reserva |
| --- | --- | --- | --- | --- |
| Veterinaria | 09:30–13:45 | $80.000 | $0 | $75.000 |
| Peluquería | 08:30–12:50 | $140.000 | $43.000 | $92.000 |
| Pet shop | 07:15–16:35 | $50.000 | $0 | $45.000 |

Se comprobó disponibilidad cerrada antes de configurar, elección de un turno
realmente disponible después, contactos y módulos propios en la respuesta de
horarios, reporte mensual e inventario aislados, comprobantes en 390 y 1440 px,
versión de impresión y PDF de mascotas en las dos actividades con citas.
Se simuló un error 503 y una identidad ajena: ambos impiden imprimir hasta
recuperar la identidad correcta. Los cobros y artículos permanecen iguales.

| Comando / comprobación | Resultado |
| --- | --- |
| `node scripts/verify-onboarding-local.cjs --tenant-configuration` | 24 comprobaciones aprobadas, 0 fallos |
| `node scripts/verify-onboarding-local.cjs --guided-business-setup` | 24 comprobaciones aprobadas, 0 fallos |
| Suite backend aislada | 236 suites, 2.120 pruebas aprobadas |
| Suite de flujos Node | 42 archivos, 290 pruebas aprobadas |
| Build optimizado Next, TypeScript y ESLint | Correctos |
| Búsqueda de nombre/contactos del centro en código runtime | Sin coincidencias en el alcance revisado, excluyendo pruebas y recursos SVG |

La evidencia sintética local queda en `.cache/tenant-configuration/`:
`configuration-matrix.json`, `business-cycles.json` y capturas de pantalla e
impresión. No se incorpora al repositorio como información de clientes.
No se alteró el esquema ni se añadió una migración; la prueba aplica las
migraciones existentes desde una base vacía y elimina su propio contenedor.

## Límites y estado de publicación

Esta revisión no certifica todos los caminos históricos de configuración.
Los valores de compatibilidad para negocios existentes permanecen deliberados;
el porcentaje configurable histórico no sustituye el contrato del profesional
ni la marca de reparto del servicio. No se modifican precios o comisiones por
estas correcciones de presentación e incorporación.

El comprobante obtiene la identidad actual del negocio; no añade una copia
histórica del emisor ni convierte el comprobante en factura electrónica.
Colombia, COP y la zona horaria actual siguen siendo el alcance inicial.
Los identificadores técnicos heredados se conservan por compatibilidad.

No se activó WhatsApp, IA, planes comerciales ni proveedores. La formación y
aceptación por un cliente externo, estabilidad vigente y recuperación
independiente continúan con sus criterios propios. El cierre de esta revisión
local no autoriza por sí solo la admisión externa.

Se evaluó versionado: el árbol ya declara el candidato **2.58.3**. No se crea
tag oficial ni se afirma una versión publicada. No se hizo commit, push ni
despliegue de este lote.
