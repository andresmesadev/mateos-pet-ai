# HN-05 — planes descritos según capacidades comprobadas

**Fecha:** 29/10/2026. **Estado:** corrección comprobada y cerrada localmente;
publicación del lote pendiente. **Alcance autorizado:** corregir las diferencias entre
la oferta visible y el funcionamiento actual de Huella Nex. No añade límites
comerciales, privilegios por plan, nuevas sedes ni integraciones para terceros.

## Evidencia y decisión

El inventario de `backend/src`, `frontend` y `prisma/schema.prisma` confirma que
el nombre del plan identifica la suscripción y el precio configurado en Stripe.
La operación se autoriza por Tenant activo, módulos, rol y permisos. No hay
contrato implementado de 50 citas, uno/cinco integrantes o exclusividad de
funciones por Básico/Pro. `dashboard-access.service.js` y
`business-config.service.js` resuelven acceso y módulos sin imponer esos cupos.

Se eliminan de las tarjetas los cupos inventados, lo ilimitado, las sedes,
API para terceros, prioridad de soporte no pactada y popularidad sin evidencia.
No se construyen funciones para justificar publicidad anterior.

## Descripción vigente del alcance

| Opción visible | Alcance comprobado y condiciones |
| --- | --- |
| Evaluación (`free`) | Acceso de evaluación según habilitación; gestión operativa según módulos y permisos. Sin duración de prueba inventada ni promesa de servicio gratuito permanente. |
| Básico (`basic`) | Referencia de 49.000 COP/mes. Gestión de un establecimiento, agenda/clientes/mascotas, equipo, caja, inventario y comprobantes según módulos y permisos. Cupo de IA a confirmar en la oferta. |
| Pro (`pro`) | Referencia de 89.000 COP/mes. Actualmente comparte las capacidades operativas con Básico. La diferencia propuesta es el cupo de IA pendiente de habilitación/confirmación comercial; no confiere sedes o API. |
| Personalizado (`custom`) | Alcance, cupo y condiciones mediante propuesta y cotización previas. Sin precio automático ni checkout automático. |

Los precios son referencias existentes; no se cambian precios de Stripe,
suscripciones, impuestos, descuentos ni condiciones de clientes reales.
La comparación de cupos 100/1.000/3.000 sigue siendo provisional según
[ADR 033](../decisions/033-modelo-comercial-dashboard-ia-whatsapp.md) y
[ADR 034](../decisions/034-medicion-ia-duracion-y-contexto.md). No se publica
como saldo incluido/activado en las tarjetas ni se asigna automáticamente.
La oferta definitiva requiere confirmación comercial antes de publicarse.

## Condiciones visibles comunes

- Cada suscripción corresponde a un establecimiento independiente.
- Los módulos y permisos determinan qué funciones ve y usa cada perfil. Una
  historia clínica requiere el módulo Veterinaria; un pet shop no recibe por
  el nombre del plan una promesa de atención clínica.
- Los comprobantes de caja son operativos; la facturación electrónica no
  forma parte de esos comprobantes.
- WhatsApp es opcional: cuenta/número propios, cargos de Meta a cargo del
  negocio y habilitación de la conexión por el proveedor.
- La IA necesita habilitación y cupo asignado. Cambiar la suscripción no
  acredita por sí solo saldo disponible; el estado real se consulta en la
  pantalla de integraciones del mismo establecimiento.

## Implementación delimitada

Se corrige `billing-view.tsx`, única fuente actual de tarjetas de precio.
La landing pública no tiene otra tabla de precios. `free` conserva su
identificador técnico; cambia solo la etiqueta visible a Evaluación.
Se conserva el proxy autenticado de HN-01 y la suscripción única de HN-02.
No cambian casos de uso, modelo de dominio, persistencia, esquema ni migraciones.
La documentación legal genérica no contiene aquellos cupos por plan.

## Validación y cierre

Probar las tarjetas reales renderizadas: sin promesas retiradas, con separación
de módulos/comprobantes, IA/WhatsApp condicionados y alcance de un establecimiento.
Mantener las regresiones de selección de precios, recontratación y Personalizado
sin cobro automático. Revisar textos del repositorio completo; las referencias
históricas/auditoría se conservan identificadas como evidencia anterior.

Es una corrección de presentación/contrato informativo, no una capacidad nueva
que requiera una release menor por sí sola. La decisión de versión y publicación
del lote acumulado continúa pendiente. HN-04 permanece abierto por Meta y su
aceptación externa; HN-06/HN-07 no forman parte de esta corrección.

### Resultados observados

| Comprobación | Resultado |
| --- | --- |
| `node --test scripts/billing-plan-selection.test.cjs scripts/billing-suspended-access.test.cjs` | 33 pruebas, 33 aprobadas, 0 fallos. |
| Flujos locales completos | 39 archivos, 255 pruebas aprobadas, 0 fallos. |
| `npm run lint` en frontend | Salida 0, sin errores ni advertencias. |
| `tsc --noEmit --incremental false` | Salida 0. |
| Búsqueda de las promesas retiradas en todo `frontend` | 0 coincidencias. |

Se ejecutaron las tarjetas reales del componente con datos de demostración y
transporte simulado. El chequeo del repositorio completo encontró únicamente
referencias restantes en auditoría, diseño, tests y la negación explícita del
Plan Maestro; no son una oferta activa. Se preserva esa evidencia histórica.
Los tests comprueban que no se acredita un cupo no asignado, que Personalizado
no cobra automáticamente, y que la consulta del cupo conserva el establecimiento
seleccionado sin ofrecer esa ruta operativa a un establecimiento suspendido.
No se modificaron datos, suscripciones, precios configurados ni cuentas reales.
