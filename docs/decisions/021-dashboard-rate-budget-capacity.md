# ADR 021 — Cupo de dashboard por identidad autenticada

**Fecha:** 13 de octubre de 2026. **Estado:** diseño acotado para corregir el hallazgo del paso 2. El responsable indicó dos o tres operadores simultáneos. No agrega fases ni capacidades de negocio.

## Cinco etapas de diseño

1. **Definición funcional:** los operadores autorizados del mismo establecimiento deben poder mantener sus pantallas activas sin agotar entre sí su cupo. La proxy Next.js agrupa sus peticiones en una IP hacia Express; el cupo actual de 60/minuto por IP se comparte. WhatsApp del dashboard consulta mensajes cada cinco segundos, bandeja cada diez y permisos cada treinta: tres puestos pueden superar 60/minuto.
2. **Casos de uso:** tres operadores validados tras resolución de establecimiento disponen de 60/minuto cada uno; un operador que supera su cupo recibe 429. Cambiar headers sin token válido no crea identidades/cupos nuevos. Un token inválido o ausente mantiene protección IP de 60/minuto y rechazo de autenticación. Acceso suspendido, sesión revocada, permisos y aislamiento siguen siendo decididos por los guards existentes.
3. **Arquitectura:** filtro de entrada por IP antes de `resolveTenant`: 300/minuto solo para el token del proxy confiable, 60 para el resto. Esto limita trabajo compartido incluso con múltiples identidades. Luego resolver tenant/actor y aplicar 60/minuto por combinación de establecimiento, tipo y principal ya autenticados. ID staff o correo admin provienen exclusivamente de `req.actor`; no usar headers crudos para asignar cupo de actor. Sin principal utilizable, conservar fallback IP con normalización IPv6 oficial del limitador. Hash de clave para no almacenar correos legibles. La validación del token para elegir el techo de entrada no autoriza acceso: `resolveTenant` sigue verificándolo y validando sesión/establecimiento.
4. **Persistencia conceptual:** contadores en memoria del limitador existente; no constituyen identidad del negocio ni una agrupación superior al Tenant. El despliegue continúa con una sola instancia. Contadores distribuidos y múltiples instancias quedan diferidos hasta requisito real y diseño específico.
5. **Esquema físico:** sin entidades, índices ni migraciones. Webhook, API pública y rutas de facturación conservan sus limitadores. Cambio de mantenimiento con versión patch; regresión previa de tres actores/una IP, negativos de token, cupo individual y aislamiento, suite completa y CI antes de despliegue.

## Validación requerida

Demostrar localmente el rechazo compartido previo y la separación posterior con middleware Express real y resolución de identidad bajo dependencias de prueba. No fabricar staff ni sesiones en producción. Verificar en VPS autenticación, 429 del cupo actor en un entorno aislado, lecturas acotadas, salud y ausencia de reinicios inesperados. Preservar la observación de la versión anterior antes de reinicio; no sumar ventanas entre versiones.
