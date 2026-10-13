# Correcciones de estabilidad — 13 de octubre de 2026

**Versión:** 2.46.5. **Estado:** publicada y desplegada; CI completo y comprobaciones de producción aprobados. Nueva observación en curso. Autorización: el responsable pidió continuar con las acciones de la [revisión de las 48 horas](PRODUCTION_STABILITY_48H_REVIEW_20261013.md). Diseño acotado en [ADR 020](../decisions/020-estabilidad-notificaciones-y-post-de-paginas.md).

## Qué cambia y por qué

### EST-01 — Recordatorios fuera de ventana

Los dos fallos de entrega de 2.46.4 eran recordatorios enviados más de 40 horas después del último mensaje del cliente. El catálogo de Meta se consultó por GET con las credenciales existentes, sin mostrarlas: cinco plantillas aprobadas, solo ejemplos `hello_world` y `jaspers_market_*`, ninguna apta para una cita. No se reutiliza una plantilla de pedidos o saludo para otra finalidad ni se da por configurado un recordatorio de plantilla.

Los seis emisores de recordatorios ahora identifican su finalidad interna (`purpose=reminder`). Un guard dentro de Comunicación consulta la última interacción entrante del mismo propietario/tenant, incluyendo distintos hilos; no lee contenido ni consulta Agenda. Si faltan datos, la interacción es futura/inválida o la ventana está cerrada, omite antes de contactar al proveedor, con motivo explícito. Margen conservador: un minuto antes de las 24 horas. Una excepción de consulta no habilita un envío sin verificar.

El adaptador devuelve `false` cuando el resultado se omite o no contiene un Message persistido; no activa la bandera del recordatorio ni afirma envío. Se conserva `reminder_skipped` en la auditoría existente del Coordinador y se registra el motivo del guard sin teléfonos ni contenido del cliente. Cuando la interacción es reciente, conserva el envío existente. **La aceptación inicial sigue sin equivaler a entrega; los recibos de Meta siguen siendo evidencia final.** Los dos fallos históricos y sus flags no se reescriben.

El inventario completo detectó también OTP del Portal y otras acciones del sistema: la política nueva se limita a los recordatorios. No modifica códigos de acceso, respuestas manuales/IA ni plantillas de reactivación existentes. No introduce un canal, entidad, dependencia o migración. El uso de plantillas aptas para recordatorios fuera de ventana sigue pendiente de diseño/configuración comprobada; en desarrollo se omiten esos recordatorios de forma segura.

### EST-02 — Referencias de acciones inválidas en páginas

Se auditó el frontend: formularios mediante APIs/GET y NextAuth por API; no hay Server Actions declaradas por la aplicación. Se leyó la documentación instalada de Next 16.3.8 antes de editar el proxy.

Reproducción con el build anterior en un servidor local aislado: POST con `Next-Action: x` y POST de formulario con `$ACTION_ID_x`. Ambos devolvieron 404; apareció una vez el mismo error `Server Reference ID did not match…` de la VPS. El dato inválido puede estar en el cuerpo, por lo que revisar solo el encabezado sería insuficiente.

El proxy ahora rechaza con **405** los POST de páginas y las solicitudes de acciones antes de autenticación, render o parsing del cuerpo. Las rutas de APIs y recursos internos mantienen su recorrido normal; dashboard y páginas imprimibles conservan sus comprobaciones de acceso. No se oculta la excepción mediante un filtro de logs ni se atribuye a un atacante concreto: se evita el recorrido no utilizado que la provoca. Añadir Server Actions en el futuro requerirá revisar explícitamente esta política.

Verificación del build corregido en servidor local: ambos POST devolvieron 405, cero excepciones del identificador; `/api/auth/csrf` y `/login` HTTP 200, `/dashboard` anónimo HTTP 307. El smoke HTTPS de release incorpora ambas regresiones sin escrituras de negocio ni mensajes salientes.

## Evidencia local

```text
Pruebas dirigidas iniciales del backend: 5 suites / 31 pruebas, exit 0
Pruebas después de exigir resultado de envío persistido: 6 suites / 39 pruebas, exit 0
Pruebas finales del guard, repositorio y recordatorios: 4 suites / 30 pruebas, exit 0

node --test --test-reporter=tap scripts/message-window-postgres.test.cjs
1 test, 1 pass, 0 fail, exit 0
PostgreSQL local real; fixtures por UUID, eliminados solo tras comprobar sus marcadores
Otra persona/tenant y una respuesta del sistema no abren la ventana
La interacción en un hilo anterior del propietario sí la abre

node --test --test-reporter=tap scripts/page-request-policy.test.cjs
8 tests, 8 pass, 0 fail, exit 0
Proxy real transpilado y matcher comprobado con la utilidad instalada de Next

Frontend lint: exit 0
Frontend build: exit 0; compilación, TypeScript y generación de 29 páginas completas
Primer build: se corrigió la selección del overload de middleware de NextAuth
git diff --check: exit 0
```

La primera corrida completa dividida, antes del último refuerzo, pasó 183 suites / 1.462 pruebas (61/487, 61/512, 61/463). No se atribuye esa cifra al ajuste final. En la candidata final: shard 1, 61/487 aprobado; shard 3, 61/463 aprobado. El shard 2 y otros intentos completos se interrumpieron en Windows sin resumen (exit 9 o terminación del proceso); su último reintento directo terminó `-1073740791`. No se registran como aprobados ni se infiere una causa de ese cierre sin evidencia. La suite completa final debe pasar en CI antes del despliegue.

El grep exhaustivo encontró una única llamada directa a `sendWhatsAppMessage`, en `contexts/communication/infrastructure/providers/whatsapp-channel-provider.js`. Los seis recordatorios reutilizan el helper que invoca Comunicación. No se duplicó lógica de Agenda ni se modificó el schema.

Respaldo cifrado previo: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261013T171743Z`; `mateos-pet-ai-backup.service`: `Result=success`, `ExecMainStatus=0`.

## Publicación y siguientes verificaciones

Commit de código: `593c0e20ae9effb3a492c055b6bbf205ef0af938`, publicado en `main`. [CI 38437810198](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38437810198): `test`, `lint`, `inbound-postgres` y `administration-postgres`, todos `success`. Evidencia final real: **183 suites / 1.467 pruebas**, 12,384 s. La nueva prueba de PostgreSQL del historial entre hilos y aislamiento aparece aprobada en el job `administration-postgres`; los helpers y el build del frontend también pasaron.

Despliegue: `scripts/deploy.sh`, exit 0, `593c0e2`; backend y frontend reconstruidos, 46 migraciones aplicadas sin pendientes. Worker iniciado **13 de octubre a las 12:25:14 de Colombia**. Salud local **12:25:17**: versión 2.46.5, base/OpenAI/worker `ok`, cero fallos consecutivos. Los resets transitorios durante el reinicio se recuperaron mediante los reintentos del script. Dependencias de producción auditadas en CI; el tooling temporal de Prisma usado para construir aún mostró cuatro vulnerabilidades altas en instalación completa, y `/app/node_modules` se elimina de la imagen final. No se declara saneado ese tooling de desarrollo por esta corrección.

Verificación posterior por HTTPS: exit 0; autenticación de administrador, 14 destinos HTTP 200, contratos de Caja/servicios/inventario aprobados, acceso anónimo HTTP 401 y parámetros ambiguos HTTP 400. Las dos peticiones inválidas de acción devolvieron **HTTP 405**. No escribió datos de negocio ni envió mensajes.

Prueba de lectura del guard en la VPS a las **12:26:44** con los dos propietarios de los rechazos históricos: ventanas vencidas de 67,70 y 67,77 horas, ambos `skipped=true`, motivo `whatsapp_window_closed`, cero callbacks de proveedor. Message permaneció en **188 filas antes y después**. Cola: 90 trabajos entrantes y 79 recibos, todos `done/complete`. El callback de la simulación no puede enviar al canal; esta comprobación no certifica entrega de un recordatorio real futuro.

Logs desde el nuevo arranque, incluido el smoke: backend 12 líneas y frontend 9; cero entradas de nivel error y cero excepciones de referencia inválida. Es una comprobación breve de la corrección, no 48 horas nuevas ni una atribución del origen de las peticiones históricas.

Observador nuevo: `.cache/stability/ventana-2.46.5-20261013T172713Z.jsonl`, PID inicial **23752**. Inicio **13 de octubre a las 12:27:13**, final previsto **15 de octubre a las 12:27:13**, Colombia, condicionado a continuidad del equipo/proceso. Primera salud pública correcta, sin fallos consecutivos. No se crea una garantía de notificación automática. La ventana de 2.46.4 conserva su archivo y SHA-256 original; no se mezcla con esta versión ni se borra para ocultar sus dos rechazos.

El paso 9 sigue abierto hasta revisar la nueva ventana, tráfico y entregas. Se corrigió el envío incompatible y se verificó la omisión segura; no se habilitó entrega de recordatorios fuera de ventana sin plantilla apta. El paso 2 bajo carga y las pruebas humanas del paso 8 siguen pendientes. Se conserva PostgreSQL en la VPS y el número de prueba de Meta. Al retomar el paso 8, revisar el estado de las citas fechadas para hoy y usar una fecha futura; no copiar automáticamente las instrucciones del 10 de octubre.
