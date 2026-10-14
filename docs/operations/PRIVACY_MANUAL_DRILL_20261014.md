# Paso 7 — Ensayo manual de privacidad

**Fecha:** 14 de octubre de 2026. **Base funcional:** 2.46.7. **Alcance:** piloto interno individual, con escenarios ficticios. **Resultado:** paso 7 cerrado para ese alcance, con respuesta y adjunto recibidos, preparación técnica y ensayo aislado aprobados. No habilita beta externa o participantes adicionales.

## Decisiones y evidencia

- El responsable confirmó lectura de los tres documentos privados 1.1 y pruebas solo propias con datos ficticios. Se registró el mensaje con fecha real; el texto residual entre corchetes de la plantilla no se interpretó como una corrección. Sin otros participantes actuales ni aceptaciones de terceros inventadas.
- Consulta y acuse ya recibidos, según capturas privadas. Se mantiene separado el acuse de la respuesta sustantiva.
- Autorización expresa posterior para copiar solo categorías técnicas del perfil confirmado y dentro del establecimiento: estado de sesión, cola/recibos, memoria y metadatos de logs, hacia la carpeta privada local. Se excluyeron finanzas, registros clínicos, verificación de acceso, secretos, otros participantes y registros internos de proveedores externos.

## Ensayo PostgreSQL aislado

Se obtuvo exclusivamente DDL con `pg_dump --schema-only --no-owner --no-acl` para reproducir las restricciones físicas actuales, sin filas productivas. La ejecución local usó PostgreSQL/pgvector de la misma familia, en un contenedor temporal sin red, puertos publicados o volúmenes persistentes; datos en `tmpfs`, memoria acotada y etiqueta de propiedad comprobada antes de retirarlo.

| Comprobación | Resultado observado |
| --- | --- |
| Rectificación de nombre/dirección ficticios | Valores corregidos, control en otro establecimiento sin cambios |
| Eliminación directa insegura del padre | PostgreSQL la rechazó por la relación con la cita |
| Supresión acotada | Retirados cliente ficticio y relaciones de mascota, cita, conversación, mensajes, memoria, sesiones, código de prueba y webhook exclusivo |
| Aislamiento | Usuario de control de otro establecimiento conservado |
| Inmutabilidad | Evento de dominio del control conservado, sin actualizarlo o anularlo |
| Restauración de copia anterior | Recuperó el registro ficticio eliminado, como era esperable |
| Reaplicar supresión tras restaurar | Registro y relaciones de prueba eliminados de nuevo, control conservado |
| Limpieza del entorno | Contenedor temporal retirado; no quedaron contenedores con la etiqueta del ensayo |

El primer intento falló porque la comprobación capturaba solo `foreign_key_violation`, mientras el esquema rechazó mediante `restrict_violation`. Se añadió ese rechazo esperado al ensayo y se repitió en un contenedor nuevo; resultado aprobado. No se modificó ninguna restricción ni la aplicación.

El fixture no tenía movimientos financieros ni comisiones del cliente a suprimir. Este resultado no crea una rutina universal de borrado ni autoriza alterar registros inmutables reales. Una solicitud sobre otras relaciones requiere su análisis acotado y fundamento antes de ejecutar. No se eliminaron datos productivos ni copias reales.

## Consulta técnica autorizada

La búsqueda de solo lectura identificó un único cliente del teléfono confirmado dentro del tenant, recuperó estado de sus conversaciones, filtró mensajes/contactos de webhooks y respuestas al mismo cliente y correlacionó recibos con los identificadores de mensajes de ese perfil y el canal configurado. La memoria se acotó por propietario y tenant. Se seleccionaron metadatos de coincidencias de logs; no se exportaron líneas crudas o registros generales.

Dos ejecuciones fueron rechazadas antes de correr por revisión automática: primero por alcance financiero/clínico no autorizado, luego por incluir una consulta de metadatos de verificación fuera de las categorías aprobadas. Se obtuvo la autorización técnica explícita y se retiraron completamente esas consultas. La versión acotada fue aprobada y ejecutada. No se eludió el rechazo mediante otra herramienta.

La transferencia inicial de JSON se truncó; se detectó que el proceso podía finalizar antes de vaciar la salida. Se corrigió el transporte mediante fragmentos y espera explícita de escritura, y se comprobó el documento completo antes de preparar el adjunto; ninguna versión parcial se entregó. Se corrigió además la serialización de fechas y se filtraron también contactos por canal. Scripts, JSON y datos completos permanecen privados e ignorados por Git.

La copia técnica autorizada y la copia primaria previa forman un adjunto privado con alcance y límites explícitos. No contiene expedientes financieros/clínicos, contraseñas, tokens o hashes de acceso. No se describe como una exportación de sistemas propios de Meta/OpenAI/Hostinger ni incluye audio original obtenido de ellos.

## Copias y proveedores

Inventario de solo metadatos: 29 conjuntos cifrados en la VPS y ocho copias cifradas independientes en el equipo, con archivos y manifiestos presentes. En el instante del inventario ningún conjunto de la VPS superó los días de retención declarados por su manifiesto. La comprobación no descifró copias ni acredita integridad completa o presencia/ausencia de un titular en cada contenido.

La rotación declarada en VPS es de catorce días; las copias independientes requieren revisión manual. El ensayo demostró por qué debe reaplicarse una supresión resuelta después de restaurar y antes de habilitar la operación. La conservación tras cierre del piloto sigue en treinta días, con inventario y actuación documentados; no se adelantó un cierre ni se ejecutó purga real.

El paquete 1.1 identifica Oracle, Meta/OpenAI y Hostinger y sus referencias oficiales. Esta revisión no certifica aceptación contractual de cada cuenta, eliminación en sus sistemas o ubicación exclusivamente colombiana de todo tratamiento. Antes de incorporar otras personas o establecimientos se revisan contratos/roles y el nuevo alcance; no se presume cumplido por leer una página. No hay nueva integración, contratación o cargo por este ensayo.

## Entrega y cierre del alcance individual

La captura aportada de Gmail muestra el cuerpo de la respuesta recibido el 14 de octubre a las **14:18**, hora interpretada en Colombia por el contexto de esta sesión. Se archivó privadamente con SHA-256. La imagen no muestra el adjunto: el solicitante confirmó por separado que el archivo indicado llegó y se puede abrir. No se afirma inspección de cabeceras ni verificación binaria del archivo recibido.

Respuesta enviada por el responsable, no por herramientas del asistente. Consulta atendida dentro de las categorías y destino expresamente autorizados; lectura 1.1 y alcance individual registrados, ensayo aislado aprobado y evidencia conservada privadamente. Con ello se cierra el paso 7 para el piloto interno individual. Las obligaciones al incorporar terceros o ampliar alcance no se declaran cumplidas por este ensayo.

La fecha de cierre del paso 7 no equivale al cierre efectivo del piloto ni inicia por sí sola la retención de treinta días. Aceptaciones de nuevos participantes se registran antes de incorporarlos, sin firmas por terceros o fechas retroactivas.

## Versionado

Se conserva backend 2.46.7 y documentos de condiciones 1.1: no hay nueva capacidad funcional, entidad, migración, cambio de dominio o tag. Es evidencia operacional sobre capacidades existentes, con scripts de ensayo privados. Los pasos 2, 8 y 9 mantienen sus evaluaciones independientes.

## Verificación técnica final

- Ensayo SQL en esquema físico reproducido: rectificación, rechazo de eliminación insegura, supresión acotada, control de otro establecimiento, evento inmutable y reaplicación tras restaurar aprobados; limpieza del contenedor confirmada.
- Copia preparada: coherencia de propietario/tenant, conversaciones y conteo completo de mensajes, fechas ISO de sesiones, contactos/mensajes/replies acotados y categorías excluidas ausentes. Cero campos técnicos secretos sin excluir. Se conservó sin cambios el archivo preparado/enviado; la entrega efectiva consta por separado en el registro privado.
- Ocho documentos públicos revisados: cero coincidencias de los contactos privados y cero enlaces locales rotos. `git check-ignore` confirmó exclusión de copia, texto del correo, resultados, DDL y ficha de participante. Cuerpo de correo sin instrucciones internas.
- `npm run lint` en frontend: exit 0. `node --test scripts/capacity-tools.test.cjs scripts/observe-production.test.cjs scripts/copy-offsite-backup.test.cjs`: catorce aprobadas, cero fallidas, exit 0, 1.002,265 ms. `git diff --check`: exit 0.
- Sin modificaciones de aplicación, schema, servicios productivos o datos de producción; solo evidencia y documentación. No se confunden estos tests técnicos con certificación jurídica, entrega de correo o eliminación en proveedores.

### Verificación del cierre de entrega

Evidencia de recepción y declaración del solicitante contrastadas con el registro: respuesta recibida a las 14:18 y adjunto recibido/abierto confirmado. SHA-256 de captura válido, archivo preparado/enviado conservado sin cambios y lectura/ensayo/limpieza aprobados. No se atribuye verificación binaria al adjunto recibido ni cierre al piloto completo.

Ocho documentos públicos sin contactos privados ni enlaces locales rotos; evidencia, constancia y documentos leídos excluidos de Git. Lint frontend exit 0; catorce tests de capacidad/observación/copia independiente aprobados, cero fallidos, exit 0, 1.688,4905 ms; `git diff --check` exit 0. Las tres copias privadas leídas 1.1 se preservaron antes de actualizar su nota de evidencia; las condiciones siguen en 1.1 y el backend en 2.46.7, sin nueva release funcional.
