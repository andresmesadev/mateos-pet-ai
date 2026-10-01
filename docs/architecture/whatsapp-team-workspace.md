# WhatsApp compartido por el equipo — mantenimiento autorizado 2026-10-01

## 1. Definición funcional

El responsable del producto aprobó aplicar conjuntamente permisos por responsabilidad, autoría real, contexto de citas y coordinación equipo/IA. Se conserva el diseño similar a WhatsApp Web. La cuenta administradora mantiene sus capacidades clínicas; no necesita una segunda contraseña.

## 2. Casos de uso y reglas

- Administrador: acceso completo. Veterinario: consultas existentes y WhatsApp, con expediente clínico. Recepción: WhatsApp y creación de citas, sin expediente clínico ni finanzas. Peluquero: WhatsApp, contexto de peluquería e historial de sus visitas, sin expediente clínico ni finanzas.
- Habilitar/revocar credenciales del equipo sigue siendo administrativo; la sesión se valida contra StaffCredential activo, versión y rol real en cada petición.
- Tomar conversación: identidad autenticada, establecimiento explícito, conversación canónica del propietario; una asignación persistida. Dos trabajadores no pueden tomar simultáneamente el mismo hilo. El administrador puede reasignar explícitamente al tomarlo, previa confirmación en pantalla.
- Responder: exige haber tomado el hilo. Un trabajador distinto recibe 409 y conserva su borrador. El administrador tampoco envía silenciosamente por encima del responsable actual.
- Devolver a IA: solo el responsable o administrador. Quita asignación y restablece status activa. No envía mensajes por sí mismo. Resolver una escalación en el dashboard sigue este comando para impedir liberaciones ajenas.
- Autoría: snapshot del nombre, identidad y rol autenticados para nuevos mensajes manuales. Los anteriores se muestran como históricos sin atribuirlos retroactivamente a IA o personas.
- Contexto: próxima cita abierta, atención en curso y última visita, con mascota, servicio, profesional y estado. Consultas clínicas solo para veterinario/administrador; peluquería solo para peluquero/administrador; recepción ve agenda sin historias.

## 3. Arquitectura técnica

Comunicación incorpora comandos de tomar/devolver y un adaptador Prisma de control, sin duplicar reglas de Agenda o precios. Todos los envíos continúan pasando por SendMessageUseCase. El mutex por teléfono existente (8.2, una instancia de backend) serializa cambios de control y entrega; una comprobación justo antes del proveedor impide enviar respuestas automáticas preparadas antes de tomar el hilo. InboundJob conserva cuándo se preparó la respuesta para descartarla si cambió el control posteriormente. Los recordatorios de sistema siguen funcionando.

Reconciliación acotada: el permiso vet deja de significar «solo pantalla de consultas» y admite WhatsApp. Recepción, ya conceptualizada en Staff (§6), se incorpora al vocabulario implementado. Origin sigue siendo cliente/agente/sistema; la autoría es un atributo adicional, no un cambio de ese enum. La asignación ya está definida en Comunicación (§10). Se amplía la selección de conversación activa para conservar una conversación tomada aunque el wizard esté completed. No se reescribe el wizard ni se modifica ninguna regla de reserva.

### Decisiones diferidas

No se agregan adjuntos, plantillas nuevas, estados de entrega ficticios ni seguimiento de lectura. El mutex distribuido sigue diferido conforme a 8.2; desplegar varias réplicas requiere resolverlo primero. La cuenta de administrador conserva el modelo de autenticación actual; un Staff con rol admin tiene permisos administrativos por diseño explícito.

## 4. Modelo de persistencia

Conversation conserva status como fuente de verdad de la pausa de IA y añade snapshot del responsable, fecha y versión de control. No hay propietario humano implícito. Message añade tipo de autor y snapshot opcional; valores históricos nulos se conservan. StaffCredential se reutiliza para todos los roles admitidos.

## 5. Esquema físico

Migración aditiva: columnas de asignación/control en Conversation y autoría en Message. Sin borrados ni actualización de historial. prisma generate después de aplicar la migración local. El establecimiento y actor nunca se aceptan desde body/query como identidad.

## 6. Validación ejecutada — 2026-10-01

Se comprobaron autenticación/revocación, matriz de rutas, aislamiento cross-tenant, dos tomas simultáneas, envío por responsable ajeno, devolución, descarte de respuestas IA obsoletas, snapshot de autor y contexto por rol. La recepción recibe únicamente identidad/contacto en la búsqueda de clientes y los datos básicos de mascotas al reservar; las notas e información privada del expediente no salen en esas respuestas. Un consumidor de eventos puede enviar al mismo teléfono sin bloquear el mutex.

Evidencia real:

```text
Backend: npm test -- --runInBand --silent --json --outputFile=%TEMP%/mateos-whatsapp-jest.json
Test Suites: 154 passed, 154 total
Tests:       1166 passed, 1166 total
Time:        25.609 s

Frontend: npm run lint
> eslint
Exit code: 0

Frontend: npm run build
Compiled successfully
Finished TypeScript
Generating static pages (28/28)
Exit code: 0

node --test scripts/whatsapp-workspace.test.cjs scripts/contact-navigation.test.cjs scripts/contact-profile-utils.test.cjs
tests 15 / pass 15 / fail 0

node scripts/verify-whatsapp-team-local.cjs verify
PASS: contexto real en PostgreSQL por los cuatro perfiles, toma/traspaso/devolución durable y cero mensajes enviados.

node scripts/verify-whatsapp-team-local.cjs cleanup
PASS: solo datos sintéticos retirados; datos del negocio conservados.
```

Recorrido real del navegador: entrar como administrador, tomar chat, preparar borrador, consultar citas/notas, devolver, simular otro responsable, confirmar traspaso y conservar borrador. Entrar con cuentas temporales de recepción, peluquería y veterinaria: navegación y contexto propios, reserva preseleccionada para recepción, notas para peluquería y expediente clínico para veterinaria. Revisión a 1600×1000 y 390×844; móvil sin desbordamiento horizontal (scrollWidth = clientWidth = 390). Se restauraron tamaño habitual y cuenta administrativa; todas las cuentas, citas y mensajes sintéticos se retiraron.

Captura de comprobación con datos ficticios: `C:/Users/andre/.codex/visualizations/2026/09/24/01a0d560-bea1-7712-8d8c-48fe1ae7e408/whatsapp-equipo-2026-10-01.png`.

La búsqueda de `sendWhatsAppMessage(` en todo el repositorio conserva un único llamador de producción: el proveedor de infraestructura de Comunicación. Cero referencias a apiUrl en los componentes WhatsApp; acceso autenticado mediante proxyUrl. `git diff --check` sin errores. Migración `20261001180000_whatsapp_team_control` aplicada a mateos_dev local y cliente Prisma regenerado. Envíos de proveedor verificados con mocks; no se enviaron WhatsApp reales ni se probó entrega externa de Meta.

## 7. Entrega y versionado

Entrega autorizada por el responsable del producto el 2026-10-01: commit, push y despliegue conjunto de Clientes y mascotas y WhatsApp. Se incrementa la versión menor a **2.40.0** por los nuevos permisos y control persistente; package.json, package-lock.json y el endpoint de salud comparten esa versión. No se declara una fase nueva ni se reabre una fase cerrada. Para desplegar estos cambios debe aplicarse la migración aditiva antes de iniciar el backend actualizado. Sigue vigente el límite de una instancia de backend documentado en ADR 014.

Preparación de producción: checkout limpio, respaldo PostgreSQL y conservación de las imágenes anteriores antes de actualizar. La migración solo agrega columnas, por lo que permite volver al código anterior conservando la base si falla la comprobación. La entrega externa de mensajes de WhatsApp queda pendiente de una prueba real autorizada.
