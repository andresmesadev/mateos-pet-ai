# ADR 022 — Acceso de operadores a empleados operativos por WhatsApp

**Fecha:** 2026-10-15. **Estado:** aceptado explícitamente con la Etapa 3 mediante «Aprobar Etapa 3 y pasar a persistencia». **Decisor:** responsable del producto. No implementado.

## Contexto

El responsable aprobó la [definición funcional](../architecture/operational-employees-whatsapp-functional-definition.md) y los [casos de uso](../architecture/operational-employees-whatsapp-use-cases.md) para acceder a Financiero y Administración/Inventario por el WhatsApp existente. Incluye tanto al propietario con su acceso administrativo global como al personal con credencial propia.

La primera entrega de los empleados era exclusivamente por dashboard. Comunicación modela clientes y requiere `User`; el worker omite respuestas sin cliente; la salida utiliza una línea global configurada. El administrador global se autentica en Next.js y no tiene credencial Staff. Esas diferencias impiden conectar el teléfono al agente mediante un flag de administrador o un cliente ficticio.

La ampliación conceptual fue aceptada expresamente en Etapa 1 y registrada en el [modelo de dominio](../architecture/domain-model-v1.md). Este ADR decide una extensión nueva sobre esa necesidad; no afirma que los contratos anteriores ya admitieran operadores ni cambia sus reglas silenciosamente.

## Decisión aceptada

Aplicar la [arquitectura de Etapa 3](../architecture/operational-employees-whatsapp-technical-design.md): adaptador de entrada separado, vinculación de ambos extremos, identidad y modo verificables, hilos internos en Comunicación y reutilización de los comandos/recibos existentes. Mantener los casos y repositorios de clientes separados y compatibles.

Para el propietario, conservar el emisor de credenciales real en Next.js, con un verificador compartido, prueba reciente, RPC de estado vivo y generación/época revocable coordinada en backend. Los efectos y la revocación comparten una barrera transaccional. Fallar el emisor deniega acceso privado; no se acepta el rol almacenado en el vínculo como sustituto. Staff conserva su comprobación actual de credencial/versión/permisos.

La misma operación conserva principal, Tenant, clave y recibo entre canales. El modelo nunca confirma. La salida interna pasa por Comunicación y exige ruta exacta correspondiente al receptor firmado. Una configuración global solo habilita el Tenant que coincide de forma inequívoca; no se declara completado el envío por varias líneas.

## Opciones consideradas

| Opción | Complejidad/costo | Escala y operación | Adecuación al proyecto |
| --- | --- | --- | --- |
| A. Teléfono en Staff + rol admin o cliente ficticio | Baja inicialmente; costo alto de exposición y datos mezclados | No permite revocación fiable ni separación de historiales | Rechazada: contradice identidad, aislamiento y aprobación funcional. |
| B. Adaptador y atención interna, autoridad real y casos existentes | Media; añade controles de acceso y persistencia, sin nuevo proveedor | Compatible con topología actual; dependencia explícita del emisor para propietario | Elegida: conserva dominio, permisos y recuperación. |
| C. Bot/motor y credenciales administrativos independientes | Alta; duplica reglas y mantenimiento | Introduce otra identidad que debe sincronizarse y otra operación a sostener | Rechazada: no hay necesidad funcional de otro motor o cuenta. |
| D. Excluir al propietario y permitir solo Staff | Menor que B | Simplifica autenticación a costa de dejar fuera al usuario principal | Rechazada: contradice Etapas 1/2 aprobadas; tampoco autoriza inventar Staff para suplirlo. |

## Compromisos y consecuencias

- Mejora acceso móvil usando los ocho casos existentes, sin dar autonomía nueva sobre dinero o stock.
- Añade un flujo explícito de credenciales recientes y renovación; WhatsApp privado del propietario no funciona si su emisor está indisponible.
- Requiere prueba de rotación/épocas y carreras de revocación con PostgreSQL, además de un botón de confirmación verificable. Si el proveedor no acredita correlación, la confirmación termina en dashboard.
- La invalidación usa generaciones atómicas ante cambios de las fuentes de acceso, incluidos desactivar/reactivar entre mensajes; requiere triggers de infraestructura definidos en las etapas de persistencia/esquema, sin modificar las reglas del negocio.
- Resuelve la limitación de destinatario cliente mediante un caso interno dentro de Comunicación; no debilita `Conversation.userId` para todos los lectores.
- Amplía solo el origen de atención y la renovación explícita de revisión en la aplicación operativa. No se relajan caducidad, permiso, día cerrado, política de producto ni recibo único.
- Mantiene la cola actual y sus garantías de incertidumbre. No promete entrega de WhatsApp exactamente una vez ni usa un reenvío para repetir el negocio.
- Evita editar los cinco archivos del motor protegido; controlador/worker y adaptadores son los puntos previstos. Una necesidad de cambiar esa frontera exige revisión formal conforme al [ADR 010](010-reconciliacion-motor-conversacional-memoria.md), sin ampararse en su aprobación histórica para una excepción nueva.

## Próximas acciones, sujetas a aprobación

1. Etapa 3 y esta decisión aprobadas el 2026-10-15.
2. Diseñar y aprobar modelo de persistencia y esquema físico por separado.
3. Implementar localmente, verificar migraciones/concurrencia, autenticación, aislamiento y regresiones.
4. Evaluar versión antes del cierre y preparar evidencia; commit, publicación, migración productiva y envío real conservan sus autorizaciones correspondientes.

Las decisiones diferidas están al cierre de la arquitectura. No se crea una fase nueva ni se reabre el roadmap comercial; es una ampliación de canal expresamente solicitada para empleados existentes.
