# Huella Nex: visibilidad del servicio

**Fecha:** 30/10/2026. **Punto 5 de la revisión del software general.**
Resultado local sobre datos sintéticos; no constituye una verificación actual
de la VPS ni de las cuentas externas.

## Hallazgo y resultado

Administración ya mostraba configuración comercial y cupos, pero Inicio no
distinguía una pausa de WhatsApp de una incidencia del proveedor o de falta de
evidencia. Un cupo disponible tampoco acredita que OpenAI esté respondiendo.

Inicio incorpora **Estado del servicio**, con fecha de consulta y actualización
manual. El resumen compacto separa dashboard, WhatsApp e IA. «Qué significa
este estado» explica las consecuencias y cómo continuar atendiendo.

- Dashboard: responde a esta consulta autenticada; no garantiza todos los
  guardados ni amplía los permisos de quien entra.
- WhatsApp: pausa general, ruta no disponible, procesador con incidencias,
  configuración disponible o consulta fallida. Una ruta configurada no se
  presenta como confirmación de entrega de mensajes.
- IA: falta de configuración, política o cupo, cupo agotado, fallo reciente,
  sondeo reciente correcto, ausencia de sondeo reciente o consulta fallida.
  El sondeo de modelos existente no certifica cada función de IA.
- Los fallos indican continuar manualmente y avisar a soporte. Ante un cobro
  sin respuesta, se indica revisar el historial antes de repetirlo.

La consulta no contacta a Meta/OpenAI, no genera consumos, no conecta proveedores
ni cambia operaciones. Lee señales existentes y el último sondeo técnico de
OpenAI, conservado en memoria hasta diez minutos. Después de ese plazo o un
reinicio, la ausencia de evidencia se declara expresamente.

## Aislamiento y acceso

El endpoint usa exclusivamente el establecimiento autenticado. Una query ajena
no selecciona otro negocio; el modo de plataforma requiere uno concreto.
El personal puede leer los estados, sin obtener administración de integraciones.
Se devuelven estados y fechas, sin tokens, identificadores de línea, saldos,
consumos individuales ni actividad ajena. Las señales del proveedor y worker
describen infraestructura compartida, sin exponer sus detalles internos.

El cliente usa el proxy autenticado, rechaza identidad ajena y estados
desconocidos, cancela consultas al desmontarse y limita la espera a diez
segundos. Un reintento retira el resultado anterior mientras consulta; no
mantiene un éxito obsoleto ante un error. No añade polling permanente.

Diseño: [Visibilidad del servicio](../architecture/service-visibility-review-20261030.md).

## Validación

| Comprobación | Resultado |
| --- | --- |
| `node scripts/verify-onboarding-local.cjs --service-visibility` | 24 comprobaciones aprobadas, 0 fallos |
| Suite backend aislada | 238 suites, 2.136 pruebas aprobadas |
| Suite de flujos Node | 43 archivos, 292 pruebas aprobadas |
| Build Next y TypeScript | Correctos |
| ESLint frontend | Sin diagnósticos |

El recorrido PostgreSQL/navegador registra, opera y cierra tres negocios
independientes, después consulta su estado. Comprueba pausa y ausencia de
sondeo, error 503, respuesta con identidad ajena, recuperación, sondeo fallido
y satisfactorio, política pendiente, cupo sin asignar y agotamiento.
Los resultados monetarios y artículos permanecen idénticos y no se crea ninguna
entrada de uso de IA. No hay solicitudes externas ni errores de navegador.

Se revisó la presentación en 320, 390 y 1440 px. Las capturas sintéticas están
en `.cache/service-visibility/`; el contenedor temporal propio se elimina al
terminar y no modifica el contenedor de desarrollo existente.

## Límites y publicación

No es un monitor en tiempo real, no incluye pruebas nuevas de entrega/recepción
ni acredita 48 horas limpias, recuperación independiente o aprobación Meta.
El texto fechado se refiere al momento consultado. La observación volátil
puede no existir si el sondeo público no se ha ejecutado recientemente.

Sin esquema nuevo, migraciones, cambios al motor conversacional o reglas de
precios/comisiones. Se mantiene el candidato 2.58.3 pendiente de revisión de
publicación, sin tag oficial. No se hizo commit, push ni despliegue.
