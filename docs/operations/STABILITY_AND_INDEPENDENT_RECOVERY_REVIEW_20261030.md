# Estabilidad y recuperación independiente — 30/10/2026

## Comprobación real de la VPS

Lectura SSH con huella existente y verificación estricta, realizada el 30/10
a las 13:14 Colombia. No se cambiaron servicios, configuración o datos.

Ventana `ventana-2.58.2-20261027T213519Z`:

| Criterio | Resultado observado |
| --- | --- |
| Inicio | 27/10/2026, 16:35:20 Colombia |
| Fin | 29/10/2026, 16:35:20 Colombia |
| Cobertura | 48 horas; 577 muestras |
| Continuidad | Sin huecos mayores de 330 s; máximo 300,101 s |
| Versión | 2.58.2; sin versión inesperada |
| Muestras fallidas | Dos HTTP 503 por OpenAI, 27/10 a las 16:35 y 16:45 |
| Base de datos en las muestras fallidas | `ok` en ambas |
| Cola | Worker pausado; esta ventana no certifica entrega de WhatsApp |
| Tramo correcto posterior | 574 muestras; 47,75 horas entre primera y última correctas posteriores al último fallo |
| Veredicto del observador | `incident`; código de salida 1 |

**Conclusión:** la observación sí terminó las 48 horas. No fue una ventana
completamente limpia y el ítem 9 no se cierra automáticamente. Se conserva la
evidencia íntegra; no se excluyen los primeros minutos para declarar éxito.
El estado `failed` de la unidad del observador corresponde a ese veredicto;
no significa por sí solo que la aplicación esté caída.

En la lectura de Docker, backend y frontend estaban `running`, ambos con cero
reinicios. El timer de respaldo estaba activo y la última ejecución terminó
`success`, exit 0, a las 13:00:04 Colombia del 30/10. La siguiente estaba prevista
para las 13:30. Esto comprueba ejecución, no restaurabilidad completa ni copia
independiente. Los resúmenes de salud pública no equivalen a disponibilidad
medida de cada pantalla o transacción del dashboard.

Lectura pública posterior desde la VPS, a las 13:15:45 Colombia: HTTP 200,
versión 2.58.2, base y OpenAI `ok`, worker `paused` y saludable. Es una muestra
actual, no otra ventana de estabilidad ni una certificación de sus 48 horas.

Siguiente trabajo para estabilidad: revisar las dos incidencias y su política
de degradación; mantener la separación entre salud del dashboard y dependencia
de IA. Una aceptación con incidencias conocidas debe acordarse explícitamente;
no se modifica retrospectivamente el criterio de ventana limpia ni se inicia
una nueva observación sin conservar la anterior.

## Recuperación independiente: propuesta, no implementada

Mantener el respaldo cifrado de la VPS y enviar automáticamente una copia a
almacenamiento de objetos de otro proveedor, bajo la administración de Huella
Nex. El servidor realiza la transferencia; no requiere un computador de Mateos
Pet, una cuenta del cliente o Google Drive.

Propuesta inicial: copiar cada conjunto nuevo tras generarse cada 30 minutos,
verificar integridad, mantener retención acordada, alertar si deja de copiarse
y ensayar recuperación desde el destino externo. Conservar por separado las
claves de recuperación y registrar también qué configuración y recursos se
necesitan para reconstruir la aplicación. Un dump de BD por sí solo no certifica
recuperar el servicio completo.

Opciones consultadas en fuentes oficiales el 30/10:

| Destino | Referencia de almacenamiento | Observación |
| --- | --- | --- |
| Cloudflare R2 Standard | 10 GB-mes gratuitos; USD 0,015 por GB-mes adicional; operaciones con franquicias y cargos propios | Opción recomendada para evaluar primero; proveedor distinto de Oracle y salida a Internet sin cargo de R2. No implica que todo uso sea gratuito. |
| Backblaze B2 | Primeros 10 GB gratuitos; precio publicado desde USD 6,95/TB-mes | Alternativa orientada a copias; comprobar región y condiciones de descarga/retención al configurar. |
| Oracle Object Storage | Servicio separado de la VM; cuotas y precio dependen del régimen de cuenta | Puede separar la copia de la máquina, pero conserva dependencia de la misma cuenta/proveedor. No es la primera opción para diversificar ese riesgo. |

Fuentes: [R2, precios oficiales](https://developers.cloudflare.com/r2/pricing/),
[B2, precios oficiales](https://www.backblaze.com/cloud-storage/pricing),
[Oracle, almacenamiento](https://www.oracle.com/cloud/storage/).
Se contrastó también la documentación Always Free de Oracle; sus franquicias
no se atribuyen automáticamente a la cuenta del operador.

Ejemplo R2: 100 GB-mes de almacenamiento medio Standard, menos 10 incluidos,
suponen USD 1,35 de almacenamiento; operaciones, impuestos y otros servicios
se evalúan aparte. No es una cotización ni una proyección de consumo del centro.
Cada copia completa retenida cuenta: la frecuencia y el tamaño acumulado
importan, no solo el tamaño de una base.

Antes de implementarlo: elegir proveedor, región, cuenta, retención, presupuesto
y custodia de claves; revisar las condiciones del proveedor para datos reales.
No se creó una cuenta, bucket, suscripción, clave o transferencia en esta
revisión, ni se reactivó la tarea retirada del computador.
