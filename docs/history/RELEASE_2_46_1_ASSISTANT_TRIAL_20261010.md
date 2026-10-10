# Seguimiento 2.46.1 — Especie y petición nueva

**Fecha:** 10 de octubre de 2026, hora Colombia. **Estado inicial:** corrección local probada; publicación y despliegue pendientes de CI. Continúa el piloto interno.

## Hallazgo real

Tras desplegar [2.46.0](RELEASE_2_46_0_ASSISTANT_20261010.md), las pruebas de Matías conservaron correctamente la mascota y peluquería al preguntar por hoy. El mensaje inicial del operador fue «Quiero peluquería para Matías el martes 13 de octubre», sin la palabra «cita».

La sesión arrastró la especie `other` de un borrador antiguo. La base solo tenía registrada a Akiles como perro; Matías todavía no estaba registrado. La condición de petición nueva debía reconocer el servicio expresado directamente, no depender de que el cliente dijera «cita».

## Corrección

`prepareBookingTurn` reconoce peticiones con peluquería, grooming, baño, consulta o veterinaria, además de cita/agendar/reservar. La nueva petición limpia el borrador anterior; la especie proviene del registro autorizado de la mascota o de una respuesta explícita del cliente. Una especie extraída del historial no sustituye esa pregunta.

Se añadió una regresión del adaptador completo con borrador antiguo `Matías/other` y extracción simulada `other`: devuelve `awaiting_pet_type`, especie nula y ninguna propuesta/cita guardada. Las dos suites afectadas pasan, 22 pruebas y exit 0. Verificación completa local en tres shards disjuntos: 60 suites / 473 tests, 60 / 501 y 60 / 447; los tres exit 0. Total: **180 suites y 1.421 tests**. Dos intentos de corrida única se interrumpieron sin resumen; no se contabilizan como aprobados. No cambió el frontend; su lint/build estaban aprobados en el CI de 2.46.0.

No cambia disponibilidad, capacidad ni persistencia de reservas; las seis pruebas reales de PostgreSQL de 2.46.0 siguen siendo evidencia de esos mecanismos. Falta confirmar esta corrección con OpenAI y WhatsApp reales después del despliegue, y continuar los demás escenarios del paso 8.
