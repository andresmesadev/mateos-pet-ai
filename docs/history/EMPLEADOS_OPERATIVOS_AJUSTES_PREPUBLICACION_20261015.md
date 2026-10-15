# Empleados operativos — ajustes previos a publicación aplicados

Fecha: 2026-10-15, Colombia. Versión local: **2.48.0**. Autorización: «perfecto aplicalas por favor», sobre los cuatro hallazgos de la [revisión previa](EMPLEADOS_OPERATIVOS_REVISION_PREPUBLICACION_20261015.md). **Los cuatro ajustes están implementados y comprobados localmente.** No se ejecutaron commit, push, tag, despliegue, migraciones productivas ni mensajes reales.

## Cambios y alcance

1. **Vistas completas y límites de WhatsApp.** El adaptador diferencia texto simple (techo conservador de 4.000 caracteres) de mensajes con botones (1.024). Cuenta caracteres Unicode completos y valida también cantidad, títulos e IDs de botones antes de llamar al proveedor. Coordinador y entrega usan esos límites. Una propuesta que no cabe conserva su revisión, su contenido y su selección en el hilo; responde con el control fijo para continuar en el dashboard, sin crear un botón ni una vista truncada. Se comprobó que tanto un gasto largo como una entrada larga pueden confirmarse después desde dashboard, sobre la misma propuesta.
2. **Búsquedas con botones.** La búsqueda muestra un resumen explícito con nombre, presentación, referencia, disponibilidad y precios/costos únicamente cuando ya los permite el contrato consultado. Conserva nombres y referencias completos; no imprime cursores opacos. El resultado técnico completo permanece en el snapshot autorizado. La paginación y selección nativa siguen funcionando. Las propuestas de ejecución conservan su revisión completa obligatoria; no se confunden con ese resumen de búsqueda.
3. **Recuperación administrativa sin apropiación de época.** Un reintento vuelve a firmar la misma operación de registro con nonce/plazo frescos, manteniendo `operationId`, `bootId`, cuerpo y `expectedEpoch`. Antes del commit puede terminar el registro original; después de perder la respuesta recupera su único resultado. El backend rechaza también una recuperación si ese arranque ya fue sustituido. No se aceptan sobres vencidos ni se consulta una época nueva para reclamarla automáticamente. No cambian credenciales, límites de permisos ni persistencia.
4. **Ruta privada y chequeo de despliegue.** La plantilla usa `http://frontend:3001/api/internal/operator-authority`, consistente con Compose. `backend/src/scripts/check-operator-channel.js` comprueba almacenamiento y RPC firmado con correlación y época actual, sin llamar a Meta ni escribir desde el comprobador. Su respuesta solo indica estado y comprobaciones, sin secretos o datos del operador. Un frontend que aún no se haya registrado puede realizar su registro normal cuando atiende el RPC. Con la función deshabilitada devuelve `disabled` sin conexión. `scripts/deploy.sh` incorpora ese chequeo con reintentos limitados después de levantar ambos servicios; falla si un canal habilitado no está listo.
5. **CI con PostgreSQL propio.** El nuevo job `operational-employees-postgres` usa la imagen fijada existente, puerto local 55432 y base `operational_test_ci`, compatibles con las barreras de las suites. Genera clientes, aplica migraciones y ejecuta ambos archivos con `--test-concurrency=1`. Conserva las carreras internas. No usa claves reales de OpenAI/Meta. Los cuatro nuevos tests de recuperación/configuración del frontend entran en el descubrimiento de helpers ya existente.

Los puntos 1–2 corresponden al primer hallazgo de la revisión. El resto corresponde respectivamente a recuperación, configuración y CI. No se agregan operaciones, agentes, fases, entidades de negocio ni migraciones. Se conserva 2.48.0 porque son correcciones de esa entrega local aún sin publicar; backend y lockfile ya coinciden y salud importa la misma versión.

## Evidencia de ejecución

```text
Jest --runInBand --silent --json:
  Test Suites: 195 passed, 195 total
  Tests:       1552 passed, 1552 total
PostgreSQL — operational-assistants + operator-whatsapp, secuenciales:
  tests 60; pass 60; fail 0
PostgreSQL — inbound-queue, esquema aislado:
  tests 13; pass 13; fail 0
Node — authority + reauth + proxy + check-docs:
  tests 26; pass 26; fail 0
Frontend npm run lint: exit 0
Frontend npm run build: compilación y TypeScript aprobados, 32/32 páginas
Prisma migrate deploy: cadena de 52 migraciones aplicada en base desechable nueva
bash -n scripts/deploy.sh: exit 0
CI YAML: parseado; job, puerto, entorno y comando secuencial comprobados
Comprobador con función deshabilitada: {"status":"disabled"}, exit 0
git diff --check: exit 0
```

La prueba de recuperación del frontend compila y ejecuta el módulo TypeScript con reloj y transporte simulados, cubriendo falla antes del commit, pérdida de respuesta después del commit y arranque antiguo. PostgreSQL comprueba que la renovación tras 31 segundos conserva un único recibo de registro y que una época posterior cerca al arranque anterior. La prueba HTTP usa un servidor local que representa el emisor Next y la autoridad real de la base desechable; verifica transporte, firmas y rechazo de respuesta alterada. No certifica la red Docker/VPS ni el proveedor real.

Las primeras iteraciones de las pruebas detectaron un fixture de inventario que excedía el límite de Nota del dominio, el comportamiento anterior de recuperación de un arranque sustituido y la representación demasiado extensa de búsquedas. Se ajustó el fixture para usar una nota válida, se exige ahora el rechazo de esa recuperación y se añadió el resumen explícito de búsquedas; la ejecución final de 60 pruebas no contiene fallos.

La regresión de cola histórica conserva sus 13 casos; se ejecutó en un esquema distinto de la misma base local. Se mantuvieron intactos los servicios protegidos de conversación/WhatsApp/agenda/disponibilidad. El grep completo conserva la única invocación directa de `sendWhatsAppMessage(...)` en el proveedor existente de Comunicación. Las plantillas mantienen la función deshabilitada y la clave privada vacía.

## Uso del chequeo y límites de publicación

Después de configurar un entorno autorizado y arrancar frontend y backend:

```bash
docker compose exec -T backend node src/scripts/check-operator-channel.js
```

Una respuesta `ready` certifica almacenamiento y RPC administrativo de ese instante; **no certifica entrega de Meta**. `disabled` es el resultado esperado mientras el canal permanece apagado. La salud general y este chequeo tienen propósitos distintos. No se ejecutó el script de despliegue contra la VPS.

CI quedó configurado y sus comandos relevantes se comprobaron localmente; no se afirma un run verde en GitHub antes del push. La prueba con cuenta/teléfono real, la configuración productiva y la habilitación controlada siguen pendientes de autorización. El contenedor de pruebas es propio, sin volúmenes, y se retira al terminar; no se modifica el contenedor habitual de desarrollo. Los temporales locales no forman parte de la entrega.
