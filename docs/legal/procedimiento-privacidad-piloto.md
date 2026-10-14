# Procedimiento manual de privacidad del piloto

**Versión:** 1.1, 14 de octubre de 2026. Guía operativa; no añade una funcionalidad al motor/dashboard ni ejecuta cambios de datos.

## Incorporación

1. Entregar el paquete privado completo con contacto del responsable antes de datos del nuevo participante.
2. Registrar separadamente condiciones y autorización verificables. Escenarios ficticios no anonimizan teléfonos reales.
3. Confirmar perfil, número habilitado en Meta, operaciones y soporte; no clientes externos o menores.
4. Guardar evidencias fuera de Git. El repositorio es público: no subir registros de personas, credenciales, conversaciones o respaldos.

## Solicitudes

Canal **{{CORREO}}**, responsable **{{RESPONSABLE}}**, contacto alterno **{{TELEFONO}}**. Recepción/seguimiento manuales. El 14 de octubre se comprobaron la llegada de la consulta de prueba y la recepción de su acuse. Revisión del alcance técnico expresamente autorizado y ensayo aislado completados; respuesta final preparada, entrega pendiente. Una petición por WhatsApp se traslada al responsable sin confiar exclusivamente en el bot.

| Paso | Acción |
| --- | --- |
| Recibir | Fecha/hora, alias, tipo, canal, evidencia, responsable y vencimiento; acusar recibo |
| Verificar | Contacto conocido y comprobación proporcional, sin cédula por defecto ni entrega a un destinatario arbitrario |
| Clasificar | Consulta, rectificación, supresión/revocación o reclamo, separado de fallos del producto |
| Buscar | Solo titular/tenant: identidad, vínculos, mensajes, sesiones, citas, memoria, payloads/recibos, logs y copias |
| Resolver | Copia comprensible/corrección o revisión de supresión; fundamento concreto de excepciones, no negativa automática por diseño del software |
| Responder | Canal privado, acciones/motivos, fecha e información de trámite ante SIC que corresponda |
| Cerrar | Evidencia mínima, responsable, versiones y gestión de copias/conservación excepcional |

Consulta: diez días hábiles y hasta cinco adicionales con aviso motivado; reclamo: quince desde el día siguiente y hasta ocho adicionales con aviso motivado. Reclamo incompleto: pedir subsanación dentro de cinco días; traslado si corresponde dentro de dos días hábiles; marca de reclamo en trámite dentro de dos días hábiles desde recibo completo. Los [artículos 14–16 de la Ley 1581](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/ley_1581_2012.htm) fijan cómputo y condiciones; conservar calendario/evidencia. No sustituirlos por tiempos de ticket técnico.

No se identificó un sistema integral de consentimiento/solicitudes en el código revisado. El procedimiento es manual; no declara una interfaz o autorizaciones previas ya existentes.

## Conservación y copias

- Decisión: durante el piloto y hasta treinta días calendario tras cierre; atender solicitudes previas y revisar necesidad mensualmente mientras esté abierto.
- VPS: respaldos cifrados rotan a catorce días; eso no purga base activa, mensajes, payloads, logs o embeddings.
- Copias independientes/restauraciones: inventario y revisión manual bajo el plazo; no hay purga local automática ni se suben dumps a Git.
- Antes de alterar datos, ensayar en base aislada, comprobar relaciones/destino e impactos. No un `deleteMany` global ni eliminar un tenant para resolver una solicitud individual.
- No modificar comisiones/eventos inmutables a ciegas. Evaluar desvinculación/anonimización admisible y fundamento; una invariante técnica no crea un deber legal de retener datos personales. Registrar y resolver una brecha antes de ejecutar, sin afirmar eliminación ya realizada.
- Documentar qué permanece restringido, por qué y hasta cuándo. En una restauración, reaplicar solicitudes resueltas antes de habilitar uso.
- Para datos enviados a proveedores, revisar sus condiciones/herramientas; borrar localmente no acredita desaparición de sus copias.

## Ensayo manual operativo

Usar registros ficticios y una base aislada. No enviar comunicaciones en nombre de participantes desde esta preparación.

| Comprobación | Evidencia requerida | Estado inicial |
| --- | --- | --- |
| Recepción técnica del canal | Evidencia privada de mensaje recibido y acceso al buzón | Comprobada, 14 de octubre; hora mostrada 12:50 Colombia, sin inspección de cabeceras |
| Consulta por el canal | Solicitud concreta del responsable recibida, registrada y con vencimiento | Recibida el 14 de octubre, hora mostrada 13:07 Colombia; alcance confirmado directamente por el responsable y límite interno conservador registrado |
| Acuse de recepción | Comunicación del responsable recibida por el solicitante | Comprobada mediante captura privada, 14 de octubre, hora mostrada 13:24 Colombia; no equivale a respuesta sustantiva |
| Información/autorización | Revisión del responsable y, al incorporar otra persona, dos decisiones separadas de ella | Responsable confirmó lectura 1.1 y alcance individual; no hay otros participantes actuales |
| Consulta/rectificación | Respuesta privada acotada y corrección contrastada | Copia técnica autorizada preparada; rectificación ficticia verificada en base aislada; entrega final pendiente |
| Supresión/anonimización | Operación acotada probada, copias y excepciones documentadas | Supresión de fixture y reaplicación tras restaurar aprobadas; sin borrado productivo ni rutina universal |
| Cierre/conservación | Fecha real y límite, inventario y acciones | Al cierre efectivo |

## Incidentes y otro alcance

Ante incidentes: detener el recorrido afectado, restringir acceso, preservar evidencia mínima, identificar datos/destinatarios, corregir y evaluar avisos según obligaciones aplicables. No prometer soporte permanente ni importar automáticamente un plazo de 72 horas de otro régimen.

Antes de un establecimiento externo o clientes reales, revisar responsables/encargados, acuerdos de transmisión, políticas/canales del negocio, proveedores, conservación y ensayos. Este paquete interno no certifica esa etapa ni autoriza campañas o integradores externos.
