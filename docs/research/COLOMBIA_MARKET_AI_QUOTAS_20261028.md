# Huella Nex: mercado colombiano y propuesta de cupos de IA

Consulta: 28/10/2026, Colombia. **Recomendación aceptada provisionalmente por
Andrés el 29/10/2026 como base para validar los cupos.** No se han cambiado
planes publicados, cobros, configuración ni producción.
Continúa el [modelo comercial del ADR 033](../decisions/033-modelo-comercial-dashboard-ia-whatsapp.md)
y la [validación técnica local de HN-04](../architecture/commercial-providers-validation-hn04-20261028.md).

## Conclusión

Hay ofertas para un solo segmento y también competidores que anuncian
veterinaria, pet shop y peluquería juntos. Cubrir los tres segmentos es valioso,
pero la investigación no permite afirmar que Huella Nex sea el único.
La oportunidad propuesta es operar las áreas necesarias en un establecimiento,
con precios y participación por profesional, servicios cruzados, domicilios,
caja e inventario conectados y atención con IA que mantiene control humano.
Estas ventajas deben demostrarse con el producto, sin atribuir carencias a un
competidor solo porque su página no detalla una función.

Mantener como precios iniciales de referencia $49.000 Básico y $89.000 Pro;
tomar inicialmente 1.000 y 3.000 créditos mensuales, respectivamente, según la
aceptación provisional del 29/10. Los créditos miden
operaciones de IA, no citas ni conversaciones completas. Su sostenibilidad
depende de controlar longitud de solicitudes y duración de audios y de validar
el gasto observado. La propuesta no equivale a una garantía de margen.

## Muestra pública comparable

Se consultaron páginas oficiales. No se contrataron servicios, crearon cuentas,
contactaron vendedores ni ensayaron sus productos. Son declaraciones comerciales
observadas, no auditorías de funcionalidad, estabilidad o seguridad. No es un
censo del mercado ni una clasificación de cuota de mercado.

| Oferta | Precio publicado | Alcance anunciado y cautela de comparación |
| --- | --- | --- |
| [DogtorSoftware](https://www.dogtorsoftware.com/precios) | Básico $61.600 y Profesional $73.100 COP/mes con pago mensual; con pago anual equivalen a $52.360 y $62.135/mes. Declara IVA incluido. | Gestión veterinaria, agenda y recordatorios; Profesional añade inventario/ventas e integración DIAN. Los documentos electrónicos se compran aparte. No se localizó un cupo público de IA conversacional. |
| [AnimalGroom](https://www.animalgroom.co/) | Básico $79.900 y Pro $149.900 COP/mes. | Enfoque en peluquería; 3 o 10 peluqueros, agenda, caja y recordatorios. Pro anuncia venta de productos/inventario. No es solo una agenda. No se localizó cupo de IA conversacional. |
| [Jeloda Pet Shop](https://www.jeloda.com/pet-shop) | Base desde $55.000 COP/mes; módulo avanzado de pet shop/grooming $90.000/mes. | POS, inventario, grooming, comisiones y facturación electrónica anunciados. La página enlaza una solución veterinaria; no se certificó profundidad clínica ni el alcance de IA incluido en ese precio. |
| [Intertvet](https://intertvet.com/) | Esencial $89.900 y Profesional $149.900 al mes en su oferta colombiana. | Profesional anuncia expresamente clínica, pet shop, peluquería, caja e inventario juntos. También anuncia modo offline. No se verificaron mediante uso ni se encontró un cupo público de IA conversacional. |
| [ARCLY](https://arclyvet.com/precios) | Veterinaria $69.000; estética $49.000 COP/mes. Su combinación publicada vale $110.650/mes. | Cobra por líneas de servicio y declara descuento del 15 % desde la segunda. Gestión común e inventario incluidos según su oferta; no equivale a pagar un único plan para todas las áreas. |
| [Doctor Vet](https://doctor-vet.app/) | Starter US$10/mes y Premium US$20/mes. | Anuncia clínica, pet shop y estética. Incluye IA equivalente a US$2 y US$4 mensuales; Starter limita a 200 interacciones operativas y no incluye número propio de WhatsApp. Premium anuncia número propio opcional. Es referencia regional en español, no una tarifa colombiana en COP verificada. |
| [Vetly](https://vetly.pro/) | Starter US$89 y Pro US$169/mes con recepción de WhatsApp por IA. | Declara disponibilidad en Colombia. Publica 5.000/20.000 créditos y estima 200/900 conversaciones; su crédito depende del modelo y una conversación incluye varias respuestas. Meta se factura aparte. Las cifras de crédito no son equivalentes a Huella Nex. |

Referencia adicional: [CP VET](https://cpvet.app/) anuncia $900.000 COP/año,
equivalentes a $75.000/mes, cinco agentes de IA y WhatsApp. La página ofrece
lista de espera; no se presenta aquí como contratación inmediata o servicio
operativo probado. No detalla un cupo equivalente al nuestro.

[Vetria](https://vetria.cloud/) apareció en los resultados con una oferta de
créditos por historia clínica, pero la apertura directa agotó el tiempo de
consulta. No se usa como base confirmada de precios o cupos.

Los impuestos y costos adicionales solo se consideran incluidos cuando la
fuente lo declara expresamente. No se convierten precios extranjeros con una
TRM supuesta ni se comparan anualidades como si fueran pagos mensuales libres.
Recordatorio automático, enlace manual a WhatsApp y recepción conversacional
con IA son prestaciones diferentes. La falta de un cupo publicado no significa
que la IA sea ilimitada ni que esté ausente del producto.

## Cupos recomendados para discutir

| Modalidad | Referencia de suscripción | Propuesta de cupo |
| --- | --- | --- |
| Prueba de IA | Sin cambiar aquí el plan gratuito ni su acceso al dashboard | 100 créditos una sola vez, no una bolsa mensual gratuita permanente. |
| Básico | $49.000 COP/mes, referencia actual sin cambio | 1.000 créditos por mes. |
| Pro | $89.000 COP/mes, referencia actual sin cambio | 3.000 créditos por mes. |
| Personalizado | Cotización previa | Cupo acordado según volumen y costo de operación. |

El cupo pertenece al establecimiento y se comparte entre sus áreas y los
asistentes habilitados. No debe multiplicarse por activar los tres nichos.
Los límites de equipo o módulos se revisan aparte, contra lo que el software
realmente aplica: esta propuesta no valida las promesas comerciales pendientes
del [hallazgo HN-05](../audits/HUELLA_NEX_PRODUCT_REVIEW_20261028.md).

Unidad inicial sugerida:

- Análisis, redacción, búsqueda semántica o interpretación operativa: 1 crédito
  por operación ejecutada. Una respuesta puede ejecutar varias operaciones.
- Ejemplo orientativo de texto: análisis + búsqueda + redacción = 3 créditos.
  Este ejemplo corresponde a llamadas breves de un bloque cada una. El
  [ADR 034](../decisions/034-medicion-ia-duracion-y-contexto.md) pondera textos e
  historial extensos por bloques adicionales. No hay cantidades garantizadas de
  respuestas, citas, clientes o conversaciones.
- Audio: 5 créditos por minuto iniciado de transcripción, más el procesamiento de
  texto que efectivamente se ejecute. La implementación local del ADR 034 mide
  el archivo previamente, limita a 10 minutos y contrasta la duración con Whisper.
  [Validación sintética y límites](AI_CREDIT_METERING_VALIDATION_20261029.md).
- Los clicks manuales del dashboard y los mensajes deterministas que no invocan
  IA no consumen créditos OpenAI. Eso no elimina los cargos de Meta aplicables.

Reglas propuestas: renovación mensual sin acumulación del cupo incluido,
aviso al 80 % y al agotarlo, sin cargos de excedente automáticos. La operación
manual continúa con la suscripción del software vigente. No se define aún una
tarifa de recarga o descuento anual. Las incidencias de aceptación incierta se
mantienen reservadas y requieren conciliación, según HN-04.

## Modelo económico ilustrativo

Los modelos encontrados en el código son `gpt-4.1-mini`,
`text-embedding-3-small` y `whisper-1`. La
[documentación oficial de precios de OpenAI](https://developers.openai.com/api/docs/pricing)
consultada publica para procesamiento estándar GPT-4.1 mini US$0,40 por millón
de tokens de entrada y US$1,60 de salida; embeddings small US$0,02 por millón;
Whisper US$0,006 por minuto. No se usan descuentos de Batch ni caché para el cálculo.

Supuestos del ejercicio, **no mediciones de clientes**:

- Dos llamadas de texto por turno y un embedding de 300 tokens.
- Cambio presupuestario de **4.500 COP por dólar**, elegido solo para sensibilidad;
  no se afirma que sea la TRM vigente ni la tasa que cobrará la tarjeta.
- Solo tarifa del proveedor: excluye IVA u otros impuestos, cambio bancario,
  comisiones de pago, VPS, respaldo, soporte e implementación.

Fórmula USD por turno:
`(tokens_entrada × 0.40 + tokens_salida × 1.60 + 300 × 0.02) / 1.000.000`.
Entrada y salida son la suma de las dos llamadas, no la cifra de cada una.

| Escenario supuesto | Entrada/salida agregadas | COP por turno | IA texto con 1.000 créditos a 3/turno | IA texto con 3.000 créditos a 3/turno |
| --- | --- | --- | --- | --- |
| Corto | 4.000 / 400 tokens | $10,11 | Aproximadamente $3.369 | Aproximadamente $10.107 |
| Intermedio | 8.000 / 600 tokens | $18,75 | Aproximadamente $6.249 | Aproximadamente $18.747 |
| Largo | 24.000 / 1.200 tokens | $51,87 | Aproximadamente $17.289 | Aproximadamente $51.867 |

La transcripción sería $27 COP/minuto bajo el mismo supuesto cambiario: a
5 créditos/minuto equivale a $5,40 por crédito de audio, antes del resto del
procesamiento. No se añade un cupo de audios separado que amplíe el consumo
total de forma oculta.

En el escenario intermedio el costo de IA sería alrededor del 13 % del Básico
y 21 % del Pro, pero en el largo subiría aproximadamente al 35 % y 58 %.
Por tanto **no hay un margen garantizado por contar llamadas**. Antes de
comercializar se debe validar consumo con ejemplos sintéticos representativos,
ajustar presupuesto de contexto y duración, y limitar o ponderar operaciones
largas. El tope actual de entrada de 128.000 bytes no garantiza los supuestos
de tokens de esta tabla. Una opción posterior a decidir es descontar créditos
según consumo/costo, en lugar de una ponderación fija por llamada.

## Recomendación de posicionamiento y siguientes decisiones

1. Conservar inicialmente $49.000/$89.000 como referencia de lanzamiento y
   discutir 1.000/3.000 créditos; no aumentar cupos para superar cifras ajenas
   que usan otra unidad. El precio bajo no sustituye una evaluación completa
   de costos y acompañamiento.
2. Explicar que un establecimiento puede gestionar veterinaria, peluquería y
   tienda según las áreas habilitadas. Evitar el reclamo de exclusividad:
   Intertvet y Doctor Vet también anuncian esa combinación.
3. Demostrar nuestros flujos concretos de servicios entre áreas, comisiones,
   domicilio, inventario y caja. No afirmar que los competidores carecen de ellos.
4. Publicar claramente la bolsa de IA y los cargos de Meta por separado. Una
   factura de Huella Nex más barata no demuestra un costo total menor frente a
   una oferta que anuncie recordatorios incluidos.
5. No publicitar como existentes facturación electrónica DIAN certificada,
   modo offline, consolidación de sedes u otras prestaciones sin soporte real.
   Competidores que anuncian esas funciones tienen un alcance distinto.

Andrés aceptó estos cupos como base revisable el 29/10/2026. Esa decisión no
reemplaza las decisiones pendientes de impuestos/oferta comercial ni la
aceptación externa de Meta. No se ha modificado el catálogo de planes o la
configuración real como resultado de esta investigación.
