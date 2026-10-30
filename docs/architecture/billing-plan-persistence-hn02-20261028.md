# HN-02 — Persistencia del plan contratado y opción Personalizado

**Fecha:** 28/10/2026. Continuación autorizada por Andrés tras HN-01.
Fuente: [revisión del producto](../audits/HUELLA_NEX_PRODUCT_REVIEW_20261028.md).

## Definición funcional

La pantalla tenía precios de referencia de $0, $49.000/mes y $89.000/mes para
Gratuito, Básico y Pro. No se registra una aprobación comercial definitiva por
esta consulta. Se añade Personalizado con precio «A convenir», como cotización
con el equipo de Huella Nex. No asigna un importe ni un descuento y no permite
contratar automáticamente condiciones todavía no acordadas.

Después de una alta o actualización de suscripción, el plan guardado debe
corresponder al precio reconocido por el servidor. El estado de pago y la
habilitación siguen siendo campos distintos: guardar el nombre de un plan no
equivale a certificar que esté pagado.

## Casos de uso y arquitectura

1. La pantalla muestra Personalizado y explica cómo acordar alcance y propuesta;
   su recorrido informativo no llama a Stripe ni envía datos a terceros.
2. Al cambiar Básico/Pro, la respuesta de Stripe debe confirmar un único precio
   de suscripción reconocido. Se persiste el plan confirmado junto al estado.
3. Un webhook validado con la firma existente resuelve el precio de la única
   línea de suscripción mediante el resolvedor de HN-01 y actualiza `Tenant.plan`.
4. Precio desconocido, múltiples líneas o respuesta contradictoria no deben
   adivinar un plan ni sobrescribir datos existentes. El webhook devuelve error
   para permitir el reintento cuando el operador resuelva la configuración.
5. Repetir el mismo evento conserva los mismos valores del plan y la suscripción.
   No se crean cargos adicionales ni un segundo contrato por persistir el plan.

La traducción precio/plan reside en el adaptador de suscripciones existente.
Los precios operativos de servicios y mascotas no participan. Las pruebas usan
Stripe simulado y Prisma simulado, sin clientes ni cobros reales.

## Persistencia y esquema físico

Se reutiliza `Tenant.plan` y los campos de suscripción existentes. Sin schema,
migraciones ni nuevas entidades. La opción Personalizado es informativa; no
se inventa un precio global para acuerdos a medida ni se otorga un plan por
la solicitud de cotización. Su contratación requerirá condiciones reales.

## Límites y comprobación

HN-03 sigue abierto: este cambio no modifica el acceso de una cuenta suspendida.
La oferta y las prestaciones anunciadas siguen bajo HN-05. La política existente
de entrega y orden de eventos no se rediseña en esta corrección; la comprobación
de repetición cubre el mismo evento, no una certificación de cualquier orden
histórico de eventos diferentes.

Cierre: alta y actualización para ambos planes, conservación ante entradas
desconocidas o ambiguas, firma inválida, cambio confirmado/contradictorio,
repetición sin efectos adicionales y opción Personalizado sin cobro automático.

## Resultado local

**HN-02 corregido y validado localmente el 28/10/2026**, dentro del candidato
2.58.3 todavía sin publicar. La resolución del precio confirmado se comparte
entre cambio de plan y webhooks. Se persiste el plan reconocido, se normaliza
el identificador de un customer expandido y se conservan las comprobaciones
de firma y pertenencia del recorrido previo. Un cambio debe corresponder a
la misma suscripción consultada y al plan seleccionado.

Personalizado aparece como cuarta opción, con precio «A convenir» y un
desplegable que explica el acuerdo de alcance y propuesta. No hay solicitud
externa automática, compra, cargo ni activación de ese plan. Los importes
existentes de Básico y Pro permanecen visibles como referencias en COP,
pendientes de confirmación comercial; se retiró la afirmación no comprobada
de que incluyen IVA. Este ajuste no cierra las prestaciones pendientes de HN-05.

Evidencia:

- Regresión completa de backend: **223 suites, 1.958 pruebas aprobadas**.
- Flujos aislados de frontend y herramientas: **35 archivos, 220 pruebas
  aprobadas**, incluidas 13 del recorrido de planes y del componente real de
  facturación, la presentación de Personalizado y su ausencia de cobros.
- Lint y TypeScript del frontend: salida 0.
- Compilación optimizada: correcta, 34 páginas generadas.
- Sintaxis de las rutas y resolvedor: correcta; diff sin errores de formato.

Total de esta regresión: **2.178 pruebas aprobadas**, sin sumar otra vez las
ejecuciones específicas. Stripe y Prisma se simularon: no se consultaron
clientes, no se efectuaron cargos y no se escribieron datos operativos. No se
modificaron schema, migraciones, claves o configuración de producción.

El siguiente hallazgo abierto es HN-03. El soporte para eventos de suscripción
con varias líneas, acuerdos de precio personalizados y gestión del orden de
eventos diferentes conserva los límites explicados en este diseño; no se
declara implementado como parte de la corrección.
