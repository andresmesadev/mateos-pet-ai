# Paso 2 — Capacidad para el piloto interno

**Inicio:** 13 de octubre de 2026, hora Colombia. **Base medida:** 2.46.6; corrección 2.46.7 publicada y desplegada. **Estado:** preparación técnica verificada; paso 2 abierto hasta contrastar tráfico real sostenido del piloto y cuentas propias de los operadores. Autorización: iniciar el paso 2 del plan de beta; conservar PostgreSQL en VPS y el número de prueba de Meta. El operador indicó dos o tres puestos simultáneos.

## Alcance y criterios previos

Medir infraestructura, lecturas autenticadas y cola existente. No cambia reglas, schema, horarios, motor, servicios externos ni configuración del servidor. La prueba de cola crea contenedores desechables y una red interna propios, sin conexión a la base de producción; usa el worker real con interpretación y entrega simuladas. No envía mensajes de WhatsApp ni genera llamadas a OpenAI. Sus tiempos no certifican capacidad del proveedor externo.

- Observación de recursos durante diez minutos: RAM disponible mayor del 20 %, disco libre mayor del 25 %, sin OOM/reinicios, esperas de locks o transacciones de más de un minuto. CPU se interpreta sobre los dos núcleos y se compara entre muestras; no convertir una lectura breve en máximo sostenido.
- Lecturas HTTPS de calendario/caja/inventario: rampas de 1, 3, 5 y 10 lectores lógicos, hasta 30 solicitudes por minuto en total, máximo 129 lecturas, p95 menor de 2 segundos y sin HTTP 429/5xx. Todos comparten una sesión admin de prueba; no simula diez identidades ni valida sus permisos.
- Cola aislada: ráfagas de 1, 5 y 10 remitentes, retraso de interpretación simulado de 2,5 s y escenario lento de 4,5 s. Todos los trabajos únicos completos una vez, orden por remitente, sin leases vencidos ni escrituras externas. Objetivo operativo provisional de respuesta de ráfaga: p95 menor de 30 s. Es objetivo local del piloto, no estándar de WhatsApp.
- Registrar esperas y fijar un límite inicial conservador. Los datos actuales son pequeños: no extrapolar lecturas rápidas a bases grandes ni declarar tasa máxima de OpenAI/Meta.

## Línea de base — 14:55 Colombia

2 CPU; RAM total 12.521.291.776 bytes y disponible 11.446.677.504; sin swap. Disco total 207.907.635.200 bytes, usado 59.229.786.112. Contenedores: backend 200,6 MiB, frontend 100,5 MiB, PostgreSQL 56,95 MiB. Presión CPU/memoria/IO de diez segundos en cero en esa lectura.

PostgreSQL 18.6: 13.489.855 bytes, máximo 100 conexiones, 9 procesos en `pg_stat_activity` contando procesos internos, 1 activo, cero locks y transacciones largas; no equiparar esos nueve procesos a nueve usuarios. Cero temporales, deadlocks y conflictos acumulados en la estadística consultada. Pool backend por defecto de `pg`, instancia Prisma compartida. Una instancia backend y drenado serial de hasta 50 trabajos por barrido.

Últimas 48 horas: 16 trabajos entrantes y 50 recibos, todos `done/complete`, cero errores/leases vencidos. Tiempo creación→finalización: p50 2.559 ms, p95/máximo 4.430 ms. Un establecimiento, tres usuarios, once citas y 220 mensajes: carga real pequeña, no piloto representativo.

`dashboardRateLimit` protege 60 solicitudes/minuto por IP. La carga sintética se limita a 30/minuto para dejar margen; no se desactiva el limitador. La interpretación/entrega globalmente serial puede hacer esperar a varios clientes aunque CPU y RAM estén libres. No introducir varios workers sin diseño y prueba de orden/aislamiento.

## Evidencia y cierre

Pendientes: serie de recursos, lecturas controladas, cola aislada, contraste de producción posterior y decisión sobre alcance/límites. Conservar los archivos privados agregados bajo `.cache/capacity/`, sin cuerpos de respuestas, cookies, credenciales ni datos personales. La ventana de estabilidad de 2.46.6 continúa independiente y no se reinicia por estas herramientas.

El paso 2 no se marca completo únicamente por recursos libres o por simulación de proveedores. Debe distinguir capacidad técnica acotada de recursos bajo tráfico real sostenido del piloto. Registrar límites y lo que requiere participantes reales en el plan.

## Resultados — 15:03–15:13 Colombia

Observación completa: **41 muestras, 600,017 segundos, cero huecos**. CPU media 2,41 %, máximo entre muestras 14,64 %; RAM libre mínima **10,43 GiB / 89,47 %**; disco libre mínimo **71,50 %**. PostgreSQL: máximo 11 conexiones cliente de 100, un cliente activo en las muestras, cero locks/transacciones largas/temporales nuevos/deadlocks. Cero jobs pendientes, en revisión o leases vencidos de producción. Ningún OOM ni reinicio de sus tres contenedores. Muestrear cada 15 s no demuestra el máximo instantáneo entre muestras. El host también ejecutó los dos contenedores aislados de prueba durante parte de esta ventana.

Serie privada: `.cache/capacity/vps-2.46.6-20261013-10min.jsonl`, SHA-256 `6109b5786856066f131c6b0b5e4c0ff9d8cd5fd0ccd47d0ff85168d7cf4d104e`. Dos muestras preliminares verificaron el sampler; no se agregan a los diez minutos.

### Lecturas HTTPS

| Lectores lógicos | Lecturas | p95 HTTP | Máximo |
| --- | --- | --- | --- |
| 1 | 6 | 51,6 ms | 51,6 ms |
| 3 | 18 | 116,8 ms | 116,8 ms |
| 5 | 45 | 134,3 ms | 147,4 ms |
| 10 | 60 | 131,2 ms | 148,0 ms |

**129/129 HTTP 200**, contratos de calendario/caja/inventario correctos, cero escrituras/llamadas a proveedores. Rampa desde las 15:04:27 hasta las 15:08:41, limitada a 30/minuto. Tiempos HTTP excluyen pausas de la herramienta para respetar ese presupuesto. Cliente HTTPS dentro del servidor, dataset pequeño y sesión admin compartida; no representa diez operadores independientes ni navegación desde redes móviles. Primer intento por stdin produjo archivo vacío por no invocar `main`; detectado y corregido, **no contado como prueba ejecutada**. La prueba de CLI asegura que esa regresión no pase como exit 0 silencioso.

### Cola aislada en la misma VPS

Worker real y tabla/migración `InboundJob` real, en una red Docker interna propia; PostgreSQL y Node limitados a 0,5 CPU y 512 MiB cada uno, sin puertos publicados. Solo recepción/entrega simuladas. No usa `.env` ni `DATABASE_URL`; la URL de test exige `capacity-db/capacity_test`. Limpieza exclusiva de recursos con label de esta ejecución, incluyendo schema UUID y contenedores/red propios.

| Ráfaga | Retraso simulado por turno | p95 hasta respuesta | Objetivo <30 s |
| --- | --- | --- | --- |
| 2 mensajes / 1 remitente | 2,5 s | 5,2 s | Sí |
| 5 remitentes / 5 mensajes | 2,5 s | 12,6 s | Sí |
| 10 remitentes / 10 mensajes | 2,5 s | 25,1 s | Sí |
| 5 remitentes / 5 mensajes | 4,5 s | 22,6 s | Sí |
| 10 remitentes / 10 mensajes | 4,5 s | **45,1 s** | **No** |

**32 trabajos completos una vez**, sin duplicados, mezcla de remitentes, errores ni leases vencidos; deduplicación y orden comprobados. `integrity_pass`, exit 0. Que diez mensajes excedan el objetivo de espera no equivale a perderlos. La serialización global del worker explica esa espera y no se cambia sin diseño. No son treinta y dos mensajes reales enviados a Meta ni una medición del throughput de OpenAI. Empezar con cinco participantes y revisar backlog/latencia antes de ampliar; cinco personas enviando varios mensajes seguidos también pueden producir más de cinco pendientes.

## Hallazgo de dos o tres operadores — cupo compartido

El responsable indicó **dos o tres operadores simultáneos**. El proxy no reenvía la IP del navegador; mensajes (12/min), bandeja (6/min) y permisos (2/min), más panel del cliente y navegación, comparten el mismo cupo de 60/min. Tres puestos pueden superarlo. La rampa pausada no refuta este problema: fue deliberadamente inferior a ese techo.

Reproducción previa con Express/limitador/resolución reales y dependencias de identidad de prueba: 63 lecturas, tres actores y una IP, esperado 200, observado **429**; una regresión fallida. Diseño en [ADR 021](../decisions/021-dashboard-rate-budget-capacity.md). Candidata **2.46.7**: entrada común de 300/min solo al proxy con token válido, 60/min al resto, luego 60/min por actor/tenant ya autenticados; hash de clave y fallback IPv6 seguro. No se toman IDs de headers crudos para el cupo del actor ni se cambian limitadores de webhook/billing/API pública. Cada operador necesita su propia cuenta; pestañas que comparten una misma identidad comparten su cupo.

Verificación dirigida inicial: dos suites / 20 pruebas aprobadas, exit 0, 1,928 s. Un intento nativo previo terminó sin output y no se cuenta como aprobado. Se agregaron negativos para admin normalizado, principal ausente y secreto ausente. Verificación final/CI y despliegue pendientes; paso 2 sigue abierto.

## Validación final local y preparación de publicación

```text
Regresión previa: 1 suite fallida, 429 inesperado al compartir una IP.
Revisión final dirigida: 2 suites / 23 pruebas aprobadas, exit 0, 1,981 s.
Node --test capacity-tools + observe-production: 7 pruebas aprobadas, exit 0.
Node --check: dos herramientas CJS, rateLimit.js y app.js, exit 0.
Frontend eslint: exit 0, sin cambios de frontend.
git diff --check: exit 0.
Sampler VPS: 41 muestras válidas, diez minutos completos, exit 0.
Lecturas HTTPS: 129 lecturas verificadas, exit 0.
Benchmark aislado: 32 trabajos completos, exit 0; escenario diez/lento fuera del objetivo de 30 s.
```

Los intentos locales de suite completa terminaron con exit 1/9 sin resumen; no se cuentan como aprobados ni se atribuyen a una regresión funcional sin evidencia. CI completo debe aprobar la revisión final antes de desplegar. No cambió schema; no corresponde `db push` ni migración.

Respaldo cifrado previo: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261013T201918Z`, `Result=success`, `ExecMainStatus=0`. Inventario posterior: cero contenedores/redes con label `mateos.capacity.run`; recursos aislados retirados. Huellas de los datos agregados privados:

- Lecturas: `7c18903af979d2f27c1d2650c3f09b49a6d6651f9a7e65040e96e98fc492db27`.
- Cola: `ec4c1528b72455017c3b8dc24524102008ac2bb7e127520736770a28655e2af0`.

Evaluación de versión: el cambio funcional del cupo requiere patch **2.46.7**, declarado en código y lockfile. Herramientas no añaden dependencias ni entidades. Preservar la ventana 2.46.6 como incompleta antes de reinicio; iniciar observación separada de la candidata desplegada.

Publicación de candidata: commit `29c5f15b2eabce42d02fc260054dac4f3cd781f8` en `main`; [CI 38462271951](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38462271951) en ejecución antes de despliegue.

**Resultado de ese CI:** backend, cola PostgreSQL y administración PostgreSQL `success`; job frontend `failure` en `capacity-tools.test.cjs`: `pg` no está instalado en ese job. El benchmark importaba dependencias antes del guard de destino. Se adelanta el guard y la regresión prohíbe explícitamente cargar pg/Prisma para una URL rechazada. No se instalan dependencias backend innecesarias en frontend ni se salta la prueba. La candidata no se desplegó con ese CI fallido; la VPS siguió en 2.46.6. Publicación corregida y CI final pendientes.

**Contraste de producción, 15:23:51 Colombia:** 106 entrantes y 127 recibos, todos `done/complete`; tres usuarios, once citas y 220 mensajes, mismas cifras de negocio que antes de las pruebas. Cero credenciales activas de profesionales (`StaffCredential`). La cuenta admin del entorno existe, pero no se presentan fixtures del benchmark como operadores reales. Antes de la cohorte se deben asignar cuentas propias a los dos/tres operadores: un login compartido conserva un solo cupo y una sola identidad auditada. Nombres, roles y permisos reales se acuerdan en preparación de cohorte, sin inventar personas ni enviar invitaciones desde esta prueba.

## CI final y despliegue

Revisión corregida `73cdaa77cc4eff63b44459447f774e0cd74325fb`, publicada en `main`. [CI 38462935146](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38462935146): cuatro jobs `success` (`test`, `lint`, `inbound-postgres`, `administration-postgres`). Evidencia real:

```text
Backend: 184 suites / 1.478 pruebas aprobadas, 14,174 s.
Herramientas/contratos frontend: 134 pruebas, 134 pass, 0 fail.
Contrato de caja: 3 pruebas, 3 pass.
Administración PostgreSQL: 15 pruebas, 15 pass.
Lint/build frontend, auditorías de dependencias de producción y cola PostgreSQL: success.
```

Observador de 2.46.6 identificado por PID/comando y detenido antes del despliegue. Archivo preservado `.cache/stability/ventana-2.46.6-20261013T193040Z.jsonl`: **12 muestras, 55 minutos, cero fallos/huecos/reinicios**, veredicto `incomplete`. No se agregan esas muestras a la ventana de 2.46.7 ni se presenta como observación de 48 horas. Despliegue del commit verificado en curso; comprobaciones de imagen/HTTPS y nueva observación pendientes.

### Despliegue y verificación posteriores

`scripts/deploy.sh`, **exit 0**, commit `73cdaa7`, backend reconstruido y frontend reutilizado. 46 migraciones sin pendientes. Worker iniciado **13 de octubre a las 15:31:15 Colombia**, salud local correcta a las 15:31:18. Resets/respuesta vacía del reinicio se recuperaron con los reintentos del script. Salud HTTPS a las **15:32:07**: versión 2.46.7, base/OpenAI/worker `ok`, cero fallos consecutivos.

**Imagen desplegada, 15:33:29:** contenedor efímero `--network none`, CPU/RAM limitadas, filesystem de solo lectura con logs temporales. Resolver y limitadores reales; Prisma reemplazado por identidades de fixture dentro de ese proceso aislado. 75 lecturas de tres actores/una IP HTTP 200; completar 60 para un actor devuelve 429 en la siguiente; otro continúa con 200; token inválido comprobado antes de la carga devuelve 401. Cero llamadas externas/escrituras de producción. El primer intento no pudo crear el directorio de logs bajo filesystem de solo lectura; no se cuenta como aprobado. Se añadió únicamente un montaje temporal de logs del contenedor y la repetición terminó con exit 0; no se modificó el contenedor productivo para superar la prueba.

Smoke HTTPS real, exit 0: login admin, 14 destinos HTTP 200, contratos caja/servicios/inventario, 400 en parámetros ambiguos, 401 anónimo y 405 en POST de páginas/acciones. No repetir 129 lecturas para presentar un ensayo distinto de diez operadores: sus cuentas reales aún no están asignadas. El ensayo original conserva su versión, datos y límites.

La instalación temporal de tooling Prisma conserva cuatro vulnerabilidades altas, ya registradas antes; se retira `/app/node_modules` al construir. Dependencias de producción auditadas en CI y en la imagen, sin vulnerabilidades reportadas. Este ajuste no afirma sanear el tooling de desarrollo.

Nueva observación: `.cache/stability/ventana-2.46.7-20261013T203334Z.jsonl`, PID inicial **34296**, primera muestra **13 de octubre a las 15:33:35 Colombia**, final previsto **15 de octubre a las 15:33:35**, sujeto a continuidad del equipo/proceso. La primera muestra es saludable. No garantiza notificación automática ni mezcla las ventanas anteriores.

Contraste posterior **15:36:48–15:36:58**, dos muestras: RAM libre mínima 10,63 GiB, disco libre 71,01 %, una conexión cliente y cero locks, transacciones largas, pendientes, revisiones o leases vencidos. Sin OOM/reinicios en esos registros. Logs desde el arranque: cinco líneas y cero firmas de error consultadas. La repetición es breve y no se presenta como otra prueba sostenida. Se conserva la serie original de diez minutos sin mezclar versiones.

## Decisión y pendientes concretos

**Preparación técnica aprobada para un piloto acotado, no certificación de capacidad máxima.** La VPS actual tiene margen; no hay evidencia que exija contratar otra base o aumentar recursos ahora. Propuesta: un establecimiento, cinco participantes de WhatsApp verificados y dos/tres operadores con cuentas propias. El objetivo de 30 s aplica a una ráfaga de cinco mensajes con demora simulada de 4,5 s, no a cinco personas enviando mensajes ilimitados. Observar backlog y latencia antes de ampliar; diez mensajes lentos necesitaron 45 s sin pérdida.

Para cerrar formalmente el paso 2:

1. Asignar las cuentas reales de los operadores y comprobar sus permisos, sin compartir el login admin; coordinarlo con la preparación de cohorte del paso 10.
2. Registrar un bloque de uso real sostenido con los participantes autorizados, manteniendo recursos/cola/tiempos agregados y recibos de entrega. La serie de diez minutos y el modelo de demoras no sustituyen esa medición.
3. Contrastar latencias creación→respuesta y entregas reales con el objetivo acordado; si el backlog crece o se supera, reducir simultaneidad y revisar antes de ampliar. No activar múltiples workers sobre el motor actual por oportunidad.

El paso 8 conserva su cierre; este cambio toca únicamente protección HTTP del dashboard. El paso 9 sigue la nueva versión y el paso 7 puede avanzar mientras se organiza el piloto. No se abre beta externa por esta medición.

**Preparación de operadores, 13 de octubre:** consulta de solo lectura a las 17:25:17 Colombia: tres fichas activas (administración, peluquería y veterinaria), sin credenciales individuales activas. El ingreso administrativo del entorno ya funciona. Se solicitaron los operadores y correos reales; habilitación e ingreso de esas cuentas pendientes. La [guía del piloto](INTERNAL_PILOT_RUNBOOK.md) incorpora el procedimiento existente de acceso, permisos y un bloque propuesto de veinte minutos con tráfico real; elimina su lista obsoleta de agenda pendiente sin alterar el cierre del paso 8. Verificación de esta actualización documental: lint frontend exit 0; `node --test scripts/capacity-tools.test.cjs`, dos pruebas aprobadas, cero fallidas, exit 0; `git diff --check`, exit 0. No hay cambios de código ni reinicio del worker.

**Dos cuentas de ejemplo habilitadas, 17:54:11 Colombia:** autorización expresa del responsable para probar el ingreso, reutilizando las fichas de peluquería y veterinaria. Aprovisionamiento por API administrativa e ingreso por NextAuth reales, exit 0; dos identidades y tenant comprobados, área propia HTTP 200, Administración redirigida HTTP 307 y capacidades de administración/finanzas falsas. Los correos son ficticios y no reciben correo; las contraseñas aleatorias permanecen en un archivo privado local ignorado por Git. No hubo perfiles nuevos, cambios de permisos/rol, mensajes de WhatsApp ni reservas. Las sesiones individuales de verificación cerraron sesión. Las cuentas preparan el ensayo interno; todavía no acreditan uso humano sostenido ni una cohorte externa. El paso 2 conserva abierto ese bloque de tráfico real.

**Ensayo interno real completado, 18:00:21–18:20:21:** 81 muestras / veinte minutos sin huecos relevantes; CPU media 2,70 %, máxima 11,00 %, RAM disponible mínima 10,61 GiB (90,95 %), disco libre 71,01 %, hasta once conexiones cliente. Cero bloqueos, trabajos pendientes/en revisión, leases vencidos, OOM o reinicios observados. Nginx: 243 solicitudes del dashboard, todas HTTP 200, con navegación de agenda, consultas, peluquería, caja e inventario además de WhatsApp. Responsable confirmó tres perfiles correctos y navegación sin errores. Un remitente envió dos mensajes reales, procesados en 2,707 y 3,706 s, un intento cada uno; cinco recibos correlacionados, sin códigos de error, respuestas leídas. Salud posterior `ok`; 94 líneas de logs del bloque sin firmas de error. Se aprueba este alcance ligero, no una ráfaga de cinco participantes: esa carga representativa sigue pendiente para cerrar el paso 2. La consulta inicialmente declarada no apareció; la repetición sí respondió, sin cambios de token/configuración. No atribuir su ausencia a Meta o al motor sin evidencia. [Acta completa y límites](INTERNAL_PILOT_CAPACITY_TRIAL_20261013.md). La ventana de estabilidad de 2.46.7 continúa independiente, sin reinicio por el ensayo.
