# Correcciones de estabilidad — 13 de octubre de 2026

**Candidata:** 2.46.5. **Estado:** implementación y verificación local; publicación, CI y despliegue pendientes. Autorización: el responsable pidió continuar con las acciones de la [revisión de las 48 horas](PRODUCTION_STABILITY_48H_REVIEW_20261013.md). Diseño acotado en [ADR 020](../decisions/020-estabilidad-notificaciones-y-post-de-paginas.md).

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

Pendiente registrar commit, CI completo, despliegue y salud. Luego comprobar en la VPS el guard con los propietarios de los fallos mediante una consulta de lectura y un callback que nunca envía, más el smoke HTTPS de regresión. No generar recordatorios ficticios ni contactar clientes para simular esta verificación.

La ventana aprobada de 2.46.4 se preserva; 2.46.5 necesita su propia observación. El paso 9 sigue abierto hasta revisar esa ventana, tráfico y entregas. El paso 2 bajo carga y las pruebas humanas del paso 8 siguen pendientes. Se conserva PostgreSQL en la VPS y el número de prueba de Meta.
