# Seguimiento de clientes — implementación y verificación

Fecha: 5 de octubre de 2026. Estado: cambios locales implementados y comprobados; pendientes de publicación.

## Cuatro mejoras aplicadas

1. **Pendientes integrados con el expediente.** La bandeja consulta `PetNextAction` y conserva antecedentes de `MedicalRecord` sin duplicar los que ya tienen acción asociada, incluso cuando esta fue realizada o descartada. Búsqueda por mascota/propietario, filtro por tipo y fecha pasada, paginación de 20 y confirmación de cambios. Un fallo HTTP conserva la fila y muestra el error. Ocultar un antecedente no representa una atención realizada.
2. **Pantalla organizada por establecimiento.** Recuperación se llama **Seguimiento de clientes**, con Pendientes, Clientes por contactar y Resultados. Contacto comercial y estimación de frecuencia aparecen únicamente con Peluquería activa. Veterinaria usa los seguimientos registrados, sin imponer retorno comercial a los 60 días. Pet shop muestra una explicación cuando no tiene módulos de atención. Las rutas anteriores redirigen a la vista unificada.
3. **Acciones del trabajo diario.** Ver expediente, abrir la conversación interna existente y agendar cita con propietario/mascota preseleccionados. Si no hay conversación, se informa claramente. La ficha del cliente admite el enlace directo. Agendar no marca automáticamente un pendiente como realizado. Se corrigió el gate que impedía al administrador de una peluquería resolver sus acciones; los otros roles y el gate de historia clínica mantienen su política.
4. **Contacto y resultados verificables.** Comprobación de configuración, teléfonos válidos, selección explícita, vista previa de la plantilla existente y confirmación. Enviados, fallidos y omitidos se distinguen; los fallidos permanecen seleccionados. Un error al registrar la métrica después de enviar se informa sin ofrecer ese destinatario como fallido. Resultados describe sus métricas históricas sin atribuir causalidad al contacto.

Diseño de integración: [customer-followup-integration.md](../architecture/customer-followup-integration.md). No hubo migración, cambio de esquema, nuevas reglas clínicas ni cambios de comisiones o precios.

## Evidencia de comandos

Ejecutados con Node, desde sus carpetas respectivas:

```text
backend: node node_modules/jest/bin/jest.js --runInBand --silent
BACKEND EXIT 0 SIGNAL null
Test Suites: 164 passed, 164 total
Tests:       1292 passed, 1292 total
Time:        25.208 s, estimated 34 s

frontend: node node_modules/eslint/bin/eslint.js .
LINT EXIT 0

frontend: node node_modules/next/dist/bin/next build --webpack
BUILD EXIT 0
✓ Compiled successfully in 5.3s
✓ Generating static pages using 11 workers (29/29) in 769ms

git diff --check
EXIT 0
```

Una ejecución conjunta anterior de Jest y compilación terminó con código 9 sin resumen de Jest. Se repitió la suite completa de forma separada y terminó correctamente con el resultado mostrado arriba. Las advertencias de normalización LF/CRLF de Git no representan errores del diff.

Pruebas añadidas: proyección y paginación de seguimientos, alias de antecedentes, aislamiento entre establecimientos, módulos, permisos, validación de destinatarios, configuración de plantilla, envíos parciales y fallo al guardar métricas.

## Recorrido comprobado en navegador y PostgreSQL

Se usó `node scripts/serve-inventory-ui-local.cjs --seed-followups`, con dos bases temporales independientes y proveedor de mensajes simulado. Ningún mensaje salió a clientes reales.

- PostgreSQL: 23 pendientes, páginas de 20 y 3; un antecedente asociado a una acción cerrada no reaparece. Una acción de otro tenant queda excluida. Peluquería sola: 11 pendientes; Pet shop solo: 0.
- Búsqueda, filtro y navegación entre páginas comprobados. Sin coincidencias aparece un estado vacío claro.
- PATCH 503 simulado: error visible, fila conservada; el reintento exitoso actualiza la bandeja. Realizar y descartar se guardan y mantienen el historial.
- Antecedente de vacuna: confirmar Ocultar lo retira de la bandeja sin presentarlo como atención completada.
- Establecimiento solo de peluquería: filtros Peluquería/Otro, sin acciones clínicas expuestas en la navegación. Marcar realizado redujo la bandeja de 11 a 10 y se persistió en PostgreSQL.
- Expediente y ficha del cliente abren la mascota/propietario correctos. WhatsApp abre la conversación interna correspondiente; un cliente sin conversación recibe una explicación.
- Crear cita abre el formulario existente con propietario/mascota preseleccionados. No se creó una reserva en este fixture, que no tiene catálogo de servicios; esta prueba acredita la integración y preselección.
- Campaña: dos teléfonos válidos seleccionables y teléfono inválido deshabilitado. Vista previa con dos destinatarios y texto personalizado. Resultado simulado: 1 enviado, 1 fallido, 0 omitidos. El reintento incluye solo al fallido y, con cero envíos, informa que no se confirmó ningún envío.
- Canal desconfigurado: revisión/envío bloqueados y motivo visible. Veterinaria sola y Pet shop solo: campaña de peluquería oculta.
- Vista de frecuencia presenta cantidades y fechas reales, explica el criterio y evita porcentajes predictivos inventados. Resultados diferencia contacto/regreso y recuerda que no demuestra causalidad.
- Pantalla móvil de 320 px: ancho del documento 310 px y `scrollWidth` 310 px, sin desbordamiento horizontal. Pestaña activa con texto blanco. El ajuste temporal de tamaño se restableció.

Salida de cierre del último entorno:

```text
Private followup evidence: mock sends=0, done=2, dismissed=0, pending=21, contacted=0
Fixture evidence: products=0, movements=0, sales=0, returns=0, expenses=0, annulledExpenses=0
Private UI fixture removed.
```

La evidencia de envíos parciales corresponde al primer entorno, que también se retiró; el último se centró en permisos, antecedentes y presentación final. Ambos entornos fueron eliminados al terminar.

## Límites y publicación

- La campaña requiere un canal y la plantilla existente configurados. La configuración no acredita aprobación de Meta: un envío real y su aceptación por el proveedor no fueron comprobados con clientes.
- En esta primera revisión se conservó el alcance previo: inactividad de peluquería mayor a 60 días, hasta 500 clientes inactivos; frecuencia hasta 50 resultados. La revisión posterior eliminó el recorte de clientes en esta pantalla mediante paginación real; ver [ajustes finales](SEGUIMIENTO_CLIENTES_AJUSTES_FINALES_20261005.md). Frecuencia conserva hasta 50 resultados. Antecedentes sin acción asociada conservan la ventana previa de 180 días pasados y 60 futuros; las acciones canónicas no reciben ese recorte.
- No se añadió persistencia de campañas ni garantía nueva de idempotencia entre solicitudes. Ante una respuesta de envío incierta, la interfaz recomienda revisar las conversaciones antes de repetir.
- Seguimiento conserva su acceso administrativo. Una futura delegación a recepción requiere definir una capacidad específica.
- Los cambios previos de Inventario se conservaron. No se hizo commit, push, tag ni despliegue en esta tarea. No se cambió la versión publicada: al preparar la publicación debe evaluarse el bump por estas mejoras funcionales junto con Inventario.
