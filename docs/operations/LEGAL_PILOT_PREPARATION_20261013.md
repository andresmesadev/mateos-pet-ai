# Paso 7 — Revisión documental del piloto interno

**Fecha:** 13 de octubre de 2026. **Base técnica:** 2.46.7. **Resultado:** paquete interno preparado y contrastado; cierre operativo pendiente, no beta externa autorizada.

## Decisiones del responsable

- Persona natural: identidad/contacto suministrados por el responsable, sin pedir cédula ni crear una empresa ficticia.
- Solo pruebas internas con datos ficticios; teléfonos, perfiles, correos o voces reales no se presumen anónimos.
- Conservación mínima durante las pruebas y hasta treinta días después del cierre registrado; gestión manual de eliminación/anonimización y copias. No se borraron datos por esta decisión.
- Oracle Cloud, Colombia Central. Verificación de metadatos: plataforma Oracle y región canónica `sa-bogota-1`, coincidente con su declaración.
- Copias completas de los documentos privadas. Repositorio `PUBLIC`, comprobado con `gh repo view`; dirección/teléfono y demás contacto no se incorporan a Git.

## Entregables

| Documento | Contenido |
| --- | --- |
| [Política](../legal/politica-de-privacidad.md) | Datos reales inevitables, finalidades, proveedores efectivos, conservación, derechos y seguridad verificables |
| [Condiciones](../legal/terminos-de-servicio.md) | Alcance interno/ficticio, cuentas, coste sin cargos del ensayo, IA, soporte, retiro y ausencia de exención general |
| [Acuerdo](../legal/acuerdo-piloto-interno.md) | Aviso previo, aceptación separada de autorización y registros privados sin firmas inventadas |
| [Procedimiento](../legal/procedimiento-privacidad-piloto.md) | Recepción, identidad, inventario, plazos, actuación manual, copias y ensayos pendientes |
| Paquete privado | Mismos cuatro archivos con datos completos y README privado, bajo `.cache/private/legal/`, ignorados por Git |

Las plantillas públicas conservan variables deliberadas; las copias privadas deben quedar sin variables pendientes. No se pide otra vez el contacto ya facilitado ni se publica el domicilio para convertir una plantilla en un documento completo.

## Contraste con la implementación

| Hallazgo previo | Corrección y evidencia |
| --- | --- |
| Política asumía que Calendar solo recibía fecha/hora/servicio | `google-calendar.service.js` construye título con mascota/teléfono y descripción con tipo/servicio/teléfono. Se informa esa posibilidad antes de activarlo |
| Todos los proveedores parecían activos | Configuración de VPS a las 18:29:50: Meta/OpenAI presentes; Calendar/Stripe/Sentry ausentes. Presencia indica configuración, no prueba cada llamada histórica |
| Audio y memoria omitidos | `audio.service.js` descarga, transcribe vía API y procura limpiar; `embedding.service.js` envía texto; memoria/contexto contienen datos de reserva e historial. Política cubre esas rutas |
| “Ninguna credencial en texto plano” | Se distingue hash del staff/identidad del cliente de secretos administrativos y de integración restringidos, sin prometer que todos sean hashes |
| Aislamiento descrito como imposibilidad absoluta de soporte | Roles/tenant y acceso administrativo autorizado se describen sin negar facultades legítimas de soporte |
| Conservación ligada indefinidamente a cuenta activa | Plazo elegido de treinta días tras cierre, revisión mensual de necesidad y actuación manual; no se promete una purga inexistente |
| Copias independientes omitidas | VPS con `MATEOS_BACKUP_RETENTION_DAYS=14`, verificado en `/etc/mateos-pet-ai/backup.conf`; copias locales no tienen purga automática. Se exige su revisión en el inventario |
| Suscripción obligatoria Stripe y ausencia de pruebas reales | Condiciones ahora del piloto interno; no cargos al participante, Stripe no configurado y ensayos supervisados reales ya documentados |
| “Datos pertenecen al establecimiento” y exención general | Se preservan derechos del titular/licencias de terceros y obligaciones del prestador, sin cesión de datos o renuncia general |
| Faltaban acuerdo y evidencia de autorización | Se agregan modelos de entrega y decisiones separadas, con registro privado. No se declara consentimiento previo por usar la aplicación |

Referencias técnicas: `prisma/schema.prisma`, `frontend/auth.ts`, `staff-credential.service.js`, `context-builder.service.js`, `openai.service.js`, `embedding.service.js`, `audio.service.js`, `google-calendar.service.js`, `logger.js`, `sentry.js`, scripts/guía de respaldos. Documentos de visión/dominio no se alteran; el establecimiento sigue siendo unidad de aislamiento. No hay nueva entidad, fase, integración o caso de uso por esta tarea.

## Revisión de fuentes oficiales

Revisión orientada a Colombia, no una aplicación automática de GDPR, HIPAA o reglas de otra jurisdicción. Se preservan finalidades específicas y supervisión de IA, sin tratar expedientes ficticios de mascotas como autorización para salud de personas.

| Fuente | Contraste realizado |
| --- | --- |
| [Ley 1581 de 2012](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/ley_1581_2012.htm) | Identificación/información previa, prueba de autorización, derechos, consultas/reclamos y trámite previo ante SIC |
| [Decreto 1074, capítulo 25](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr025.htm) | Contenido de política/aviso y condiciones del tratamiento |
| [Decreto 1074, transmisión internacional](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr026.htm) | Roles, contratos de transmisión y responsabilidad demostrada, sin presumir cumplimiento por un enlace |
| [Circular SIC 002 de 2024](https://sedeelectronica.sic.gov.co/transparencia/normativa/circular-externa-2-de-2024-de-la-superintendencia-de-industria-y-comercio-lineamientos-sobre-el-tratamiento-de-datos) | Alcance de datos/IA y necesidad de análisis proporcionado antes de un nuevo público |
| [OpenAI: controles de datos](https://developers.openai.com/api/docs/guides/your-data) y [DPA](https://openai.com/policies/data-processing-addendum/) | No afirmar procesamiento exclusivo en Colombia, retención cero o borrado inmediato; registrar condiciones aplicables a la cuenta |
| [WhatsApp Business](https://business.whatsapp.com/policy) | Revisar condiciones del canal, respeto de preferencias y permisos de comunicación, sin asumir autorización de campañas |
| [Oracle: regiones](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm) | `sa-bogota-1` corresponde a Bogotá, Colombia; no extrapolar ubicación a Meta/OpenAI |

Se utilizó la guía **legal:compliance-check** de la sesión para la evaluación. Su recomendación de revisión especializada de evaluaciones legales no es una certificación obtenida. Este trabajo entrega material concreto y verificable para uso/revisión internos; antes de incorporar un establecimiento externo se revisa el alcance y sus condiciones. No se contrató servicio ni se comunicó con terceros.

## Pendientes operativos concretos

| Pendiente | Evidencia necesaria |
| --- | --- |
| Entrega y autorización individual | Versión privada entregada y dos decisiones separadas por cada participante real. Una ficha anterior no acredita su autorización |
| Canal de solicitudes | Recepción técnica comprobada el 14 de octubre con captura privada de mensaje genérico. Falta recibir la consulta concreta, registrar su vencimiento y responder; no se envió correo en nombre del responsable |
| Consulta/rectificación y supresión acotada | Ensayo aislado según el procedimiento, incluidas memoria/logs/copias, sin alterar registros ajenos o inmutables a ciegas |
| Condiciones de proveedores | Registro de condiciones efectivamente aplicables a las cuentas y cadena/roles de tratamiento; leer una página no acredita acuerdo completo |
| Cierre del piloto | Fecha real y revisión/ejecución al límite elegido; no inventar un cierre para borrar datos ahora |

La purga automática local y una interfaz integral de consentimiento/solicitudes no se encontraron en el código: se documenta actuación manual, no se introduce trabajo de una fase futura por oportunidad. El producto no debe prometer automatización que falta. La inmutabilidad del dominio tampoco crea por sí sola una base legal para conservar datos personales.

El paso 7 conserva abierto su cierre operativo; el paquete documental está completado. Pasos 2/9 continúan por sus propias evidencias; el paso 8 no se reabre. El número de prueba de Meta sigue vigente y no se incorpora Neon.

## Verificación

### Seguimiento del canal — 14 de octubre de 2026

Inicialmente el responsable aclaró que aún no había enviado el mensaje de prueba. Se prepararon privadamente registro, instrucciones y borradores, sin enviar correo ni consultar/exportar datos personales de la VPS para esa solicitud.

Posteriormente aportó una captura de Hostinger Mail que muestra un mensaje genérico recibido el 14 de octubre a las 12:50. Se interpreta la hora mostrada en Colombia por el contexto del equipo; no se inspeccionaron cabeceras originales ni autenticación del remitente. La captura se archivó privadamente con SHA-256 y un registro técnico separado. Esto acredita acceso al buzón y recepción de ese mensaje. No contiene el texto de consulta de datos: el registro de consulta mantiene recepción, identidad, vencimiento y respuesta pendientes, sin exportar datos de la VPS. No hay evidencia de fallo del buzón.

Consulta DNS de solo lectura del dominio facilitado: MX `mx1.hostinger.com` (prioridad 5), `mx2.hostinger.com` (10); SPF `v=spf1 include:_spf.mail.hostinger.com ~all`. Coinciden con [los registros documentados por Hostinger](https://www.hostinger.com/support/4407237-hostinger-email-mx-records/). La ruta está configurada; no prueba que el buzón exista o sea accesible. No se modificaron DNS, planes o cuentas de correo.

Se incorporó el canal de correo al inventario de destinos de la política y al aviso. Paquete documental **1.1, 14 de octubre**, con referencias coherentes en los cuatro documentos; versión privada 1.0 preservada en `.cache/private/legal/versiones/1.0/`. La actualización de evidencia técnica conserva 1.1: no cambia finalidades ni condiciones. No cambia el backend 2.46.7. El software no manda automáticamente los borradores de consulta. El paso 7 operativo continúa pendiente de la consulta concreta, identidad y respuesta documentadas. No se afirma una nueva aceptación de documentos por parte de participantes.

Verificación de 1.1: siete documentos públicos sin coincidencias del contacto privado; enlaces locales válidos; cuatro copias privadas completas sin variables y archivos 1.0 preservados. Registro de prueba sin recepción o vencimiento inventados. Lint exit 0; siete pruebas de herramientas/observación aprobadas, cero fallidas, exit 0, 362,385 ms; `git diff --check`, exit 0. Estas pruebas no acreditan funcionamiento del buzón ni cumplimiento jurídico.

- Cinco archivos privados revisados (README y cuatro documentos completos): cero variables pendientes y cero enlaces locales rotos. Siete archivos públicos del paquete/plan revisados: cero coincidencias de los datos de contacto facilitados.
- Comprobación extendida sobre 1.331 rutas rastreadas por Git, leyendo sus archivos de texto aplicables: cero coincidencias de los valores suministrados de nombre completo, dirección, correo y teléfono normalizado. El contacto se conserva solo en archivos privados ignorados. No es una auditoría de cualquier dato personal imaginable o de todo el historial de Git.
- `git check-ignore` confirmó exclusión de ficha y cuatro documentos privados, además del README privado. Las plantillas públicas mantienen seis variables intencionales; no se entregan como copias completas al participante.
- Lint frontend: exit 0. `node --test scripts/capacity-tools.test.cjs scripts/observe-production.test.cjs`: siete pruebas aprobadas, cero fallidas, exit 0, 323,618 ms. No son pruebas jurídicas ni se crearon tests que solo reflejen el texto.
- `git diff --check`: exit 0. Los cambios son documentales; no hay modificaciones en frontend/backend/schema, proveedores o servicios productivos.
- Versionado evaluado: se conserva 2.46.7; no hay nueva capacidad funcional, migración o tag de release por este paquete de documentos.

Estas comprobaciones validan preparación y exclusión de datos privados. La captura acredita recepción técnica del mensaje observado, sin certificar cumplimiento jurídico, consulta respondida, supresión realizada o aceptación de participantes. Las copias completas locales están listas para lectura/entrega interna y el procedimiento conserva sus comprobaciones operativas pendientes.

### Verificación de la evidencia de recepción — 14 de octubre

- Captura y registro técnico privado excluidos por `git check-ignore`; remitente y contenido no publicados. Copias privadas actualizadas, sin cambiar la versión 1.1 o las condiciones del piloto.
- Siete documentos públicos: cero coincidencias de nombre completo, dirección, correo y teléfono de contacto privados o del remitente de prueba; cero enlaces locales rotos. La consulta mantiene recepción/vencimiento nulos y respuesta no enviada.
- `npm run lint` en frontend: exit 0. `node --test scripts/capacity-tools.test.cjs scripts/observe-production.test.cjs`: siete aprobadas, cero fallidas, exit 0, 1.124,9404 ms. `git diff --check`: exit 0 tras corregir una línea vacía adicional al final del plan.
- Solo documentación y registros privados: ninguna modificación funcional, consulta/exportación de datos personales de la VPS o envío de correo por el asistente.
