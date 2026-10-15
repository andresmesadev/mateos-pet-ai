# Prueba interna de empleados con IA real

Fecha: **2026-10-15**, Colombia. Versión local: **2.47.0**. Resultado final: **12 controles aprobados** con OpenAI real y PostgreSQL local desechable. [Entrega y validación general](ENTREGABLE_EMPLEADOS_OPERATIVOS_COMPLETION_REPORT.md).

El responsable autorizó «Reutilizar la clave actual» para esta prueba. Se leyó la clave existente de `backend/.env` únicamente en memoria; no se creó ni modificó ninguna credencial. Solo se enviaron a OpenAI instrucciones y datos ficticios. La base de negocio usada fue `operational_test`, enlazada a `127.0.0.1:55432`, con sus 50 migraciones aplicadas desde cero.

## Recorrido real y evidencia

El [script opt-in](../../scripts/test-operational-assistants-live.cjs) usa el SDK real, los endpoints Express reales y sus middlewares con autenticación interna activa (`NODE_ENV=production`). Las operaciones se ejecutan sobre las tablas reales de la base desechable. No abre el dashboard ni usa respuestas simuladas del modelo.

| Control | Resultado observado |
| --- | --- |
| Acceso HTTP sin token interno | Rechazado con 401 antes de llamar al modelo. |
| «Prepara un gasto de 12.500,50 pesos… categoría insumos… transferencia» | Propuesta lista, importe exacto `12500.50`, categoría `supplies`, pago `transfer`; ningún gasto antes de confirmar. |
| Pérdida de la respuesta HTTP después del commit | La fixture destruyó el socket una vez guardado el gasto. La recuperación devolvió su recibo. |
| Repetición concurrente de la confirmación | El mismo recibo; un solo gasto. |
| Buscar «Guantes de prueba interna» con lenguaje natural | Consulta devolvió el producto existente del catálogo. |
| Preparar tres cajas a 2.500 pesos sin seleccionar producto | Borrador con cantidad `3`, costo `2500.00`, producto pendiente y ningún movimiento. |
| Seleccionar producto, revisar y confirmar la entrada | Tres cajas en stock; una entrada y un recibo, también al repetir confirmación. |
| Otro establecimiento intenta leer y confirmar el gasto | Ambas peticiones rechazadas con 404. |
| Recepción intenta recuperar el recibo financiero del administrador | Rechazado con 404, sin exponer el resultado. |
| Texto pide ignorar reglas y confirmar automáticamente | No ejecutó operaciones ni cambió el establecimiento; se conservaron un gasto y dos recibos. |
| Certificación y evaluación de eventos | 17 intenciones certificadas y verificadas con reglas vacías; cero mensajes. |
| Pausar al Financiero | Su recibo previo siguió siendo recuperable; una operación nueva fue rechazada con 409. |

Salida final del proceso, código de salida **0**:

```json
{"passed":12,"failed":0,"liveCalls":4,"tokens":2049,"expenses":1,"receipts":2,"entries":1,"stock":3,"publicationIntents":17,"messages":0}
```

Las cuatro respuestas de la ejecución final fueron HTTP 200, modelo reportado `gpt-4.1-mini-2025-04-14`, terminación `stop`. Los cuatro tiempos observados fueron 1.998, 2.043, 1.003 y 1.290 ms. Los tokens se obtuvieron de `usage.total_tokens`; no se estimó un importe facturado.

## Problema encontrado y corrección

La primera ejecución hizo una llamada real de 363 tokens. El modelo interpretó correctamente `12500.50`, pero devolvió `insumos` y `transferencia` en campos que requieren códigos internos. La aplicación rechazó esos valores y no creó ningún gasto. Se detectó en PostgreSQL como una respuesta informativa `INVALID_INPUT`, sin acción ejecutable.

Se corrigió el adaptador de interpretación: sus campos de categoría y pago usan ahora los valores cerrados del mismo contrato de validación, y el mensaje de sistema explica su correspondencia con español y el formato monetario colombiano. La categoría libre de una búsqueda de inventario conserva su nombre original. También se aclara que el nombre de un producto no equivale a su ID. Las pruebas unitarias verifican estos esquemas. No cambió ninguna regla de Finanzas o Inventario.

La ejecución completa se repitió tras esa corrección y pasó los 12 controles anteriores. Total de esta sesión: **5 llamadas reales**, **2.412 tokens**; una detección inicial seguida de cuatro llamadas satisfactorias en el recorrido completo.

## Límites

Se comprobó el adaptador operativo real de Financiero y Administración/Inventario. Esta ejecución no certifica conversación o entrega por WhatsApp, calidad general de todos los prompts posibles, navegación del dashboard ni configuración del dominio público en el VPS. El recorrido anterior de navegador y las regresiones automáticas se documentan por separado en el informe de entrega.

No hubo reglas de automatización configuradas para el establecimiento sintético, destinatarios reales ni mensajes enviados. No se tocaron datos de producción. El script permite como máximo seis llamadas completadas por ejecución y exige `OPERATIONAL_LIVE_OPENAI=1`; no forma parte de las suites automáticas ordinarias ni de CI. Repetirlo requiere autorización para el uso de la clave y crea otro establecimiento ficticio.

Commit, push y despliegue siguen pendientes. La comprobación del origen público, el respaldo y la aplicación de las migraciones pertenecen al procedimiento de publicación, no se dan por certificados con esta prueba local.
