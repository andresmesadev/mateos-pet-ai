# Revisión independiente del producto Huella Nex

**Fecha:** 28/10/2026. **Objeto:** producto general para veterinarias, pet shops
y peluquerías caninas y felinas. **Base revisada:** árbol de trabajo local,
candidato 2.58.3, incluidos los cambios de identidad aún sin publicar.

Se revisaron código, configuración declarada, contratos y pruebas. No se
consultaron bases de datos operativas, cuentas de establecimientos, historias,
ventas reales ni paneles de producción. Las reproducciones usaron identidades
de demostración, proveedores simulados y cero solicitudes de red o consultas
de base de datos. La consulta de vulnerabilidades se limitó al registro de npm.

## Resultado

**Seguimiento posterior — 28/10/2026:** HN-01 fue corregido y validado localmente
en el candidato 2.58.3; [diseño, alcance y pruebas](../architecture/billing-plan-selection-hn01-20261028.md).
HN-02 también fue corregido y comprobado localmente, con una cuarta opción
Personalizado por cotización; [alcance y pruebas](../architecture/billing-plan-persistence-hn02-20261028.md).
HN-03 fue corregido y comprobado localmente: gestión comercial con credenciales
administrativas vigentes y operación suspendida; [alcance y pruebas](../architecture/billing-suspended-access-hn03-20261028.md).
HN-04 tiene contención implementada localmente: ningún segundo establecimiento
hereda la línea global; [diseño y comprobaciones](../architecture/whatsapp-single-line-isolation-hn04-20261028.md).
La conexión independiente y los cupos de IA están implementados y comprobados
localmente con PostgreSQL desechable y proveedores simulados;
[evidencia, activación y pendientes externos](../architecture/commercial-providers-validation-hn04-20261028.md).
La aceptación externa de Meta todavía bloquea ofrecer ese canal a otro negocio.
El 29/10 se completaron localmente audio por duración y ponderación de contextos
extensos, con [simulación de costos](../research/AI_CREDIT_METERING_VALIDATION_20261029.md).
La nueva app Huella Nex quedó clasificada como proveedor de tecnología; su
verificación documental sigue pendiente por decisión de Andrés, sin aprobación.
Andrés eligió el [modelo comercial del ADR 033](../decisions/033-modelo-comercial-dashboard-ia-whatsapp.md):
dashboard e IA con cupo cobrados por Huella Nex, WhatsApp propio pagado a Meta.
HN-04 permanece abierto para la aceptación comercial externa. HN-05 fue corregido
y validado localmente el 29/10: [descripción comprobada de los planes](../architecture/billing-plan-description-hn05-20261029.md).
HN-06 fue corregido y comprobado localmente el 29/10: [identidad por establecimiento en WhatsApp](../architecture/whatsapp-business-identity-hn06-20261029.md).
HN-07 fue corregido y comprobado localmente el 29/10: [registro con preparación parcial](../architecture/onboarding-partial-result-hn07-20261029.md).
Los hallazgos HN-01/02/03/05/06/07 quedan corregidos localmente; HN-04 conserva
sus pendientes externos y comerciales. No se ha publicado este lote. Los hallazgos
y resultados siguientes describen el corte original de la revisión.

**Revisión final local — 29/10:** compilación, PostgreSQL y navegador con
establecimientos sintéticos de los tres nichos completados: 2.114 pruebas
backend, 285 de flujos, 17 PostgreSQL y 23 comprobaciones de navegador aprobadas;
60 controles de diseño en 15 vistas, sin desbordamiento. Se corrigieron dos
etiquetas de presentación. [Informe, evidencia y límites de publicación](HUELLA_NEX_FINAL_LOCAL_REVIEW_20261029.md).
Esto no cierra HN-04 ni publica el lote.

La base operativa ya contempla establecimientos aislados, siete combinaciones
de módulos y permisos por perfil. La revisión encontró **siete hallazgos**:
cuatro P1 que deben resolverse antes de habilitar el recorrido comercial o un
segundo canal de negocio, y tres P2 de consistencia y configuración inicial.

Los resultados favorables de las pruebas no certifican que la oferta comercial
esté completa. Los fallos de suscripción encontrados no estaban cubiertos por
las pruebas existentes. Tampoco se declara disponibilidad internacional por
haber adoptado una marca general.

Prioridades: **P1**, resolver antes de habilitar el recorrido afectado para
clientes externos; **P2**, corregir para una experiencia general consistente.
No se confirmó un hallazgo P0 en las superficies examinadas. Esto no constituye
una certificación de seguridad ni una prueba de penetración exhaustiva.

## HN-01 · P1 · El checkout puede enviar el nombre de una variable como precio

**Evidencia:** [billing-view.tsx, línea 182](../../frontend/components/dashboard/billing-view.tsx#L182).
La selección lee `process.env` con una clave construida dinámicamente y usa
`plan.priceEnvKey` como respaldo. Ese respaldo es un texto como
`NEXT_PUBLIC_STRIPE_PRICE_BASIC`, no un identificador real de Stripe.

Las consultas dinámicas de variables públicas no se sustituyen en el bundle
del navegador; se confirmó en la documentación incluida en la instalación
de Next.js y en el chunk compilado local. La reproducción de la expresión,
con el entorno del navegador vacío, produjo precisamente ese texto.

**Impacto:** la contratación o cambio de plan puede fallar aun habiendo
configurado las variables públicas durante la compilación.

**Corrección delimitada:** resolver precios permitidos de manera explícita y
validarlos en servidor; comunicar que un plan no está disponible cuando falta
su configuración, sin enviar nombres de variables al proveedor.
**Verificación de cierre:** probar Básico y Pro con precios sintéticos válidos,
configuración ausente y precio no permitido. No hace falta efectuar cargos.

## HN-02 · P1 · Una suscripción activa no actualiza el plan del establecimiento

**Evidencia:** [webhook de suscripción, líneas 220 y 226](../../backend/src/routes/billing.routes.js#L220),
[plan mostrado, línea 169](../../frontend/components/dashboard/billing-view.tsx#L169)
y [alta inicial con plan free](../../backend/src/services/onboarding-registration.service.js#L48).

El evento `customer.subscription.updated` guarda estado, identificadores y
habilitación, pero no resuelve ni actualiza `Tenant.plan` desde el precio
contratado. El cambio de plan tampoco persiste ese campo. La interfaz obtiene
su plan actual desde `status.plan`.

**Reproducción:** un webhook simulado de suscripción activa con un precio Pro
produjo una escritura con `active: true` sin campo `plan`. No se llamó a Stripe
ni a PostgreSQL. Por ese recorrido, el plan inicial puede seguir siendo free.

**Corrección delimitada:** mapear los precios admitidos al plan correspondiente
en servidor y persistirlo de forma coherente con los eventos del proveedor.
**Verificación de cierre:** alta, cambio, evento repetido y precio desconocido;
la interfaz y la persistencia deben identificar el mismo plan.

## HN-03 · P1 · La suspensión impide llegar a la pantalla para gestionar el plan

**Evidencia:** [suspensión del tenant, línea 119](../../backend/src/middleware/resolveTenant.js#L119)
y [protección de páginas, línea 25](../../frontend/proxy.ts#L25).

El backend responde 402 para un establecimiento inactivo. La protección del
frontend aplica también a `/dashboard/billing` y dirige cualquier respuesta
no satisfactoria a recuperación de sesión. La excepción comercial no tiene
un recorrido propio para gestionar la suscripción.

**Reproducción:** una solicitud sintética de un administrador a facturación,
con respuesta de acceso 402, terminó en
`/session-recovery?reason=unavailable`, en lugar de permitir la gestión del plan.

**Corrección delimitada:** mantener bloqueada la operación suspendida y permitir
exclusivamente la gestión de la suscripción a un administrador cuya sesión y
pertenencia al establecimiento se hayan comprobado. Un 402 debe diferenciarse
de una sesión inválida y de un fallo técnico.
**Verificación de cierre:** administrador suspendido, profesional sin permiso,
sesión revocada y establecimiento distinto. No ampliar permisos por excepción.

## HN-04 · P1 · El envío de WhatsApp conserva una identidad de proveedor global

**Evidencia:** [proveedor de canal, líneas 11 y 15](../../backend/src/contexts/communication/infrastructure/providers/whatsapp-channel-provider.js#L11),
[credenciales globales, líneas 9 y 11](../../backend/src/services/whatsapp-api.service.js#L9)
y [resolución de canal por defecto](../../backend/src/contexts/communication/infrastructure/persistence/prisma-channel.repository.js#L20).

El caso de uso recibe un establecimiento y resuelve un canal, pero el proveedor
envía únicamente tipo, destinatario y contenido. El transporte selecciona la
línea y el token desde variables globales. Resolver un canal propio en datos
no proporciona al transporte una identidad de envío distinta. Es una decisión
históricamente diferida, no una filtración de datos demostrada en esta revisión.

**Reproducción:** el proveedor simulado recibió solo destinatario y contenido;
no recibió identidad del establecimiento. La selección global se verificó en
el código del transporte; no se envió ningún mensaje real.

**Impacto:** no se puede afirmar que dos negocios puedan conectar y utilizar
independientemente sus números con este recorrido. Es un límite importante
para la oferta general con WhatsApp, aunque el dashboard opere sin ese canal.

**Tratamiento:** conservar ese límite explícito y no habilitar automáticamente
un segundo negocio sobre el canal global. Cuando exista ese consumidor real,
resolver formalmente la configuración e identidad del canal y su autorización
de envío antes de activarlo. No cambiar credenciales o plantillas por un rename.

## HN-05 · P2 · Los planes anuncian prestaciones que no son un contrato implementado

**Seguimiento 29/10 — cerrado localmente:** las tarjetas actuales retiran cupos
no aplicados, uso ilimitado, sedes, API para terceros, soporte prioritario y
popularidad no acreditada. Se explican módulos/permisos, comprobantes operativos,
IA y WhatsApp condicionados; Básico y Pro comparten las capacidades operativas
actuales y conservan sus precios de referencia. [Cambios y pruebas](../architecture/billing-plan-description-hn05-20261029.md).
La evidencia siguiente corresponde al corte original del 28/10, no a la oferta
corregida. No se construyeron nuevas restricciones ni se confirmó una oferta final.

**Evidencia:** [definiciones de planes, líneas 25–66](../../frontend/components/dashboard/billing-view.tsx#L25).

La pantalla ofrece límites de 50 citas, uno o cinco integrantes, múltiples
sedes y API de integración. La revisión completa del backend no identificó
un mecanismo de aplicación de esos cupos por plan. El modelo rector mantiene
al establecimiento como unidad de aislamiento y la API pública tiene el
alcance de canales propios; esas decisiones no equivalen a un producto de
administración de sedes o integración abierta para terceros.

**Impacto:** un comprador puede interpretar una oferta distinta de las
capacidades y restricciones efectivamente disponibles. La expresión
«POS y facturación» también necesita precisar el alcance de sus comprobantes.

**Corrección delimitada:** ajustar o retirar las promesas comerciales sin
respaldo y aprobar una oferta que describa lo existente. Este hallazgo no
autoriza a construir sedes, organizaciones, cupos o API para terceros para
rellenar esa publicidad. Precios y condiciones comerciales requieren su
propia decisión del responsable.

## HN-06 · P2 · Dos mensajes contienen un nombre fijo de establecimiento

**Seguimiento 29/10:** corrección cerrada localmente. El recordatorio lee el
nombre del establecimiento; reactivación exige cuerpo y variables aprobados
configurados por Tenant, con vista previa y entrega coherentes. Validación:
2.114 pruebas backend y 258 de flujos aprobadas, lint y TypeScript correctos.
No se habilitó ningún envío real. La activación externa sigue en HN-04.
Ver [alcance, compatibilidad y evidencia](../architecture/whatsapp-business-identity-hn06-20261029.md).
El hallazgo siguiente conserva la evidencia del corte original del 28/10.

**Evidencia:** [recordatorio, línea 521](../../backend/src/services/reminder.service.js#L521)
y [reactivación, línea 17](../../backend/src/services/reactivation-template.service.js#L17).

Los textos de recordatorio y representación de reactivación identifican un
negocio fijo. No se consultaron ni reprodujeron sus datos en este informe.

**Impacto:** reutilizarlos para un establecimiento de demostración u otro
cliente puede mostrar una identidad incorrecta. Sustituir ese nombre por
Huella Nex tampoco resolvería quién presta el servicio.

**Corrección delimitada:** obtener la identidad correcta del establecimiento
por el recorrido autorizado. Para reactivación hay que preservar la coincidencia
entre el contenido registrado y la plantilla aprobada del proveedor.
**Verificación de cierre:** dos establecimientos sintéticos con nombres
distintos, nombre ausente y canal no configurado; no efectuar envíos reales.

## HN-07 · P2 · El registro oculta un aprovisionamiento parcial

**Seguimiento 29/10:** corrección cerrada localmente. El formulario conserva
el estado parcial, muestra la revisión pendiente y permite continuar al
dashboard o iniciar sesión sin crear otra cuenta. Validación: 26 pruebas del
componente/proxy, 26 del contrato backend y 284 de flujos aprobadas; lint y
TypeScript correctos. No se crearon cuentas reales ni se enviaron correos.
Ver [alcance, resolución y evidencia](../architecture/onboarding-partial-result-hn07-20261029.md).
El hallazgo siguiente conserva la evidencia del corte original del 28/10.

**Evidencia:** [respuesta pending, líneas 36–40](../../backend/src/routes/onboarding.routes.js#L36)
y [redirección de registro, líneas 85–97](../../frontend/app/onboarding/page.tsx#L85).

El backend distingue la cuenta creada de la preparación de sus empleados
digitales: devuelve `provisioning: pending` cuando esa preparación falla.
La interfaz continúa a éxito sin comprobar o mostrar ese estado.

**Impacto:** el nuevo administrador no conoce una configuración pendiente.
Esto no significa que el dashboard o las ventas deban bloquearse: la cuenta
ya existe y el canal de comunicación puede configurarse después.

**Corrección delimitada:** mostrar el resultado parcial y su acción de
resolución; conservar la prevención existente de registros duplicados si falla
el inicio de sesión. Verificar estados ready, pending y fallo de login posterior.

## Límites del producto que deben mantenerse explícitos

- **Región:** la zona de negocio sigue fija en `America/Bogota`
  ([fuente](../../backend/src/lib/timezone.js#L9)); la revisión encontró
  referencias regionales en múltiples archivos de frontend y backend. Moneda, formatos,
  zona y documentos requieren validación para cada país antes de ofrecerlo allí.
  Este límite está reconocido en el modelo y no es un defecto de operar en Colombia.
- **Identidad:** la marca elegida y revisada es Huella Nex. El nombre del
  establecimiento en sus documentos operativos es independiente de esa marca.
- **Recuperación:** rige la configuración de plataforma ya documentada en la
  [guía técnica](../operations/DATABASE_BACKUP_AND_RESTORE.md). Esta revisión no
  la cambió ni certifica recuperación ante pérdida completa del servidor.
- **Experiencia visual:** lint, TypeScript y pruebas de componentes no sustituyen
  la comprobación interactiva en escritorio y móvil. No se ejecutó un recorrido
  visual de navegador con un establecimiento de demostración en esta revisión.

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| Jest del backend, ejecución secuencial | 220 suites; 1.869 pruebas aprobadas, cero fallos o pendientes. Prisma y proveedores simulados; URL de revisión apunta a localhost:1. |
| Pruebas locales de flujos, sin scripts PostgreSQL o live | 34 archivos; 207 pruebas aprobadas, cero fallos, omisiones o cancelaciones. Incluyen POS, pagos mixtos, caja, inventario, navegación, sesión y documentación. |
| Lint frontend | `npm run lint`, salida 0. |
| TypeScript frontend | `node node_modules/typescript/bin/tsc --noEmit --incremental false`, salida 0. |
| Dependencias de producción backend | `npm audit --omit=dev`: cero vulnerabilidades notificadas por el registro en esta consulta. |
| Dependencias de producción frontend | `npm audit --omit=dev`: cero vulnerabilidades notificadas por el registro en esta consulta. |
| Sondas aisladas adicionales | Confirman HN-01, HN-02 y HN-03, el contrato global descrito en HN-04, siete combinaciones válidas de módulos y porcentajes 30/40/50/70; contrato fijo y servicio sin reparto producen cero participación. |

Las 207 pruebas ya incluyen las ocho del comprobador documental; no deben
sumarse por segunda vez. En total, **2.076 pruebas existentes aprobadas**, más
las sondas aisladas descritas. Los resultados no constituyen evidencia de
ausencia de cualquier vulnerabilidad o defecto.

El primer intento de Jest con el Node del sistema terminó con código nativo
3221226505 y sin resultados; la ejecución completa con el Node empaquetado
terminó correctamente. Las consultas npm necesitaron red autorizada después
de fallar en el entorno restringido. No se actualizó ningún paquete.

No se ejecutaron pruebas contra PostgreSQL real: Docker local no tenía su
motor disponible. No se usó una base operativa como alternativa. La prueba
de aislamiento y restricciones con una base completamente desechable queda
pendiente; las suites llamadas integration en Jest usan dobles de persistencia.
El build de identidad comprobado anteriormente no se presenta como un nuevo
recorrido visual o una nueva certificación de compilación en esta auditoría.

## Orden de corrección y criterio de salida

1. **Suscripciones:** resolver juntos HN-01, HN-02 y HN-03, con pruebas de
   regresión del recorrido completo, precios permitidos y sesión administrativa.
2. **Oferta y alta:** ajustar HN-05 y HN-07 a lo que realmente se entrega;
   comprobar el inicio con Veterinaria sola, Peluquería sola y Pet shop solo.
3. **Comunicación:** corregir HN-06 antes de reutilizar textos y mantener el
   límite HN-04 hasta resolver su diseño para otro negocio con canal propio.
4. **Validación independiente:** ejecutar PostgreSQL desechable y revisión
   visual móvil/escritorio con configuraciones sintéticas de los tres tipos.

El siguiente cierre debe resolver cada hallazgo o dejarlo fuera de la oferta
de forma explícita, con evidencia y responsable. Una proyección internacional
no exige implementar adaptaciones sin un requerimiento real. Este informe no
crea una fase nueva, no cambia reglas financieras y no autoriza publicación.
