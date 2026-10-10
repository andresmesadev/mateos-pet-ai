# Seguimiento 2.46.1 — Especie y petición nueva

**Fecha:** 10 de octubre de 2026, hora Colombia. **Estado actualizado:** publicada en `main` y desplegada; continúa el piloto interno. No certifica todavía beta externa.

## Hallazgo real

Tras desplegar [2.46.0](RELEASE_2_46_0_ASSISTANT_20261010.md), las pruebas de Matías conservaron correctamente la mascota y peluquería al preguntar por hoy. El mensaje inicial del operador fue «Quiero peluquería para Matías el martes 13 de octubre», sin la palabra «cita».

La sesión arrastró la especie `other` de un borrador antiguo. La base solo tenía registrada a Akiles como perro; Matías todavía no estaba registrado. La condición de petición nueva debía reconocer el servicio expresado directamente, no depender de que el cliente dijera «cita».

## Corrección

`prepareBookingTurn` reconoce peticiones con peluquería, grooming, baño, consulta o veterinaria, además de cita/agendar/reservar. La nueva petición limpia el borrador anterior; la especie proviene del registro autorizado de la mascota o de una respuesta explícita del cliente. Una especie extraída del historial no sustituye esa pregunta.

Se añadió una regresión del adaptador completo con borrador antiguo `Matías/other` y extracción simulada `other`: devuelve `awaiting_pet_type`, especie nula y ninguna propuesta/cita guardada. Las dos suites afectadas pasan, 22 pruebas y exit 0. Verificación completa local en tres shards disjuntos: 60 suites / 473 tests, 60 / 501 y 60 / 447; los tres exit 0. Total: **180 suites y 1.421 tests**. Dos intentos de corrida única se interrumpieron sin resumen; no se contabilizan como aprobados. No cambió el frontend; su lint/build estaban aprobados en el CI de 2.46.0.

No cambia disponibilidad, capacidad ni persistencia de reservas; las seis pruebas reales de PostgreSQL de 2.46.0 siguen siendo evidencia de esos mecanismos. Falta confirmar esta corrección con OpenAI y WhatsApp reales después del despliegue, y continuar los demás escenarios del paso 8.

## Publicación y comprobaciones

- Commit de código: `157c735c0c2e7b6167d4e9b1dcf4f9477bb5cd12`.
- [CI 38083804325](https://github.com/andresmesadev/mateos-pet-ai/actions/runs/38083804325): `success` en `test`, `lint`, `inbound-postgres` y `administration-postgres`. Incluye lint/build del frontend y pruebas de PostgreSQL real.
- Respaldo cifrado previo: `/var/backups/mateos-pet-ai/mateos-pet-ai-20261010T202923Z`; servicio `mateos-pet-ai-backup.service`, resultado correcto.
- `scripts/deploy.sh`: exit 0, checkout limpio, actualización por fast-forward y 46 migraciones aplicadas, sin pendientes.
- Worker iniciado a las **15:30:46 de Colombia**. Salud al terminar: versión `2.46.1`, base de datos/OpenAI/worker `ok`, cero fallos consecutivos.
- Primera revisión posterior: 63 trabajos `whatsapp/done/complete`, cuatro registros de entrega `whatsapp_delivery/done/complete`, cero leases vencidos. No llegaron mensajes nuevos entre el arranque y esa revisión; estas cifras no certifican aún la prueba simultánea.
- Smoke HTTPS posterior: autenticación de administrador correcta, 14 destinos HTTP 200, contratos de caja/servicios/inventario aprobados; parámetros ambiguos HTTP 400 y acceso anónimo HTTP 401. Exit 0; sin escrituras de negocio ni mensajes salientes.

## Estabilización y prueba pendiente

La observación de salud comenzó el **10 de octubre a las 15:31:58 de Colombia**, cada cinco minutos, en `.cache/stability/ventana-2.46.1-20261010T203158Z.jsonl` (PID inicial 24644). Primera muestra correcta. Final previsto: **12 de octubre a las 15:31:58**, si el equipo y proceso permanecen disponibles. Estado `incomplete`: no se declara cumplida la ventana de 48 horas.

El responsable confirmó que dispone de dos números verificados. Se preparó una prueba de veterinaria para el **martes 13 de octubre a las 12:00**, comprobado libre: Akiles en un chat y BetaDos como nombre sugerido en el otro. El segundo operador utilizó realmente **Benji**, mascota registrada como perro.

Propuestas reales: Akiles a las **15:35:41** y Benji a las **15:36:26**. Cada chat conserva su propietario y mascota; ambas sesiones quedan en `awaiting_confirmation`, fecha `2026-10-13`, hora `12`, especie `dog`. Los mensajes muestran consulta veterinaria y aclaran «Aún no está guardada». La base no tiene citas en ese turno. El segundo mensaje fue «Quiero veterinaria para benji…», sin «cita»: la petición nueva se reconoce; al ser Benji una mascota registrada, no se repregunta su especie. Esto no prueba aún el caso de mascota nueva sin especie.

Las confirmaciones reales llegaron a las **15:37:10** (Benji) y **15:37:29** (Akiles), unos 19 segundos de diferencia. Benji recibió confirmación a las 15:37:11; Akiles recibió «ya está ocupado» a las 15:37:30. PostgreSQL contiene una única cita `confirmed`, ID `cmv2uv0hf000v0hohywrfom42`, Benji/perro/veterinaria, propietario correcto y fecha `2026-10-13T17:00:00Z`. El proxy autenticado que alimenta el calendario del dashboard devuelve exactamente esa fila. No existe reserva de Akiles en el turno. Se verifica competencia de propuestas y rechazo de la segunda confirmación desde WhatsApp; no llegada exactamente simultánea ni carrera entre procesos (el worker actual es serial). La concurrencia transaccional sí está cubierta por PostgreSQL local/CI.

Las cuatro respuestas de propuesta y confirmación/rechazo conservan `Message.externalId`, relacionado con estados reales `sent/read`. Revisión posterior: 68 trabajos entrantes y 14 registros de entrega, todos `done/complete`, cero leases vencidos. Logs del arranque a la primera revisión: cero firmas de error; salud a las 15:36:31 `ok`, versión 2.46.1 y cero fallos consecutivos. Son comprobaciones puntuales, no 48 horas completadas.

Se solicitó cancelar la cita de Benji y probar Matías sin especie en el otro chat. A las **15:38:51**, la solicitud «Cancelar mi cita veterinaria» produjo una propuesta explícita con Benji, servicio, fecha y hora; esperó consentimiento, sin cancelar por la petición inicial. Tras la confirmación, a las **15:39:01** respondió que estaba cancelada. PostgreSQL conserva la fila histórica con `status=cancelled`; `isSlotAvailable` devuelve `true` para ese establecimiento/servicio/turno y no quedan citas activas allí.

Matías: petición nueva a las **15:39:19**, sin «cita» ni especie. El asistente preguntó «¿Matias es perro o gato?» a las **15:39:21**. Tras «Perro» a las 15:39:29, ofreció martes 13 a las 11:00 a las **15:39:32**. Sesión: Matías, `dog`, `awaiting_grooming_slot_confirm`, fecha 13 y hora 11. No heredó la especie de Akiles ni creó una cita por esa propuesta. La única cita creada durante este recorrido es la de Benji, ya cancelada.

Revisión final del recorrido: **71 trabajos entrantes y 20 registros de entrega, todos `done/complete`; cero leases vencidos**. Las ocho respuestas conservan ID de Meta y recibo `read`. Logs desde el arranque de 2.46.1 hasta esa revisión: 398 líneas inspeccionadas, cero firmas de error. La observación tiene dos muestras correctas, cinco minutos de cobertura, sin huecos/reinicios/fallos; sigue `incomplete`.

## Qué sigue abierto

Este recorrido aprueba propuestas aisladas, conflicto de turno con confirmaciones separadas por 19 segundos, cancelación autorizada/liberación y petición nueva de mascota sin especie. No cierra por sí solo el paso 8 completo: faltan negativos y correcciones después de propuesta, recogida/dirección, cancelación ambigua, reprogramación fallida desde WhatsApp, atención humana/adjuntos y evaluación representativa de comprensión/latencia. Tampoco completa carga (paso 2), documentación del piloto ni 48 horas de estabilidad (paso 9). Continúa piloto interno supervisado con número de prueba de Meta.
