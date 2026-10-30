# Proveedores de la operación real — revisión del 27/10/2026

Revisión técnica y de condiciones públicas para el ítem 7. No acredita
contratos particulares aceptados, configuración de las cuentas ni recepción
de autorizaciones. La responsable del centro es Lina; Nexo Web todavía no
está constituida. No se enviaron registros de clientes para investigar estas
condiciones, ni se cambiaron servicios, permisos o configuraciones.

## Alcance comprobado

| Proveedor o destino | Datos y uso identificados | Resultado |
| --- | --- | --- |
| Oracle Cloud Infrastructure, Colombia Central/Bogotá | Aplicación y PostgreSQL con datos de propietarios, mascotas, atenciones, ventas, pagos y personal; respaldos cifrados de la VPS. | Alojamiento identificado; condiciones públicas revisadas. Falta conservar la referencia del acuerdo aplicable a la cuenta. |
| OpenAI API | Salud: listado de modelos. Asistentes: texto escrito por el operador cuando se solicita interpretación en lenguaje natural. Código conversacional: mensajes, historial y contexto; embeddings de textos y transcripción de audio cuando se invoquen esas funciones. | Clave configurada; no equivale a envío automático de toda la base. No se acreditaron controles especiales de retención ni ajustes del proyecto. |
| Microsoft Outlook.com/Hotmail | Correo del centro confirmado privadamente; solicitudes, contenido, adjuntos y metadatos que se reciban o envíen por ese buzón. | Proveedor identificado por el dominio y las condiciones de Outlook.com. No se presume licencia empresarial Microsoft 365. Falta comprobar acceso de Lina y seguridad de la cuenta. |
| WhatsApp Business App | Atención manual y futura entrega de política/respuestas. | Modalidad confirmada por Andrés; [revisión específica y procedimiento](entrega-y-autorizacion-whatsapp.md). Dispositivos y respaldos pendientes de comprobar. |
| GitHub Actions | URL pública de salud y avisos de ejecución. | Esa comprobación no consulta fichas. El repositorio es público: mantener fuera adjuntos, evidencias, credenciales y respaldos. No se auditó todo el historial de Git en esta revisión. |
| Computador autorizado | Copias cifradas, recuperación y evidencia privada. | Custodia y ciclo local de conservación separados de la rotación VPS. |

Google Calendar, Stripe y Sentry no tenían credenciales configuradas en la
consulta de producción de esta fecha. WhatsApp del aplicativo está pausado y
sin credenciales operativas; el WhatsApp Business manual sí se usa. No se
declaran destinatarios actuales por la mera presencia de código.

## Oracle: condiciones y límites

La política de servicios distingue datos tratados por cuenta del cliente y
datos técnicos de operación. Prevé confidencialidad, asistencia para derechos,
notificación de incidentes y subencargados; contempla tratamiento internacional.
Prevalecen las condiciones incorporadas al pedido/acuerdo. Por eso, alojar la
VPS en Bogotá no demuestra circulación exclusiva en Colombia ni permite
atribuir a esta cuenta un DPA no comprobado. [Política oficial de servicios](https://www.oracle.com/legal/privacy/services-privacy-policy/).

El modelo contractual enlaza acuerdo, pedido y políticas. El catálogo público
requiere seleccionar servicio/país; no se recuperó ni validó el contrato
particular de esta cuenta. No se sustituyó por condiciones de NetSuite o de
EU Sovereign Cloud, que son productos distintos. [Contratos Cloud](https://www.oracle.com/contracts/cloud-services/).

## OpenAI: API y datos que salen del aplicativo

La documentación de API indica que no usa datos para entrenar modelos por
defecto, salvo participación expresa. Los registros de control de abuso pueden
contener contenido y conservarse hasta treinta días, con excepciones legales
o de protección del servicio. El estado de aplicación depende del endpoint y
las funciones usadas. Retención cero requiere elegibilidad/aprobación y no
está acreditada aquí. [Controles de datos de API](https://developers.openai.com/api/docs/guides/your-data).

El DPA publicado regula tratamiento por cuenta del cliente, instrucciones,
confidencialidad, asistencia y subencargados. Su publicación no demuestra qué
acuerdo y configuración corresponden al titular del proyecto utilizado.
[DPA de OpenAI](https://openai.com/policies/data-processing-addendum/).

Evidencia local, revisada sin modificar código:

- `backend/src/services/health.service.js`: `models.list`; no adjunta fichas.
- `backend/src/contexts/agents/application/operational/attention.js` e
  `infrastructure/operational/interpreter.js`: si la solicitud es natural,
  envía `clean.text` como mensaje al modelo para extraer intención/campos.
  Las consultas de negocio se ejecutan después; ese intérprete no recibe
  automáticamente todas sus filas como parte de la petición examinada.
- `backend/src/services/openai.service.js`: análisis y respuesta con mensajes,
  historial, sesión y contexto recibido del llamador.
- `backend/src/services/embedding.service.js` y `audio.service.js`: texto para
  embeddings y archivo de audio para transcripción, respectivamente.
- No se encontraron coincidencias de `nodemailer`, `sendMail` o `smtp` en
  fuentes JavaScript de `backend/src` excluyendo tests. Es un alcance de búsqueda,
  no una auditoría de todas las aplicaciones usadas por el centro.

No afirmar que pausar WhatsApp elimina todas las llamadas de IA: los asistentes
del dashboard tienen su propio punto de entrada. Usar solo texto necesario;
no pegar contraseñas, documentos de identidad ni expedientes completos como
atajo. Esta revisión identifica capacidades del código, no demuestra el
contenido de solicitudes históricas ni autorización previa de cada titular.

## Correo: servicio de consumo identificado

Microsoft incluye direcciones Hotmail en Outlook.com, su correo de consumo.
Su declaración contempla tratamiento del correo y metadatos, conservación y
circulación internacional. No se promete residencia exclusiva en Colombia ni
borrado instantáneo al eliminar un mensaje. [Declaración de privacidad](https://www.microsoft.com/en-us/privacy/privacystatement).
El acuerdo de servicios de consumo, efectivo desde el 30/09/2026, es la
referencia pública revisada; no se atribuye el DPA de Microsoft 365 empresarial
a este buzón sin prueba de ese producto. [Acuerdo de servicios](https://www.microsoft.com/en-us/servicesagreement).

No se publican aquí la dirección completa, credenciales ni contactos de
recuperación. No se cambió el correo del centro ni se contrató otro servicio.

## Pendientes acotados de cuentas y adopción

**Confirmación posterior del 27/10:** el operador confirmó que es titular y
administrador de Oracle y OpenAI API. También confirmó las personas/dispositivos
que usan los canales manuales; detalle mínimo en custodia privada. Es una
declaración del operador, no inspección técnica de ajustes.

1. Titular de Oracle y OpenAI identificado. Contrastar referencia y condiciones
   aplicables a esas cuentas; no inventar una persona jurídica Nexo Web.
2. El operador comprobó las tres opciones de compartir datos de OpenAI API
   en Disabled el 27/10. Se da por documentada esa comprobación declarada;
   no equivale a retención cero. Faltan contraste técnico del proyecto usado
   por el aplicativo y condiciones particulares de conservación/residencia.
   No se cambió ninguna opción ni se contrató otro plan.
   Captura inicial: API call logging en Enabled per call, distinto de Sharing.
   Después, el operador confirmó que lo cambió a Disabled. Las llamadas Chat
   Completions examinadas no envían store. No se acredita retención cero,
   eliminación de registros previos ni inspección posterior independiente.
   Audit logging no fue activado por esta tarea.
3. Acceso de Lina y mapa declarado de personas/dispositivos ya confirmados.
   Verificación en dos pasos confirmada por el operador para las cuatro cuentas.
   El operador confirma copia de WhatsApp Business en Google Drive con cifrado
   de extremo a extremo de la copia activado y teléfono de recuperación del correo;
   no copiar contraseñas, claves de cifrado o códigos al expediente documental.
   Estas confirmaciones no acreditan inspección independiente ni restauración de chats.
4. Incorporar proveedores/finalidades comprobados a la política completa.
   Resolver las condiciones de circulación aplicables a Colombia según el
   servicio y relación contractual; no confundir cláusulas europeas con una
   certificación colombiana. Mantener evidencia privada de esa revisión.

**Avance:** identificación técnica/revisión pública y confirmación del operador
sobre titulares, acceso, doble factor, controles Sharing/logging, copia de
WhatsApp y recuperación del correo documentadas. No volver a solicitar esas
confirmaciones como pendientes. Contraste técnico de proyecto y condiciones
particulares permanecen abiertos. El ítem 7 quedó cerrado documentalmente mediante el
[acta del 27/10](../../operations/CLOSED_BETA_LEGAL_DOCUMENTATION_CLOSURE_20261027.md);
este seguimiento S7-2 sigue abierto y no acredita cumplimiento integral.
