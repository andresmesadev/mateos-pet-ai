# Egresos — implementación y verificación local (2026-10-03)

## Alcance aprobado

Cuatro ajustes aceptados por el responsable: formulario entendible, importes exactos, guardado con comprobación de resultado y anulación con motivo desde Caja. Diseño y límites registrados en `docs/architecture/pos-workspace.md`, apartado Egresos. Reutiliza Expense y Registrar/Anular Gasto; sin migraciones ni ampliación de permisos.

- Campos obligatorios etiquetados y errores junto al campo; notas multilínea; categoría **Servicios públicos**.
- Importes COP con coma o punto decimal, hasta dos decimales y el límite de Decimal(10,2). Validación del servidor rechaza valores no finitos, excesivos, fracciones menores al centavo y fechas inválidas.
- Responsable inicialmente sugerido desde la sesión y editable. Resumen incluye descripción completa, responsable, categoría, medio y fecha.
- Todas las consultas y comandos del navegador usan `proxyUrl`, conservando la selección administrativa de establecimiento. Sin tenant ni actor tomados del body.
- Confirmación muestra los datos persistidos y acciones **Ver en caja** / **Registrar otro**, sin redirección automática.
- Un intento enviado se conserva por actor/establecimiento antes del POST. Bloqueo inmediato de envío concurrente en el formulario. Error de transporte, respuesta incompleta o 5xx conserva el aviso incluso al recargar; solo consulta registros para comprobar, sin repetir el POST. Una coincidencia exige todos los datos y fecha exacta; el operador revisa y selecciona explícitamente el registro.
- Caja muestra responsable y anulación con motivo obligatorio. La lectura individual por ID está limitada al establecimiento y a administración. Anulación incierta se comprueba mediante lectura, conservando importes y antecedentes. Días cerrados siguen protegidos por el caso de uso existente.

## Evidencia de comandos

`frontend: npm run lint`: código 0, sin diagnósticos.

`node --test scripts/pos-checkout.test.cjs scripts/pos-draft-history.test.cjs scripts/pos-cash.test.cjs scripts/pos-expense.test.cjs`:

```text
tests 27
pass 27
fail 0
```

`backend: npm test -- --runInBand src/contexts/finance/__tests__/register-expense.usecase.test.js src/contexts/finance/__tests__/void-expense.usecase.test.js src/__tests__/integration/dashboard-business-access.test.js src/__tests__/integration/dashboard-expenses.test.js`:

```text
Test Suites: 4 passed, 4 total
Tests:       66 passed, 66 total
```

Incluye límites monetarios, centavos, día cerrado, anulación previa, motivo, aislamiento de la lectura y rechazo de lectura/anulación para recepción, veterinario y peluquero. `Configuration unavailable: offline` pertenece al escenario negativo intencional de permisos.

`frontend: npm run build -- --webpack`:

```text
Compiled successfully in 5.7s
Finished TypeScript in 3.1s
Generating static pages (29/29)
```

Código 0. `node --check scripts/serve-inventory-ui-local.cjs` y revisión de espacios del diff: código 0. Backend no declara script de lint; sintaxis de la ruta validada adicionalmente con `node --check`.

## Recorrido comprobado

Base PostgreSQL temporal con esquema local y datos ficticios; puertos dedicados 3002/3010. No copia datos del negocio.

1. Campos vacíos y `12500,291` muestran errores locales y no registran gastos.
2. `12500,29`, responsable `Ana QA`, transferencia y nota de dos líneas se guardan exactamente. Confirmación muestra fecha e ID del servidor; Ver en caja conserva el tenant seleccionado.
3. Caja muestra tres egresos por 27.500,39, incluyendo responsable y notas del nuevo registro. Anulación sin motivo se rechaza en el formulario. Con motivo, confirma el registro anulado y vuelve a dos egresos activos por 15.000,10.
4. Fault injection del transporte después de guardar un segundo gasto por 3.210,07: no se habilita reenvío, la recarga conserva el aviso y Comprobar registros encuentra un único registro. La selección explícita lo muestra como guardado sin un segundo POST.
5. Pérdida de respuesta después de anular ese registro: Comprobar anulación recupera estado, motivo y fecha persistidos sin repetir la solicitud.
6. Móvil 390 × 844: documento de 380 px, campos y controles dentro del viewport, sin desbordamiento horizontal de página. Navegación de pestañas conserva su desplazamiento propio.
7. Consulta SQL de la base privada confirma cinco egresos totales y dos anulados. Los importes originales 12.500,29 y 3.210,07 permanecen; responsable, notas y motivos se conservan. Exactamente un registro del gasto cuya respuesta se perdió.
8. Sesión ficticia cerrada; viewport restablecido; pestaña cerrada. `stop` terminó con código 0: `expenses=5, annulledExpenses=2`, `Private UI fixture removed.`

## Límites y publicación

El aviso local no equivale a idempotencia transaccional en servidor. No asegura unicidad entre dispositivos ni varias solicitudes simultáneas independientes. Descartar un aviso exige revisión explícita de Caja; no vuelve a enviar automáticamente. La búsqueda de comprobación conserva el límite de 500 egresos y advierte si lo alcanza. Los registros anulados se conservan en BD y en las lecturas existentes; no se crea un nuevo historial contable ni se permite editar el original.

No incorpora facturación fiscal, apertura/cierre de turno ni conciliación física. Implementado y comprobado localmente. Commit, push y despliegue siguen diferidos por instrucción previa; se evaluará la versión antes de publicar el conjunto pendiente.
