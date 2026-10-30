# ADR 033 — Dashboard e IA gestionados; WhatsApp propio del establecimiento

**Fecha:** 28/10/2026. **Responsable:** Andrés.
**Estado:** decisión comercial aceptada; implementación local validada; aceptación
externa de Meta pendiente. Cupos iniciales aceptados provisionalmente el
29/10/2026; validación económica y oferta definitiva pendientes.

**Seguimiento 28/10:** [evidencia técnica y límites de HN-04](../architecture/commercial-providers-validation-hn04-20261028.md).
El contexto siguiente describe la situación que motivó la decisión.

## Contexto

Huella Nex se ofrecerá a establecimientos independientes. El dashboard tiene
una suscripción comercial implementada, todavía con precios de referencia.
Los servicios de IA usan actualmente `OPENAI_API_KEY` del servidor; se registran
algunas métricas en logs, pero no existe un cupo comercial persistente por Tenant.
WhatsApp conserva una conexión global protegida por la contención HN-04, que
no implementa la conexión independiente de varios establecimientos.

Andrés pidió completar esa capacidad antes de considerar cerrado el punto 4,
para definir cómo vender el software y los servicios de proveedores externos.
Este requerimiento comercial explícito justifica diseñar ahora la capacidad
multilínea que anteriormente se había diferido. No presupone un segundo negocio
real ya conectado ni autoriza usar sus datos para probar.

## Decisión aceptada

Andrés seleccionó expresamente:

> Huella Nex cobra dashboard + IA con un cupo; cada negocio conecta y paga su WhatsApp a Meta.

| Concepto | Prestación y cobro previstos |
| --- | --- |
| Software | El establecimiento paga a Huella Nex el acceso al dashboard según su plan. |
| IA | Huella Nex gestiona y paga su integración con OpenAI e incluye un cupo definido en la oferta del establecimiento. No se exige una cuenta de OpenAI al cliente en este modelo. |
| WhatsApp | Cada establecimiento conserva su cuenta/número y autoriza su conexión. Paga a Meta los cargos aplicables de WhatsApp Business Platform. Ese consumo no se presenta como incluido en el cupo de IA. |

Esta es una decisión del producto. No constituye a Nexo Web como sociedad,
no activa contratación, no aprueba precios finales y no modifica cuentas de
proveedores ni métodos de pago.

## Cupos iniciales aceptados el 29/10/2026

Andrés aceptó usar por el momento la recomendación de la
[comparación de mercado](../research/COLOMBIA_MARKET_AI_QUOTAS_20261028.md)
como base de validación, sin publicar ni activar los valores:

| Modalidad | Referencia de precio | Cupo inicial |
| --- | --- | --- |
| Prueba de IA | Sin cobro por la prueba | 100 créditos una sola vez. |
| Básico | $49.000 COP/mes | 1.000 créditos al mes. |
| Pro | $89.000 COP/mes | 3.000 créditos al mes. |
| Personalizado | Cotización previa | Cupo acordado según volumen. |

La bolsa pertenece al establecimiento, compartida por sus áreas y asistentes.
No representa un número garantizado de mensajes, conversaciones o citas.
Se conserva el criterio de renovación mensual sin acumulación, avisos al 80 %
y al agotarse y ausencia de cargos automáticos de excedentes. El dashboard
sigue disponible con la suscripción habilitada aunque se agote la IA.

La pauta inicial para validar ponderaciones es un peso base por operación y
5 por minuto iniciado de transcripción, más el procesamiento de texto utilizado.
El [ADR 034](034-medicion-ia-duracion-y-contexto.md) concreta la duración y
ponderación de contextos extensos: texto por bloques de 4.000 bytes de solicitud
completa, audio hasta 10 minutos, reserva previa y versión efectiva de política.
La validación económica sintética se documenta en el
[informe de medición](../research/AI_CREDIT_METERING_VALIDATION_20261029.md).
Los precios siguen siendo referencias de
lanzamiento, sin fijar aquí impuestos ni constituir una oferta final publicada.
Esta aceptación no asigna saldo a establecimientos reales ni autoriza cambios
en Stripe, Meta, credenciales, producción, commit, push o despliegue.

## Opciones consideradas originalmente

1. **Modelo elegido:** software e IA gestionados, WhatsApp pagado por el negocio.
   Simplifica el uso de IA y separa la titularidad y los gastos de Meta. Exige
   medir y limitar el consumo de IA por establecimiento.
2. **Cuentas propias para todo:** el negocio paga OpenAI y Meta. Reduce la
   exposición de consumo de la plataforma, pero añade configuración técnica
   y soporte al cliente. No es el recorrido elegido.
3. **Un único cobro con todo incluido:** Huella Nex absorbe también Meta.
   Implica otra organización de facturación, requisitos del proveedor y riesgo
   de consumo. No es el modelo elegido ni se asume habilitada una línea de crédito.

## Consecuencias y condiciones de implementación

- El Tenant continúa siendo la única unidad de aislamiento; no se crea una
  Organización superior para resolver cuentas de proveedores.
- Una cuenta de Meta, número, token, webhook o plantilla no puede seleccionar
  ni autorizar otro establecimiento. El envío requiere la ruta propia vigente.
- Las credenciales permanecen en servidor, protegidas, revocables y sin
  devolverse al navegador o aparecer en logs. La conexión no se reclama
  simplemente escribiendo un número o un identificador en un formulario.
- El consumo de IA necesita atribución y control persistentes por Tenant,
  incluyendo las operaciones que generan llamadas de texto, audio y embeddings.
  Las comprobaciones de salud de la plataforma se distinguen del uso del cliente.
- Debe definirse cómo se expresa el cupo, cómo se mide y qué incluye antes de
  publicarlo. No se promete IA ilimitada ni se convierte un mensaje de WhatsApp
  en una unidad de IA sin una regla comercial explícita.
- Agotar el cupo de IA detiene las funciones que requieren IA, conservando
  agenda, clientes, caja e inventario mientras la suscripción del software esté
  habilitada. No se usa `Tenant.active` para representar agotamiento del cupo.
- La atención humana desde WhatsApp podrá continuar si la conexión y sus
  permisos siguen vigentes; no depende de que quede cupo para respuestas de IA.
- No habrá cobros adicionales automáticos por consumo sin condiciones y
  aceptación expresas. La política de ampliación/renovación se definirá antes
  de ofrecerla; no se crea ahora una recarga ni un cargo.
- Conectar WhatsApp requiere verificar las condiciones y permisos de Meta.
  La conservación de uso simultáneo en la app WhatsApp Business debe comprobarse
  para el recorrido elegido; no se promete coexistencia a todos los números.

## Trabajo necesario antes del cierre

La [definición funcional](../architecture/commercial-providers-functional-definition-20261028.md)
concreta el recorrido elegido y separa las decisiones que aún no están fijadas.

1. Definición funcional, casos de uso y recorrido de conexión/desconexión.
2. Arquitectura de credenciales y enrutamiento por Tenant; autorización de
   conexión, firma de webhooks, revocación y tratamiento de colas pendientes.
3. Definición del cupo de IA y medición de todos los caminos de consumo;
   límites concurrentes, reintentos, conciliación y respuesta al agotamiento.
4. Modelo de persistencia, esquema físico y migración compatible con la
   conexión actual, sin reasignar canales o credenciales a otro negocio.
5. Implementación y pruebas con dos establecimientos ficticios, incluyendo
   números propios, secretos, mensajes, plantillas, cupos y revocación aislados.
6. Verificación del alta comercial del proveedor, permisos y facturación directa
   a Meta; ensayo de aceptación autorizado antes de habilitar negocios externos.

La contención existente se conserva. HN-04 permanece **abierto para capacidad
comercial multilínea** hasta completar el recorrido y sus evidencias; una prueba
con transportes simulados no certifica una aprobación o conexión real de Meta.

## Fuentes primarias consultadas

- [Meta: ecosistema de proveedores y Embedded Signup](https://whatsappbusiness.com/partners/become-a-partner/).
  Describe Tech Providers/Partners, alta de negocios y el rol distinto de los
  Solution Partners para compartir líneas de crédito. No acredita aprobación
  de la cuenta de Huella Nex.
- [Meta: precios de WhatsApp Business Platform](https://whatsappbusiness.com/products/platform-pricing/).
  Distingue cargos por mensajes entregados según categoría/mercado y mensajes
  de servicio gratuitos dentro de su ventana. No fija aquí una tarifa universal.
- [OpenAI: proyectos, límites y alertas de consumo](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform).
  Los límites del proveedor se configuran en organización/proyecto y no
  sustituyen un cupo por Tenant dentro de Huella Nex. Las alertas no detienen
  tráfico; incluso el límite estricto puede tener un pequeño exceso por latencia.

Las páginas técnicas específicas de Embedded Signup y coexistencia devolvieron
429 en esta consulta. Sus requisitos concretos y su aplicabilidad deben verificarse
antes de aprobar la arquitectura de integración; no se dedujeron de foros.
