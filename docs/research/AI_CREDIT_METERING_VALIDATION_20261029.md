# Huella Nex — validación sintética de créditos y costos de IA

**Fecha:** 29/10/2026. **Alcance:** implementación y simulación local del
[ADR 034](../decisions/034-medicion-ia-duracion-y-contexto.md), sin llamar a
proveedores de pago ni asignar cuotas reales. No constituye margen comercial
garantizado ni certifica la aceptación externa de HN-04.

## Medición implementada

- Texto: peso configurado por cada bloque iniciado de 4.000 bytes UTF-8 de la
  solicitud completa, incluidos instrucciones, historial y esquema, más una
  holgura de 256 bytes. La salida medida se limita a 1.024 tokens.
- Embedding: peso por llamada, máximo 8.000 bytes.
- Audio: peso por minuto iniciado, valor inicial propuesto 5. Máximo 10 minutos
  y 20 MiB. Un worker sin credenciales lee el archivo real, con límites de tiempo
  y memoria, y máximo dos mediciones simultáneas; un archivo ilegible o sin
  duración no llega a OpenAI. Se contrastan
  WAV y Ogg Opus sintéticos, incluidos 60/61 segundos y el pre-skip de Opus.
- Sin duración del proveedor o con discrepancia > 1 segundo, la reserva queda
  incierta para revisión: no hay devolución ni repetición automáticas.
- La política incluye revisión del algoritmo y huella de pesos. Un período
  anterior no adopta silenciosamente cantidades nuevas. No se migraron meses.

La lectura de metadata no garantiza decodificación completa ni derrota cualquier
archivo deliberadamente falsificado. Esa limitación y la discrepancia posterior
son explícitas; no se factura usando una duración que declare el remitente.

## Tarifas y supuestos

Tarifas estándar sin caché consultadas en
[OpenAI Pricing](https://developers.openai.com/api/docs/pricing):
`gpt-4.1-mini` USD 0,40/M tokens de entrada y 1,60/M de salida;
`text-embedding-3-small` USD 0,02/M; Whisper USD 0,006/minuto.
El cálculo de Whisper redondea segundos hacia arriba de forma conservadora.
No cambia los modelos del producto ni intenta una transcripción real.

Se usan **4.500 COP/USD como supuesto presupuestal**, y 6.000 para estrés;
ninguna cifra se presenta como TRM vigente o tasa de tarjeta. Se excluyen
impuestos, soporte, VPS, respaldo y comisiones de pago.

## Casos reproducibles

Calculador: `scripts/helpers/ai-credit-costs.cjs`. Las cantidades de tokens son
supuestos sintéticos explícitos, no métricas de clientes ni facturas de OpenAI.
Los bytes de esta tabla ya incluyen la holgura cuando corresponde.

| Caso supuesto | Entrada | Créditos | Proveedor COP a 4.500 |
| --- | --- | --- | --- |
| Texto breve | 2.256 bytes, 800 tokens de entrada, 200 salida | 1 | 2,88 |
| Texto intermedio | 12.256 bytes, 4.000 tokens entrada, 400 salida | 4 | 10,08 |
| Contexto extenso | 96.256 bytes, 24.000 tokens entrada, 1.024 salida | 25 | 50,57 |
| Transcribir 60 s | 1 minuto iniciado | 5 | 27,00 |
| Transcribir 61 s | 2 minutos iniciados | 10 | 27,45 |
| Transcribir 10 min | 10 minutos | 50 | 270,00 |
| Embedding al máximo conservador | 8.000 bytes, hasta 8.000 tokens | 1 | 0,72 |

El texto posterior a transcribir suma su consumo; no queda incluido en los
5 créditos. Tampoco se promete que cada respuesta use una sola operación.

## Envolvente conservadora por cupo

Para texto puro se presupone hasta un token de entrada por byte UTF-8 reservado
y la salida máxima en **cada** llamada: USD 0,0032384 por crédito con peso 1.
El cómputo incluye la solicitud completa y holgura, no solo el mensaje nuevo.
Audio con peso 5 y embedding están por debajo de esta envolvente en los casos
indicados. Tarifas nuevas, modelos nuevos o sobrecostos regionales obligan a
revisar el presupuesto antes de activarlos.

| Cupo provisional | Referencia del plan COP | Solo IA, COP a 4.500 | Solo IA, estrés a 6.000 |
| --- | --- | --- | --- |
| Prueba, 100 una sola vez | Sin cobro | 1.457,28 | 1.943,04 |
| Básico, 1.000 mensuales | 49.000 | 14.572,80 | 19.430,40 |
| Pro, 3.000 mensuales | 89.000 | 43.718,40 | 58.291,20 |

Esta envolvente es una comprobación presupuestal de la política, no una garantía
de precio del proveedor. Por ejemplo, Pro deja 45.281,60 COP antes de los demás
costos bajo el primer supuesto; con el dólar de estrés deja 30.708,80. El monto
no es utilidad neta. La oferta final sigue pendiente de presupuesto integral.

## Validación técnica y estado

Se prueba el medidor con archivos sintéticos y las reservas/conciliaciones con
PostgreSQL descartable. Los resultados finales se registran en el
[informe HN-04](../architecture/commercial-providers-validation-hn04-20261028.md).
No se cargan prompts, audios ni datos personales en el registro de consumo.

Meta: el 29/10 se creó la app y portfolio Huella Nex y se confirmó la clasificación
como proveedor de tecnología. Eso no es aprobación: la verificación documental
se dejó como solicitud pendiente por decisión de Andrés, sin completar el envío
documental. Privacidad pública, revisión/permisos, configuración y aceptación
externa continúan pendientes. El control de cuotas reales sigue desactivado.
