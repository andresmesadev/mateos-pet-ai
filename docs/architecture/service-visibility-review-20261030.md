# Visibilidad del servicio por establecimiento — 30/10/2026

Punto 5 de preparación del producto general. Adapta señales existentes de
Comunicación, cupo de IA y salud técnica; no crea reglas de negocio ni cambia
el motor conversacional, precios, contratos o disponibilidad de citas.

## Definición y recorrido

El personal autenticado necesita distinguir la operación manual de los canales
opcionales. Inicio mostrará una consulta de solo lectura: respuesta del dashboard,
WhatsApp pausado/no disponible/configurado y situación de IA. Se permite repetir
la consulta; no conectar, consumir créditos, enviar mensajes ni corregir cobros.
Un error de una dependencia no impide consultar las otras señales. La consulta
fallida no mantiene una tarjeta anterior como si fuera vigente.

## Contrato y arquitectura

`GET /api/dashboard/service-status` usa exclusivamente el tenant resuelto por
autenticación y requiere un establecimiento concreto. Reutiliza resolución de
ruta saliente, estado del worker y estado de cupo. Devuelve enums y fechas,
sin números de canal, tokens, saldos, tareas ni actividad de otros negocios.
El personal puede leer este resumen; administrar integraciones sigue requiriendo
los permisos existentes. El cliente usa el proxy autenticado y descarta respuestas
de otro tenant o de una consulta cancelada. No realiza polling permanente.

La comprobación pública existente de OpenAI conserva en memoria únicamente su
último resultado y fecha. El resumen no ejecuta esa comprobación ni llama al
proveedor. Pasados diez minutos o tras reiniciar el proceso se informa ausencia
de evidencia reciente. Un sondeo satisfactorio de modelos no certifica todas
las funciones de IA. Una ruta WhatsApp configurada tampoco certifica entrega.
Las señales compartidas describen infraestructura común, no datos de tenants.

## Persistencia y esquema

Sin entidades, tablas, migraciones ni eventos de dominio nuevos. La observación
técnica es volátil y no acredita una ventana de estabilidad. Se mantienen las
fuentes existentes para configuración y cupos.

## Validación y decisiones diferidas

Comprobar pausa, ruta ausente, worker fallido, cupo agotado, fallo/antigüedad de
sondeo y recuperación. Verificar aislamiento, acceso del personal, ausencia de
secretos, cero llamadas externas desde la consulta, fallo/reintento en navegador
y presentación móvil. No activar proveedores ni modificar datos de producción.

No se añade monitor externo, SLA, estado público global, historial de incidentes
ni activación comercial. La estabilidad vigente y la recuperación independiente
siguen siendo criterios de admisión separados.
