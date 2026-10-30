# HN-01 — Selección segura del precio de suscripción

**Fecha:** 28/10/2026. Corrección del primer hallazgo de la
[revisión independiente del producto](../audits/HUELLA_NEX_PRODUCT_REVIEW_20261028.md).
Andrés autorizó corregir los hallazgos uno por uno. Este documento delimita
HN-01; no modifica la persistencia del plan, la recuperación de una cuenta
suspendida ni las prestaciones comerciales de los planes siguientes.

## Definición funcional y casos de uso

El administrador elige Básico o Pro. El navegador envía la identidad del plan,
sin resolver credenciales ni identificadores de precios desde su bundle.
El servidor obtiene el precio de las variables existentes `STRIPE_PRICE_ID_BASIC`
y `STRIPE_PRICE_ID_PRO`. Contratación y cambio usan la misma resolución.

Un plan desconocido o un precio arbitrario se rechaza con 400 antes de llamar
al proveedor. Un plan sin configuración válida devuelve 503 y un mensaje
comprensible. No se envían nombres de variables como sustitutos de un precio.
Una configuración ambigua de precios compartidos por planes distintos se
rechaza. No se realizan cargos para probar estos recorridos.

## Arquitectura técnica

- El componente de facturación construye la solicitud con `planId`.
- El proxy conserva la sesión administrativa y el establecimiento autenticado.
- Un único resolvedor del adaptador de facturación valida el plan y traduce a
  precio configurado antes de invocar los servicios Stripe existentes.
- Por compatibilidad, el endpoint admite un `priceId` antiguo únicamente si
  coincide con un precio permitido en la configuración del servidor. Un precio
  enviado junto a `planId` tiene que coincidir con ese mismo plan.
- La resolución no consulta Stripe ni acepta que el navegador configure
  precios. No altera la identidad del establecimiento ni la autorización.

## Persistencia y esquema físico

Sin modelos, migraciones ni escrituras de datos nuevos. Los precios de servicios
y mascotas siguen en su resolvedor de dominio existente; esta corrección se
limita a seleccionar un precio de suscripción del proveedor. Los importes
anunciados y los cobros operativos quedan fuera de este cambio.

## Validación y decisiones diferidas

Pruebas aisladas del resolvedor, rutas HTTP de contratación/cambio y solicitud
del frontend: ambos planes, precio permitido antiguo, precio arbitrario,
plan desconocido, configuración ausente o inválida y conflicto de plan/precio.
El proxy debe rechazar sesiones no autorizadas y conservar el tenant de sesión.

HN-02 (persistencia de plan), HN-03 (suspensión), la política comercial y las
restantes correcciones conservan su propio alcance. No se configuran precios
reales ni se habilita facturación comercial por aplicar este arreglo.

## Implementación y validación local

**HN-01 corregido y comprobado localmente el 28/10/2026**, dentro del candidato
patch 2.58.3 todavía sin publicar. El navegador usa `billingPlanRequest` y envía
`planId`; las rutas de checkout y cambio resuelven ambas mediante
`billing-plan-price.service.js`. El proxy mantiene la comprobación administrativa,
el tenant de sesión y el bloqueo de acciones o cuerpos no válidos.

- Pruebas específicas de backend: tres suites, 56 pruebas aprobadas.
- Pruebas de solicitud, proxy y componente real de facturación: 11 aprobadas.
  Se comprueban los dos planes, contratación/cambio, error legible si falta
  configuración, rechazo de precios arbitrarios, tenant ajeno ignorado y sesión
  anónima o con rol revocado. Los proveedores son dobles de prueba.
- Regresión completa del backend: 222 suites, **1.920 pruebas aprobadas**.
- Flujos frontend y herramientas aisladas: 35 archivos, **218 pruebas aprobadas**.
  Estas incluyen las once anteriores y las ocho del comprobador documental.
- `npm run lint` y TypeScript sin emisión: salida 0.
- `npm run build`: compilación y TypeScript correctos, 34 páginas generadas.
- Sintaxis de las rutas y del resolvedor: correcta; `git diff --check`, salida 0.

En total, 2.138 pruebas existentes y de regresión aprobadas, sin contar de nuevo
las ejecuciones específicas. No se hicieron cargos, llamadas reales a Stripe,
escrituras de datos operativos, cambios de schema ni cambios de configuración
en la VPS. Los identificadores reales de los precios siguen siendo decisión
y configuración del operador. La publicación requiere su instrucción posterior.

El siguiente hallazgo abierto es HN-02: persistencia del plan después de los
eventos de suscripción. No se declara resuelto por este cambio de selección.
