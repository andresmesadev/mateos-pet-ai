# Mejoras generales propuestas

Fecha: 8 de octubre de 2026. Estado: propuesta aceptada y cambios implementados; integración y comprobaciones automáticas aprobadas. Zoom manual y lector de pantalla pendientes por fallo del controlador nativo. [Resultados y límites](../history/FORMULARIOS_SECUNDARIOS_INTEGRACION_20261008.md).

Sí hay ajustes útiles. Priorizaría estas cuatro tareas para terminar de pulir las capacidades existentes:

## 1. Completar la unificación de formularios secundarios

**Prioridad alta.** Aplicar a **Revisar pago** y **Anular venta** la estructura común que ya usamos: campos organizados, errores junto al dato, botones visibles y aviso al cerrar con información sin guardar.

Hallazgo al proponer: en Revisar pago y Anular venta, el diálogo completo era desplazable y el error aparecía como mensaje general. Se incorporaron acciones fijas y protección común de cambios sin guardar en [Revisar pago](../../frontend/components/dashboard/pos/review-payment-dialog.tsx) y [Anular venta](../../frontend/components/dashboard/pos/void-sale-dialog.tsx).

**Beneficio:** el empleado puede corregir el dato y guardar sin buscar los botones ni perder lo que escribió. Se conservarán las comprobaciones de pago, las restricciones de anulación y la recuperación de respuestas inciertas existentes.

## 2. Explicar las acciones que todavía no están disponibles

**Prioridad media.** Mostrar el motivo junto a acciones deshabilitadas y un siguiente paso claro, visible también en móvil.

Ejemplo comprobado: en el [detalle de producto](../../frontend/components/dashboard/inventory/product-detail.tsx), **Conteo físico** se deshabilita si no hay lotes. Una explicación como «Registra una entrada para poder contar las existencias» ayudaría a entender el recorrido.

Revisar otros casos equivalentes antes de modificarlos. Mantener los permisos actuales y las acciones restringidas ocultas cuando corresponda; estas ayudas se refieren a condiciones operativas del registro.

**Beneficio:** menos botones que parecen no funcionar y menos necesidad de pedir ayuda.

## 3. Comprobar el uso real con teclado, ampliación y lector de pantalla

**Prioridad media; comprobación y corrección de hallazgos.** Recorrer los formularios y diálogos comunes con teclado, zoom real del navegador y lector de pantalla. Verificar etiquetas, anuncio de errores, orden del foco y retorno al botón que abrió el formulario.

La [última comprobación](../history/FORMULARIOS_MOVIMIENTOS_INVENTARIO_20261008.md) cubre automatización del navegador y reflujo equivalente al 200 %. Deja expresamente pendientes la prueba manual del control de zoom, el contraste y el lector de pantalla.

**Beneficio:** confirmar que la interfaz es cómoda para distintas personas y dispositivos. Corregir únicamente los problemas encontrados; las pruebas existentes se conservan.

## 4. Cerrar la integración antes de publicar

**Prioridad alta; validación del funcionamiento existente.** Comprobar con frontend, backend y una base de pruebas real los recorridos principales por perfil: administrador, recepción, veterinario y peluquero, según sus permisos configurados.

Priorizar venta de producto y descuento de existencias, consumo vinculado a una atención, anulación y recepción de devolución, y actualización del inventario en dos sesiones abiertas. Confirmar también el rechazo de operaciones sin permiso y el aislamiento entre establecimientos usando datos de prueba.

La última batería de interfaz utilizó un backend simulado; no acredita por sí sola la integración con PostgreSQL. Las pruebas de escritura necesitan una base aislada y datos preparados para ese fin, sin utilizar clientes reales ni enviar mensajes externos.

**Beneficio:** detectar diferencias entre la interfaz y el servidor antes del despliegue. Esta tarea no añade reglas, perfiles ni módulos nuevos.

## Orden recomendado

1. Unificar los formularios secundarios.
2. Explicar las acciones deshabilitadas.
3. Verificar accesibilidad práctica y corregir los hallazgos.
4. Completar integración y preparar la publicación.

Los cuatro ajustes anteriores de formularios e inventario están [implementados y verificados localmente](../history/FORMULARIOS_MOVIMIENTOS_INVENTARIO_20261008.md). Esta propuesta mantiene el alcance de presentación y validación de capacidades existentes, de acuerdo con el [Plan Maestro](../PLAN_MAESTRO.md), el [modelo de dominio](domain-model-v1.md) y la [regla de ejecución](../PHASE_2_EXECUTION_RULE.md). No constituye autorización para commit, push ni despliegue.
