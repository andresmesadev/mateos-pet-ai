# Plan de preparación para beta cerrada

**Fecha de evaluación:** 2026-09-19  
**Versión desplegada al iniciar:** `2.39.2`  
**Commit desplegado al iniciar:** `e2efeec`  
**Decisión:** no abrir todavía una beta externa. Continuar con pruebas internas supervisadas hasta completar los bloqueadores P0.

## Evidencia de partida

- CI verde: backend, PostgreSQL real y lint.
- Backend: 133 suites y 1.016 pruebas correctas.
- PostgreSQL real: 13 pruebas correctas.
- Base de datos y OpenAI responden `ok` en `/api/health`.
- 35 migraciones aplicadas.
- Cola entrante: 49 trabajos `done/complete`, 3 `needs_review/sending` y 0 leases vencidos.
- Producción registró 102 líneas de timeout de transacción en 17 horas; son al menos 51 ejecuciones fallidas del barrido de recuperación.
- WhatsApp usa todavía el número de prueba de Meta.
- `SENTRY_DSN` no está configurado y `/var/backups/mateos-pet-ai` no existe.
- Los términos y la política de privacidad siguen en borrador.

## Plan aprobado

| Paso | Trabajo | Criterio de cierre | Estado |
| --- | --- | --- | --- |
| 1 | Corregir los timeouts del worker entrante | El barrido tolera el arranque en frío de la base, tiene prueba de regresión y opera sin timeouts repetidos en producción. | 🚧 En curso |
| 2 | Garantizar capacidad de Neon | Consumo y plan verificados; la base no queda expuesta a suspensión durante el piloto. | Pendiente |
| 3 | Actualizar dependencias vulnerables y runtime Node | Cero vulnerabilidades altas conocidas en dependencias de producción, runtime soportado y CI verde. | Pendiente |
| 4 | Activar observabilidad | Sentry o equivalente recibe una excepción controlada y existe alerta de salud/worker. | Pendiente |
| 5 | Implementar backup y restauración | Backup cifrado y periódico, retención definida y restauración ensayada. | Pendiente |
| 6 | Configurar WhatsApp de producción | Número empresarial real registrado, app publicada y flujo entrante/saliente verificado. | Pendiente |
| 7 | Completar documentación legal del piloto | Política, términos y acuerdo de piloto completados y revisados. | Pendiente |
| 8 | Ejecutar matriz integral de agenda | Casos de veterinaria, peluquería, domingos, festivos, conflictos, cancelación y fallos aprobados. | Pendiente |
| 9 | Ejecutar período de estabilización | 48 horas sin errores del worker ni pérdida de mensajes; métricas y cola nominales. | Pendiente |
| 10 | Abrir cohorte inicial | Un establecimiento, alcance funcional explícito, 5–10 usuarios, soporte y criterio de rollback definidos. | Pendiente |

## Condiciones de salida a beta

La beta cerrada solo cambia a **GO** cuando los pasos 1–9 estén cerrados, los tres trabajos `needs_review` estén conciliados individualmente y exista un responsable operativo durante la primera cohorte.

## Criterios de rollback de la beta

- un mensaje entrante se pierde o queda sin respuesta sin alerta;
- una cita se duplica o se confirma sin persistencia;
- la base de datos queda indisponible o alcanza su límite operativo;
- aparecen errores repetidos del worker durante dos ciclos consecutivos;
- se rompe el aislamiento entre establecimientos;
- no puede restaurarse la información desde el respaldo verificado.
