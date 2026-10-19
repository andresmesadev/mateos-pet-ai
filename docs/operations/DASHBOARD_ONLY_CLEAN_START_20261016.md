# Arranque limpio: dashboard sin WhatsApp

**16 de octubre de 2026. Estado aplicado en la VPS.** El responsable pidió iniciar sin datos antiguos/del piloto y usar primero el dashboard. Eligió conservar configuración del negocio y administrador, revisando servicios y personal antes de copiarlos. No solicitó importar todavía un archivo de agendas.

## Base activa y archivo anterior

La aplicación usa **`mateos_dashboard_20261016`**, preparada aparte desde el esquema de la base anterior: **69 tablas y el mismo historial técnico de 52 migraciones**. Se copió el esquema completo y su historial técnico, no se marcaron migraciones sin reconstruir su esquema. Se comprobaron restricciones validadas y ausencia de filas operativas antes de cambiar la conexión.

| Conservado como configuración | Resultado |
| --- | --- |
| Establecimiento | Un Tenant, con el mismo identificador, perfil, módulos y horarios |
| Acceso del administrador | Credenciales y secretos de autenticación sin cambio; ingreso HTTPS comprobado |
| Catálogos técnicos | 48 tipos de evento, 3 categorías de servicio; no son eventos ni servicios registrados |
| Empleados digitales configurados | Financiero y Administración activos en dashboard; Recepcionista y Coordinador de Agenda pausados |

**Todas las demás tablas quedaron vacías:** clientes, mascotas, citas, consultas, cobros, gastos, inventario, mensajes, conversaciones, memoria, jobs entrantes, tareas/decisiones/eventos de negocio, sesiones y vínculos privados. También **cero servicios, integrantes de personal y credenciales de ejemplo**, a la espera de revisión. No se crearon registros ficticios para comprobar pantallas.

El inventario completo de las 69 tablas de la base activa, a las **15:25:32 UTC**, encontró filas únicamente en `Tenant`, `EventType`, `ServiceCategory`, `DigitalEmployee` y `_prisma_migrations`.

La base anterior **`mateos` se conservó archivada en solo lectura**, separada de la conexión activa. `SHOW default_transaction_read_only` devolvió `on`. Sus 11 citas, 3 clientes, 3 mascotas, 226 mensajes y demás historial no se trasladaron. No se truncaron tablas, eliminaron comisiones/eventos inmutables o desactivaron restricciones. La retención y eventual eliminación del archivo se revisan con el procedimiento existente; no hay una purga automática nueva.

## WhatsApp pospuesto de forma efectiva

- Nginx bloquea temporalmente `/webhook` y `/api/webhook`, con y sin barra final y sin distinguir mayúsculas, mediante HTTP 503. El proxy del dashboard y salud siguen operativos. Se validó la configuración y se recargó siguiendo el [procedimiento oficial de Nginx](https://nginx.org/en/docs/beginners_guide.html).
- La configuración activa del backend no tiene token, identificador de línea, secreto de firma ni token de verificación de Meta. El middleware existente falla cerrado si alguien intenta llegar directamente al backend; no se relaja autenticación para desconectar el canal.
- Cero canales activos en la base nueva. Recepcionista y Coordinador están pausados; no hay recordatorios automáticos enviados desde esta preparación.
- El canal privado de operadores continúa deshabilitado. No se modificó el número ni la configuración de la cuenta de Meta y no se desinstaló código del producto. Antes de habilitarlo después, revisar línea, suscripción/reintentos del proveedor y corte de datos; no reinyectar mensajes históricos del piloto.

La primera jornada es agenda/recepción manual desde dashboard. Caja, inventario, campañas, cobros SaaS y WhatsApp quedan fuera del alcance acordado. Los módulos disponibles no equivalen a haberlos incorporado a esta jornada.

## Copias y reversión

1. Preparación separada: `scripts/prepare-dashboard-database.sh`; rechaza la base original como destino y un destino ya existente. Solo copia las cinco tablas de configuración/historial técnico autorizadas.
2. Cambio: `scripts/activate-dashboard-only.py`; plan previo, respaldo privado de configuración, Nginx validado, respaldo cifrado de origen antes de detener backend, cambio de conexión y arranque saludable. Si falla, recupera la conexión anterior manteniendo WhatsApp apagado.
3. Respaldo final del origen: `mateos-pet-ai-20261016T152423Z`. Respaldo posterior de la base limpia activa: `mateos-pet-ai-20261016T152549Z`, servicio `success`, salida 0 y SHA-256 comprobado. La copia diaria independiente sigue su programación autorizada; no se declara una nueva transferencia manual de estos conjuntos.
4. Recuperación privada de configuración en la VPS: carpeta `private-cutover-20261016T152422Z` dentro del paquete operativo. No se copian sus secretos a Git o al chat. Para revertir datos, acordar el destino; no reactivar Meta como efecto colateral.

El primer intento se revirtió al fallar el respaldo porque el backend ya estaba detenido. Se corrigió el orden para terminar el respaldo mientras sigue encendido y **antes** de detenerlo. El intento posterior terminó correctamente. No se perdió ni borró historia. Otro preflight anterior detectó los dos bloques HTTP/HTTPS del sitio antes de modificarlo; se ajustó el validador y se probó también su reaplicación segura.

## Validación real

```text
Ran 6 tests in 0.001s
OK
PASS: administrator preserved; 7 dashboard pages HTTP 200; 6 operational lists empty.
PASS: public WhatsApp paused on 5 paths (GET/POST); no provider messages sent.
PASS: unauthenticated operational access denied.
```

Se probaron transformación limitada de configuración, secretos de autenticación conservados, rechazo de destino/SQL inválido, fuente inesperada, bloques Nginx ambiguos y reversión manteniendo WhatsApp apagado. Python no está disponible en el equipo local; las seis pruebas puras se ejecutaron con Python 3 ya instalado en la VPS, sin consultar datos reales. El inventario agregado y las pruebas HTTPS verificaron además el resultado aplicado.

Se conservaron las 23 pruebas Node de las herramientas de operación/documentación, con cero fallos. Lint de frontend y sintaxis Bash correctos. No cambió código de negocio/frontend, esquema del producto, imagen o versión: continúa **2.48.0**, checkout productivo `9ee264d`. Los scripts/documentos nuevos siguen locales sin commit/push; sus herramientas operativas necesarias sí se aplicaron en la VPS.

## Nueva observación y siguiente paso

La captura iniciada a las 09:51 Colombia se detuvo deliberadamente para el cambio de conexión y se conserva **incompleta**. El backend actual inició a las **15:24:27.742 UTC / 10:24:27 Colombia**. Nueva ventana persistente:

- Archivo: `/var/lib/mateos-pet-ai/stability/ventana-2.48.0-20261016T152551Z.jsonl`.
- Primera muestra: **16 de octubre, 10:25:51.819 Colombia**, sana; base/OpenAI/worker correctos.
- Final previsto: **18 de octubre, 10:25:51 Colombia**, sujeto a continuidad y resultado. No certificar 48 h por haber cambiado de base.

Se preparó la revisión privada de **15 servicios y 3 fichas de personal anteriores** en `.cache/private/own-clinic/revision-servicios-personal.md`, sin correos ni credenciales. Nada de esas listas se copió al destino. El responsable decide conservar/corregir/descartar y confirma disponibilidad/precios/asignaciones antes de cargar agendas reales. Completar también responsables, cuentas personales, soporte y alcance documental de datos reales en el acta privada.
