# ADR 034 — Créditos de IA por duración y tamaño del contexto

**Fecha:** 29/10/2026. **Estado:** implementación local autorizada por Andrés
al continuar la medición de audios y validación de costos del punto HN-04.
Base: [ADR 033](033-modelo-comercial-dashboard-ia-whatsapp.md). No habilita
cuotas reales, publicación comercial ni despliegue.

## 1. Definición funcional

Una transcripción larga y una solicitud con mucho historial no pueden gastar
lo mismo que una operación breve. El saldo se reserva antes de llamar al
proveedor, por Tenant, sin excedentes automáticos. La operación manual continúa.

## 2. Casos de uso

- Audio: medir localmente el archivo; reservar `peso × ceil(segundos / 60)`.
  El peso inicial para validar es 5 créditos por minuto iniciado. Un audio de
  60 segundos usa 5; uno de 61, 10. El texto posterior consume por separado.
- Texto (análisis, respuesta e interpretación): reservar el peso configurado
  por cada bloque iniciado de 4.000 bytes UTF-8 de la solicitud completa,
  incluidos historial, instrucciones y esquema. Se añade una holgura de 256
  bytes para el encuadre del proveedor. Esta unidad NO se anuncia como tokens.
- Embeddings: un peso por llamada, entrada máxima de 8.000 bytes.
- Rechazar audio sin duración válida, de más de 10 minutos o de más de 20 MiB
  antes de llamar a OpenAI. Las solicitudes de texto conservan el límite de
  128.000 bytes y salida máxima de 1.024 tokens por llamada medida.
- Preservar reserva y marcar conciliación si el proveedor acepta pero no
  confirma la duración, o difiere en más de un segundo de la medición local.
  No se libera saldo ni se repite la llamada por esa discrepancia.

## 3. Arquitectura técnica

`ai-metering.service.js` calcula las cantidades; `ai-quota.service.js` conserva
el único punto de reserva y liquidación transaccional. `audio.service.js` mide
antes de transcribir y solicita `verbose_json` de Whisper para contrastar la
duración. La lectura de metadata usa `music-metadata` en un worker limitado en
memoria/tiempo (5 segundos, hasta dos mediciones simultáneas); no incorpora
ffmpeg ni depende de ejecutables del sistema. Un exceso de concurrencia se
rechaza localmente, sin reserva ni llamada pagada.
Solo se devuelve duración/tamaño, sin etiquetas o contenido del archivo.

La duración local procede del contenedor y sus muestras cuando están disponibles,
no de una duración enviada por el cliente. No es una certificación de decodificación
completa; archivos incoherentes pueden requerir conciliación tras la respuesta.
Una futura validación por decodificación es una opción explícitamente diferida.

La versión efectiva incluye la revisión del medidor y una huella de los pesos.
Cambiar pesos o algoritmo no revaloriza silenciosamente un mes ya abierto:
requiere una activación planificada para el siguiente período o una transición
comercial documentada. No se modifica ningún período operativo en esta tarea.

## 4. Persistencia

Se reutilizan `AiQuotaConfig`, `AiQuotaPeriod` y `AiUsageEntry`. El JSON
`providerUsage` guarda bytes, bloques/minutos, duración local y metadatos
admitidos del proveedor, nunca audio, transcripción, prompts ni respuestas.
Las liquidaciones siguen siendo idempotentes; reservado + usado <= cupo.

## 5. Esquema físico

Sin tablas, columnas ni migraciones adicionales. Las restricciones, locks y
relaciones Tenant/período de HN-04 permanecen. Se prueba PostgreSQL únicamente
en el contenedor temporal autorizado, sin usar la base del establecimiento.

## Alternativas y consecuencias

Contar solo llamadas era sencillo pero dejaba abiertos audios/contextos largos.
Facturar tokens exactos después de la respuesta no permite reservar un límite
antes de consumir y aún exige estimación. Se elige una unidad conservadora y
explicable con reserva previa. Una respuesta puede gastar varios créditos;
1.000 créditos no garantizan 1.000 respuestas ni un margen económico fijo.

Los costos se ensayan con material sintético y tarifas del modelo vigente.
No se promete margen final: impuestos, cambio de moneda, soporte e infraestructura
requieren presupuesto aparte. No se llama a APIs de pago en estas pruebas.

## Fuentes técnicas

- [music-metadata: API y opciones de duración](https://github.com/borewit/music-metadata).
- [OpenAI: transcripciones y verbose_json](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create).
- [OpenAI: precios](https://developers.openai.com/api/docs/pricing).

## Decisiones diferidas

Tarifas definitivas, recargas, impuestos y activación real de planes; verificación
documental/aprobación de Meta y coexistencia con WhatsApp Business; medición
económica observada en producción. Esta tarea no cierra HN-04 completo.
