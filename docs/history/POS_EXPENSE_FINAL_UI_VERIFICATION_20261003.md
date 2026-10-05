# Egresos: consulta y aviso de salida

Fecha: 2026-10-03. Ampliación de interfaz solicitada y aceptada por el responsable.

## Alcance

- Egreso ofrece Registrar egreso y Consultar egresos.
- La consulta usa el lector administrativo existente, con período hasta hoy, búsqueda por descripción/responsable, categoría y estado. La búsqueda combina términos sin depender de tildes o mayúsculas.
- Los registros anulados conservan importe original, motivo y fecha. No suman al importe de gastos activos mostrados. Los datos heredados sin responsable se muestran como No registrado.
- Se informa el límite de 500 registros y se pide acotar el período. La suma no se presenta como total contable de una consulta posiblemente incompleta.
- Datos preparados sin guardar activan el aviso al cambiar entre formulario/consulta o seguir enlaces del dashboard en la misma pestaña. Seguir editando conserva los campos; Salir sin guardar descarta la preparación. El responsable prellenado no activa un falso aviso.
- Recargar/cerrar usa el aviso nativo beforeunload. Los resultados enviados y pendientes de comprobar conservan el mecanismo durable anterior; no se confunden con una preparación sin enviar.

## Evidencia automática

`npm run lint` en frontend: exit 0, sin diagnósticos.

`node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs scripts/pos-expense.test.cjs`:

```text
tests 30
pass 30
fail 0
```

Incluye fechas reales/rangos invertidos, combinación de búsqueda/categoría/estado, responsables heredados, rechazo de respuestas corruptas y detección de edición frente al responsable prellenado.

`npm run build -- --webpack` en frontend: exit 0, compilación y TypeScript correctos; 29/29 páginas generadas.

## Recorrido en navegador

Base PostgreSQL temporal `mateos_inventory_check_8bd532e9a27d`, con esquema local y datos ficticios; backend 127.0.0.1:3002 y frontend 3010. No se escribieron gastos ni anulaciones en los datos del aplicativo ni en la VPS.

1. Consulta inicial: tres gastos del mes, dos de hoy y uno de ayer; responsables nulos visibles.
2. Búsqueda INSUMOS con categoría Insumos: un registro correcto con su importe exacto.
3. Controles nativos de fecha y consulta de ayer: un registro por $3.000. Rango invertido rechazado con mensaje local.
4. Preparación con descripción, monto y notas; clic Nueva venta: diálogo de salida. Seguir editando conserva descripción y notas.
5. Cambio a Consultar egresos: mismo diálogo. Salir sin guardar abre la consulta sin enviar un gasto.
6. Anulación ficticia de Pago de prueba al equipo desde Caja por motivo Registro duplicado de prueba QA. El filtro Anulados muestra importe original $5.000, motivo y fecha; suma de activos mostrados $0.
7. Guardado ficticio de Compra champú QA histórica por $1.250,75, responsable María García QA y notas multilínea. Confirmación con ID persistido; cambio a consulta sin falso aviso. Búsqueda garcia champu encuentra el registro sin tildes.
8. Pantalla 390×844: documento de ancho 380, ningún input/select/button del contenido fuera del viewport; estado vacío al combinar filtros sin coincidencias.
9. Nueva preparación; Volver a caja pide confirmación. Aceptar abre Caja con el mismo Tenant seleccionado. Los datos descartados no crean un gasto.

## Limpieza comprobada

Sesión ficticia cerrada, tamaño restaurado y pestaña retirada. Se identificaron y detuvieron únicamente los dos procesos propios de la prueba. Consulta SQL de la base temporal antes de retirarla:

```text
Private fixture verified: expenses=4, voided=1, discarded forms=0, saved exact expense=1.
Private fixture removed: mateos_inventory_check_8bd532e9a27d
```

El registro anulado conserva $5.000 y su motivo; el nuevo guarda exactamente $1.250,75 una sola vez. Base temporal eliminada. Los servidores locales del usuario no se detuvieron.

## Límites y publicación

Sin cambios de backend, dominio ni esquema en estos dos ajustes. Se mantienen permisos financieros y aislamiento existente. Consulta histórica de solo lectura.

El aviso intercepta enlaces y el cambio explícito de vista de este componente; no manipula Atrás/Adelante del navegador ni bloquea navegaciones programáticas de terceros. El comportamiento de beforeunload depende del navegador. Estas limitaciones están registradas en pos-workspace.md.

Commit, push, evaluación de versión y despliegue quedan para la publicación conjunta solicitada después de la revisión del POS.
