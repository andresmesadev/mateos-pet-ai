# Empleados operativos — revisión previa a publicación

Fecha: 2026-10-15. Versión local revisada: 2.48.0. Solicitud: identificar mejoras antes de commit, push y despliegue. Revisión propia con las guías `engineering:code-review` y `engineering:deploy-checklist`. No se modificó código funcional ni se autorizó publicación.

**Actualización posterior autorizada:** los cuatro hallazgos se corrigieron y comprobaron localmente. [Cambios, resultados finales y límites](EMPLEADOS_OPERATIVOS_AJUSTES_PREPUBLICACION_20261015.md). El diagnóstico siguiente conserva el estado que originó las correcciones; ya no representa cuatro tareas pendientes.

La [validación local anterior](ENTREGABLE_EMPLEADOS_OPERATIVOS_WHATSAPP_COMPLETION_REPORT.md) conserva sus resultados. Esta revisión adicional detecta cuatro puntos que aquellas pruebas no cubrían. **Dictamen para publicación/habilitación: corregir los puntos siguientes y ejecutar sus pruebas de regresión antes de publicar.** El canal sigue deshabilitado por defecto.

## Hallazgos

### 1. P1 — límite del cuerpo de mensajes con botones

Ubicación: `backend/src/application/operator-channel/coordinator.js`, función `display`, línea 29; `backend/src/contexts/communication/application/use-cases/operator-delivery.js`, línea 73; proveedor privado de WhatsApp.

El coordinador permite hasta 3.800 caracteres y entrega hasta 4.000, incluso al construir `interactive.type=button`. La [referencia oficial de Meta para Reply button](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/InteractiveObject/#reply-button) fija 1.024 caracteres para ese cuerpo. Es documentación de su SDK archivado; no se incorpora ese SDK. El endpoint de documentación actual devolvió HTTP 429 al verificarlo.

Reproducción local sin red ni base: `normalizeCommand('prepare_expense', ...)` acepta una descripción de 1.200 caracteres. La representación resultante mide 1.400, pasa ambos límites y llega al proveedor como mensaje interactivo. Un transporte simulado con HTTP 400 devuelve `PROVIDER_REJECTED`; la cola repetiría el mismo cuerpo hasta su límite y exigiría revisión. No se afirmó aceptación o rechazo real de Meta en esta prueba.

Corrección: distinguir texto simple de mensajes interactivos; validar antes de crear/ofrecer botones y nuevamente en el proveedor. Si la vista completa no cabe, conservar propuesta/recibo y dirigir al dashboard sin ofrecer confirmación incompleta. Probar el límite, un carácter por encima, Unicode y propuestas largas de ambos empleados. No truncar el contenido que el operador autoriza.

### 2. P2 — registro administrativo atascado después de una interrupción

Ubicación: `frontend/lib/operator-channel/authority.ts`, líneas 32–38; `backend/src/application/operator-channel/authority.js`, función `register`.

`boot.registration` conserva una solicitud firmada durante toda la vida del proceso, pero vence a los 30 segundos. Si falla el transporte después de leer el estado y antes de confirmar el registro, los intentos siguientes reutilizan esa solicitud vencida. El backend verifica su vigencia antes de consultar el resultado idempotente. El proceso no se recupera por sí solo, aun si vuelve la conexión.

Reproducción ejecutando el módulo TypeScript compilado con emisor y transporte simulados: primer registro falla por interrupción; reloj de verificación avanza 31 segundos; los dos intentos posteriores arrojan `INVALID_PROOF`. Los tres usan el mismo `operationId`. Sin servicios externos ni credenciales reales.

Corrección: protocolo de recuperación explícito para resultado desconocido y solicitud vencida, manteniendo la identidad de arranque, la idempotencia y el cercado por época. No basta con borrar el registro y apropiarse ciegamente de otra época. Probar interrupción antes del commit, respuesta perdida después del commit, recuperación tras el TTL y rechazo de instancia antigua.

### 3. P2 — URL de ejemplo incompatible con Compose

Ubicación: `backend/.env.example`, línea 69; `docker-compose.yml`, línea 42.

La plantilla indica `http://frontend:3000/api/internal/operator-authority`, mientras el contenedor Next escucha en `PORT=3001`. Copiar esa configuración impide la verificación viva del administrador en el despliegue actual. Se conserva el bloqueo de acceso, pero el empleado no puede atender esas solicitudes.

Corrección: alinear el ejemplo con el puerto interno real y añadir una comprobación de conectividad y firma desde backend al frontend. La prueba local con puertos del simulador no certifica esta ruta Docker/VPS.

### 4. P2 — las nuevas pruebas PostgreSQL no forman parte de CI

Ubicación: `.github/workflows/ci.yml`, job `inbound-postgres`, línea 97; scripts nuevos de `backend/package.json`.

CI ejecuta `test:postgres` (cola histórica), pero no `operational-assistants.test.cjs` ni `operator-whatsapp.test.cjs`. Sus 56 pruebas son actualmente evidencia local; una regresión de recibos, permisos o concurrencia podría dejar CI verde. Los tests de proxy/reautenticación sí entran por el descubrimiento existente de helpers en `scripts/`.

Corrección: crear base explícita desechable aceptada por los guards de esas suites, aplicar migraciones y ejecutar ambos archivos con `--test-concurrency=1` si comparten base. Mantener sus carreras internas concurrentes. No reutilizar nombres de base que esas suites rechacen ni recurrir a `DATABASE_URL` de producción.

## Preparación posterior del despliegue

- Comprobación específica del canal privado: configuración, migraciones, registro del emisor y RPC firmado. La salud general del backend por sí sola no prueba este flujo; `scripts/deploy.sh` solo consulta esa salud.
- Publicar inicialmente con el canal deshabilitado, comprobar dashboard y atención existente y habilitar después para un único operador de prueba autorizado. Certificar el proveedor real y la correlación del botón antes de ampliar acceso.
- Reutilizar respaldo/restauración y acordar reversión: deshabilitar el canal impide uso nuevo, pero los envíos inciertos no se reenvían. Las migraciones aditivas no se borran automáticamente al volver al código anterior.
- Revisar el conjunto que se vaya a incluir en el commit: hay archivos nuevos esenciales fuera de `git diff --stat`, además de `.tmp/` sin seguimiento. Excluir temporales y conservar los entornos reales ignorados; no borrar archivos locales ajenos.

No se añaden agentes, operaciones ni fases. Los cuatro ajustes corrigen la implementación y su verificación dentro del diseño aprobado. Las ampliaciones de observabilidad deben limitarse a diagnóstico técnico sin revelar teléfonos, contenido privado o secretos.
