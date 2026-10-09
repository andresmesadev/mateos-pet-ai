# 2.45.2 — mascota elegida, despedida y resumen de la cita

**Fecha:** 9 de octubre de 2026.
**Estado:** publicada en GitHub y comprobada en la VPS.
**Commit funcional:** `0c7015e3f49f9be5ea7dfc876a486f7bafebffcf`.
**Commit desplegado y aprobado por CI:** `1b1ee47de507b510951ffb2a2181a5b4fe26ce88`.
**Hora del despliegue:** 2026-10-09, 16:28:07 de Colombia / 21:28:07 UTC.
**Referencia de cierre:** `v2.45.2`, sobre la certificación documental posterior;
ese commit no modifica el código desplegado ni requiere otro reinicio.

## Solicitud y alcance

El operador probó consulta veterinaria y pidió elegir siempre la mascota,
despedirse, separar los datos de confirmación en líneas e incluir la dirección
cuando haya recogida. Es una reparación y mejora de presentación del adaptador
WhatsApp existente; no es un entregable nuevo de Fase 2 ni añade entidades,
reglas de disponibilidad, tablas, migraciones o proveedores.

El modelo de dominio, §2 Clientes y §3 Mascotas, ya contempla un propietario
de una o más mascotas. Se conservan la identidad autenticada, los repositorios
existentes, la hora de Colombia y las restricciones de agenda por servicio.
No cambia la asignación consecutiva de peluquería ni el horario veterinario.

## Evidencia de la prueba del operador

Lectura de producción previa al cambio: dos citas veterinarias confirmadas
para el 10 de octubre, a las 12:00 y 13:00 de Colombia, ambas con nombre de
mascota. Los 11 trabajos entrantes de la última hora terminaron `done/complete`.
Son horas distintas: esta prueba no cierra el conflicto por el mismo turno.
No se modificaron citas ni se enviaron mensajes durante la inspección.

## Comportamiento

- Si el cliente no indica una mascota para esta reserva, se pregunta su nombre aunque solo tenga una registrada. La lista conocida admite elegir otra mascota.
- Un nombre aportado por el historial o por el extractor sin estar mencionado en este turno no selecciona una mascota nueva. Una respuesta breve al paso de nombre puede interpretarse sin depender del extractor.
- La propuesta de horario incluye el nombre de la mascota antes de aceptar. Si el cliente cambia la mascota al confirmar, no se confirma automáticamente la anterior. Una confirmación sin nombre seleccionado no crea una cita genérica.
- La respuesta final se construye después de guardar la cita, con mascota, servicio, fecha, hora y modalidad separados por saltos de línea.
- Para recogida se incluye la dirección guardada en ese turno. Si el cliente la lleva, se limpia la dirección antigua y no se anuncia recogida.
- Los agradecimientos y despedidas cierran cordialmente sin volver a saludar ni ofrecer otra reserva automáticamente.

Ejemplo ficticio de la confirmación:

```text
✅ ¡Listo! Tu cita quedó agendada.

🐾 Mascota: Luna
🩺 Servicio: Peluquería
📅 Fecha: 10/10/2026
🕐 Hora: 11:00 AM (hora Colombia)

🚐 Recogida a domicilio
📍 Dirección de recogida: Calle de prueba 10, apto 3

¡Gracias por confiar en nosotros! Que tengas un buen día. ¡Hasta pronto! 🐾
```

## Validación local

```text
Pruebas específicas: 6 suites, 48 pruebas, código 0
Backend completo: 169 suites, 1.369 pruebas, código 0
Tiempo de Jest completo: 35,685 s
Frontend ESLint: código 0, sin diagnósticos
```

La suite incluye los casos de mascota única y múltiples, nombre de memoria,
otra mascota, confirmación sin mascota, resumen veterinario, dirección de
recogida en el mensaje final y dirección obsoleta al llevarla al salón.
Los logs de errores simulados de las pruebas negativas son deliberados;
no corresponden a fallos observados de producción. El backend no declara
un comando de lint; se comprueba la sintaxis de sus servicios cambiados.

## Publicación y repetición real

La primera CI del commit `0c7015e` y su reintento aprobaron pruebas unitarias
y lint/build, pero los dos jobs PostgreSQL se detuvieron **antes de las
pruebas**, al inicializar los contenedores: Docker Hub respondió
`toomanyrequests: You have reached your unauthenticated pull rate limit`.
Ver [ejecución inicial](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/37992802642).
No se presentó ese resultado como CI verde ni se desplegó con ese bloqueo.

Para ejecutar las mismas pruebas, los dos servicios PostgreSQL de CI usan
la copia pública disponible en `mirror.gcr.io`, fijada al manifiesto
linux/amd64 `sha256:1d50c689b0a6511b9ea0a15615281c81a59fd04a08eb35057ec8646fb3a2118a`.
Se consultaron los manifiestos del tag `pgvector/pgvector:0.8.6-pg18-bookworm`
en origen y caché: los identificadores coinciden exactamente. No cambian
el servicio PostgreSQL de producción, las migraciones, las credenciales ni
las aserciones. La caché es pública; no se creó cuenta ni plan.
La [documentación de la caché](https://docs.cloud.google.com/artifact-registry/docs/pull-cached-dockerhub-images)
explica que su contenido puede retirarse: no se garantiza disponibilidad
permanente. Para actualizar pgvector se debe verificar y actualizar también
este identificador de CI; no se selecciona automáticamente una imagen distinta.

Comprobar CI antes de publicar en la VPS; conservar respaldo cifrado e
imágenes anteriores. El despliegue usa el script existente y conserva el
volumen PostgreSQL. Una nueva publicación reinicia el worker: la ventana de
48 horas anterior queda como incompleta y se abre una nueva para esta versión.

Pendientes de prueba real: nueva consulta para una mascota distinta de la
del historial; confirmación legible y despedida; peluquería con recogida y
dirección visible; disputa de dos clientes por el mismo turno. Estas pruebas
no se sustituyen por el build, la salud o los tests simulados.

El paso 8 de la [preparación de beta](../operations/CLOSED_BETA_READINESS_PLAN_20260919.md)
sigue abierto y se mantiene el número de prueba de Meta. No se abre beta
externa por esta mejora.

## Publicación comprobada

[CI 37993280049](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/37993280049)
terminó verde para `1b1ee47`: `test` 31 s, `lint` 56 s,
`inbound-postgres` 48 s y `administration-postgres` 1 min 36 s. Los dos
jobs PostgreSQL ejecutaron sus pruebas reales; no se omitieron para publicar.

Antes del despliegue se comprobó el checkout limpio de la VPS en `d40dce5`.
El servicio de respaldo terminó `Result=success`, `ExecMainStatus=0`:

- Copia cifrada: `mateos-pet-ai-20261009T212029Z`, 409.124 bytes.
- SHA-256: `184cd9386117c48e374e38a417fe25ee823c7700d2dc4b8770d773b35df5899d`.
- Verificación en servidor y descarga independiente en `backups/offsite/`: correctas.
- Imágenes de recuperación: backend y frontend con tag `rollback-2.45.1-20261009`.

Se ejecutó `bash scripts/deploy.sh` como `ubuntu`. La compilación del backend
produjo `sha256:941fbc177c36d8d0979b5398bdad0c1fd781362c24faaa60a2f0c6248796a475`.
El frontend reutilizó caché y su imagen anterior; Compose conservó ese
contenedor. PostgreSQL conservó su volumen y no se reinició.

```text
46 migrations found in prisma/migrations
No pending migrations to apply.
Deploy complete: 1b1ee47
Deployment exit=0
Health: version=2.45.2 status=ok database=ok openai=ok inboundWorker=ok
consecutiveFailures=0
HTTPS administrator authentication: PASS
14 authenticated dashboard destinations: HTTP 200
Authenticated Caja day/pending: paginated contract and complete totals PASS
Ambiguous cash parameters rejected: HTTP 400
Authenticated services and inventory contracts: PASS
Anonymous dashboard/proxy denied: redirect to login / HTTP 401
Release HTTPS smoke passed. No business writes or outgoing messages.
```

Lectura de cola a las 21:28:48 UTC: **50 trabajos `done/complete`**, cero
leases reclamados vencidos y cero trabajos nuevos con error desde el reinicio.
Logs de arranque: backend 8 líneas, frontend 3 líneas, cero firmas de error.
Los resets temporales de `curl` durante el arranque fueron recuperados por
los reintentos del script; el resultado final fue código 0 y salud correcta.
No se modificaron ni cancelaron las citas de prueba del operador.

El build del backend informó cero vulnerabilidades en sus dependencias de
producción. La instalación temporal raíz de Prisma volvió a informar cuatro
hallazgos altos de herramientas, ya registrados en [2.45.1](RELEASE_2_45_1_VPS_20261009.md);
esa carpeta se elimina de la imagen final. No se declara saneado ese conjunto
de herramientas de desarrollo por este cambio.

## Observación de esta versión

La ventana anterior de 2.45.1 se conservó, sin eliminarla: 17 muestras,
80 minutos, cero huecos y cero fallos de salud, pero **incompleta** frente
al requisito de 48 horas. Se detuvo únicamente el proceso identificado al
iniciar este despliegue.

Worker de 2.45.2 iniciado a las **21:28:04.512 UTC**. Nueva observación local:
`.cache/stability/ventana-20261009T212837Z.jsonl`, PID inicial `14236`,
iniciada el **9 de octubre a las 16:28:37 de Colombia**, con muestras cada
5 minutos. Final previsto: **11 de octubre a las 16:28**, si el equipo y
proceso permanecen disponibles. Estas muestras no sustituyen comprobar
entregas, comportamiento del asistente ni tráfico real del piloto.
