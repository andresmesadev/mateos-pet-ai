# Política de tratamiento de datos — piloto interno de Mateos Pet AI

**Versión:** 1.1, preparada el 14 de octubre de 2026. **Copia:** plantilla pública; contacto completo en la versión privada del responsable. No es una política publicada en la aplicación ni una autorización ya otorgada por participantes.

## 1. Responsable y alcance

Responsable: **{{RESPONSABLE}}**, persona natural, con domicilio en **{{CIUDAD}}, {{PAIS}}**. Contacto: **{{CORREO}}**, **{{TELEFONO}}**, dirección de correspondencia **{{DIRECCION}}**. El mismo responsable atiende las solicitudes de privacidad.

Esta versión cubre pruebas internas supervisadas con adultos autorizados, un establecimiento de prueba y escenarios ficticios de clientes, mascotas, agenda, consultas, peluquería, caja e inventario. Los números de WhatsApp y los datos de quienes prueban pueden ser reales aunque el escenario sea ficticio. No se incorporan clientes ajenos a la prueba ni menores en este alcance.

Mateos Pet AI es la denominación del piloto, no una declaración de marca registrada. Antes de un establecimiento externo se deberán definir sus responsabilidades sobre datos de clientes y las del prestador. Esta política interna no cubre automáticamente esa relación.

## 2. Información tratada

| Grupo | Datos y uso |
| --- | --- |
| Identidad y contacto | Nombre o alias, teléfono, correo y perfil que entrega Meta; vínculo con mascotas ficticias |
| Operación ficticia | Mascotas, citas, servicio, horarios, recogida y dirección ficticia, notas y operaciones simuladas. No ingresar salud de personas, tarjetas o expedientes reales |
| Conversaciones | Mensajes, transcripciones de prueba, estado de conversación/reserva, fragmentos e índices de memoria semántica |
| Personal y acceso | Ficha, rol, correo de ingreso, contraseña individual protegida mediante hash, sesiones y autoría |
| Evidencia técnica | Identificadores y payloads de webhooks, cola, intentos, tiempos, recibos, errores, accesos HTTP y seguridad. Algunos registros pueden contener datos personales |
| Participación y solicitudes | Información entregada, versiones aceptadas, autorización, consultas y reclamos |

Una voz puede identificar al participante. Si se usa audio, se descarga temporalmente y se envía a OpenAI para transcribirlo; la aplicación intenta limpiar el temporal al terminar. No usar audios de terceros o información sensible. No se promete borrado instantáneo de toda copia.

## 3. Finalidades

Identificar al participante, separar contexto, probar agenda/comunicación/accesos, diagnosticar fallos, conservar evidencia de autorización y atender solicitudes. La IA interpreta solicitudes y redacta respuestas; las reglas de agenda validan disponibilidad y las operaciones se contrastan con el dashboard. Se puede acudir al responsable para revisar una respuesta o continuar de forma humana.

No se usarán datos del piloto para campañas, venta de datos o entrenamiento de modelos por iniciativa del equipo. El código de reactivación no autoriza campañas con participantes. Un propósito nuevo exige evaluación e información; no se presume aceptado por una prueba anterior.

## 4. Autorización y voluntariedad

Antes de incorporar otra persona se entregan esta política, los términos y el aviso del [acuerdo](acuerdo-piloto-interno.md), y se conserva una autorización verificable. Una ficha, una contraseña o un saludo no demuestran por sí solos entrega y aceptación de esa información. Se registran separadamente condiciones y autorización.

No se solicitan datos sensibles de personas. Puedes no enviarlos, no usar audio, retirarte o solicitar revisión de tus datos. No debes aportar información de terceros. Fundamento: [Ley 1581, artículos 8, 9 y 12](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/ley_1581_2012.htm).

## 5. Infraestructura y proveedores

| Destino | Configuración observada (VPS: 13 de octubre; DNS de correo: 14 de octubre) | Información que puede recibir |
| --- | --- | --- |
| Oracle Cloud Infrastructure, `sa-bogota-1` | VPS y PostgreSQL en Bogotá, Colombia | Base, archivos y logs alojados en esa infraestructura, con administración autorizada |
| Meta / WhatsApp Cloud API | Canal de prueba configurado | Teléfono, perfil, mensajes/media y metadatos de entrega |
| OpenAI API | Configurada | Texto e historial seleccionado, contexto de reserva/negocio, texto para índices semánticos y audios cuando se usan. Puede incluir nombres o dirección presentes en la prueba |
| Hostinger Email | Ruta del canal configurada mediante MX; acceso y recepción de un mensaje genérico comprobados mediante captura privada el 14 de octubre | Remitente, contenido y metadatos de solicitudes cuando se envían al canal designado; no acceso al expediente de mascotas por este hecho |
| Equipo local del responsable | Copia independiente cifrada y ensayos locales autorizados | Respaldos, bases de prueba y evidencias restringidas, excluidos de GitHub |

La región de la VPS se verificó en metadatos de instancia; Oracle la identifica como [Colombia Central, Bogotá](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm). Esto no significa que Meta, OpenAI, el correo o sus proveedores procesen exclusivamente en Colombia. Los [MX de Hostinger](https://www.hostinger.com/support/4407237-hostinger-email-mx-records/) identifican la ruta de correo; no acreditan existencia del buzón ni mensajes recibidos.

Google Calendar, Stripe y Sentry no estaban configurados en esta VPS. Antes de activarlos se revisarán finalidad, datos y condiciones: Calendar puede recibir nombre/tipo de mascota y teléfono del dueño además del servicio/horario; Stripe, datos de facturación; Sentry, información de errores según su configuración. Su código existente no los convierte en proveedores activos de estas pruebas.

El responsable registra condiciones, roles y ubicaciones de proveedores. Se distingue transmisión por cuenta del responsable de transferencia a otro responsable, verificando fundamento y contrato; un enlace no demuestra aprobación contractual. Ver [Decreto 1074, sección de transmisión internacional](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr026.htm), [DPA de OpenAI](https://openai.com/policies/data-processing-addendum/) y [política de WhatsApp Business](https://business.whatsapp.com/policy).

El acceso depende de establecimiento, rol y permisos. El administrador y personal técnico autorizado pueden realizar soporte supervisado. No se promete que el administrador del sistema carezca de toda capacidad de revisión.

## 6. Conservación

Datos personales mínimos durante las pruebas y **hasta treinta días después del cierre registrado del piloto**, plazo elegido por el responsable. Al cierre se inventarían los registros y al vencer el plazo se ejecuta y documenta la eliminación/anonimización correspondiente. Una excepción necesita fundamento específico, alcance y fecha de revisión; no basta mantener una cuenta activa indefinidamente.

Es una obligación operativa manual, no una purga automática de todos los modelos. Abarca base, memoria semántica, webhooks, logs, evidencias, restauraciones locales y copias independientes. Las solicitudes previas se atienden sin esperar al cierre; no se borran a ciegas registros de auditoría ni se ignoran obligaciones legales aplicables.

Los respaldos cifrados de VPS tienen rotación de **14 días**. Las copias locales independientes no tienen purga automática: el responsable debe revisarlas bajo el plazo del piloto. Eliminar un registro activo no elimina su copia anterior. En una restauración se reaplican las solicitudes ya resueltas antes de habilitar uso. Los plazos de proveedores dependen de sus condiciones/configuración; no se afirma retención cero o borrado instantáneo en sus sistemas.

## 7. Derechos y solicitudes

Puedes conocer, actualizar y rectificar datos, pedir prueba de autorización e información de uso, solicitar supresión/revocación cuando proceda y acceder a tu información. Puedes acudir a la SIC después del trámite previo correspondiente. Escribe a **{{CORREO}}**; si llega una petición por el WhatsApp de prueba, se traslada al responsable sin depender exclusivamente del bot.

Se verifica identidad proporcionadamente, sin cédula por defecto, y se responde privadamente sin revelar otro titular. Según [Ley 1581, artículos 14–16](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/ley_1581_2012.htm):

- Consulta: diez días hábiles desde recepción; hasta cinco adicionales con aviso motivado.
- Reclamo: quince días hábiles desde el día siguiente a recepción; hasta ocho adicionales con aviso motivado.
- Si está incompleto, se pide subsanar dentro de cinco días. Se aplican las marcas de trámite y el traslado que ordena la ley.

El [procedimiento](procedimiento-privacidad-piloto.md) registra responsable, vencimiento y acciones. Una petición no se pierde porque la IA no la clasifique correctamente.

## 8. Seguridad e incidentes

Se utilizan sesiones autenticadas, permisos por rol/establecimiento, límites de frecuencia, hashes para credenciales individuales y mecanismos de identidad de cliente, y respaldos cifrados. Los secretos administrativos y de integración son configuración restringida: no se afirma que todos sean hashes. Evidencias privadas y credenciales de ejemplo se excluyen de Git.

Ante incidentes se conserva evidencia mínima, se limita el acceso afectado y se evalúan avisos a personas/autoridades que correspondan. No se importan automáticamente plazos de otras jurisdicciones. No hay promesa de seguridad absoluta o certificación integral.

## 9. Vigencia

La versión efectiva y su entrega se registran antes de participar. Cambios de finalidad, proveedor, público o datos requieren revisión y comunicación, y nueva autorización cuando corresponda. Se conserva la versión aceptada y se revisa mensualmente la necesidad de datos mientras siga abierto el piloto.

Marco: Ley 1581, Decreto 1074 y [Circular SIC 002 de 2024 sobre datos e IA](https://sedeelectronica.sic.gov.co/transparencia/normativa/circular-externa-2-de-2024-de-la-superintendencia-de-industria-y-comercio-lineamientos-sobre-el-tratamiento-de-datos). La preparación técnica no es un dictamen jurídico ni habilita clientes externos.
