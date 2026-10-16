# Registro autónomo del primer administrador

16 de octubre de 2026. Corrección del onboarding existente solicitada por el responsable para recorrer el alta como un comprador nuevo. Diseño previo a implementación; no reabre una fase cerrada ni habilita la beta comercial.

## 1. Definición funcional

Crear un establecimiento y su primer acceso administrativo en un mismo registro. El formulario anterior creaba solamente Tenant, exigía un identificador técnico de Meta y terminaba sin credenciales utilizables. El negocio debe poder comenzar desde dashboard sin conectar un canal.

## 2. Casos de uso

Visitante: indica nombre del negocio y módulos, revisa un identificador autogenerado editable, escribe nombre/correo/contraseña del administrador y confirma el resumen. La operación crea un Tenant nuevo y un Staff con rol administrador y credencial propia. No reclama, reemplaza o modifica un establecimiento anterior, aunque su nombre comercial coincida. Un correo o identificador ocupado requiere iniciar sesión o elegir otro; nunca se reasigna.

Se usa el plan gratuito existente. La contratación posterior utiliza Facturación autenticada. No hay cobro en este formulario ni activación de plan pago sin confirmación del proveedor. No se promete verificación o recuperación por correo: no existe un proveedor de correo transaccional integrado en este recorrido.

## 3. Arquitectura técnica

El adaptador de onboarding valida datos y reutiliza el hash scrypt y la autenticación StaffCredential existentes. Crea Tenant + Staff + StaffCredential mediante escritura anidada atómica; el rol y Tenant no se aceptan del navegador. Aprovisionamiento de empleados conserva el aislamiento de fallos de 4.2. La respuesta pública enumera exclusivamente nombre, identificador y plan; no serializa el registro completo ni errores internos. Se mantienen límites públicos y se añade un límite más estricto para altas.

Next.js expone un adaptador público del mismo origen para estas dos operaciones, sin enviar secretos internos. La disponibilidad cancela solicitudes antiguas y solo acepta el resultado del identificador actual. Contraseña solo en memoria hasta enviar, sin URL, almacenamiento local ni respuesta. Tras registro, ingreso mediante NextAuth existente; si falla, se conserva el resultado de alta y se ofrece iniciar sesión sin repetir el registro.

Una sesión Staff con establecimiento explícito conserva ese establecimiento aun si existe SINGLE_TENANT_ID para el administrador de plataforma. Su pertenencia y versión siguen comprobándose en BD; el fallback de instalaciones antiguas sin establecimiento explícito se conserva. Un administrador comercial jamás recibe isSuperAdmin.

**Decisiones diferidas:** verificación/recuperación por email y contratación pública se evalúan separadamente. No añadir proveedor, Organización, rol nuevo, reglas contables ni cambios al motor conversacional. La apertura con datos reales conserva los requisitos operativos y documentales vigentes.

## 4. Persistencia

Se reutilizan Tenant, Staff y StaffCredential. Correo normalizado único y contraseña hasheada. El primer administrador no recibe capacidades de servicio ni comisiones automáticamente. Tenant.phone representa exclusivamente el identificador de canal y puede ser nulo hasta conectar WhatsApp; no se inventa un número. Los registros existentes permanecen intactos.

## 5. Esquema físico

Único cambio: Tenant.phone pasa de TEXT NOT NULL UNIQUE a TEXT NULL UNIQUE. Migración ALTER COLUMN DROP NOT NULL sin reescritura de datos. Múltiples establecimientos sin canal son válidos; los identificadores presentes siguen siendo únicos. Generar ambos clientes Prisma después del cambio.

## Dirección visual y comprobaciones

Continuidad de la landing: tinta #173b3d, verde #176c60, menta #e4f3ed, fondo #f5faf7, texto secundario #526b6b y blanco. Tipografía Geist existente. Cabecera de marca, explicación breve a la izquierda y formulario a la derecha; en móvil una columna centrada en la tarea. Los números expresan los tres pasos reales. Sin promesas de atención automática, precios inventados o métricas de marketing.

Verificar atomicidad, duplicados/concurrencia, hash y login reales, ausencia de secretos en respuestas, módulos, aislamiento aun con SINGLE_TENANT_ID, credenciales revocadas y cancelación de comprobaciones antiguas. Regresión backend, lint/build frontend y recorrido local desktop/móvil; producción y cuenta real se comprueban después de publicar. Evaluar versión antes del cierre oficial; sin tag o despliegue en esta corrección local.
