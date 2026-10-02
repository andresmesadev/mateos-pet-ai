# Perfiles y módulos por establecimiento — propuesta aprobada 2026-10-01

## 1. Definición funcional

El responsable del producto aprobó integrar los cuatro perfiles base y las siete combinaciones de Veterinaria, Peluquería y Pet shop. Caja es común para cobrar servicios y productos. Recepción necesita Agenda, clientes, mascotas y Caja. Los profesionales necesitan su módulo operativo. Una cuenta administradora conserva sus funciones profesionales; un veterinario o peluquero puede cobrar sin convertirse en administrador.

Reconciliación de alcance: se parametrizan módulos y permisos sobre Clientes, Mascotas, Agenda, Staff, Finanzas y Comunicación existentes. Pet shop habilita la venta por descripción/cantidad/precio ya existente; no se construye catálogo ni inventario. No se cambia el resolver de precios, las comisiones inmutables ni las reglas de cobro de ADR 007. No se crea una fase ni una organización superior al Tenant. La Capacidad del Staff sigue describiendo servicios prestables; los permisos de acceso son atributos de autorización diferentes.

## 2. Casos de uso y matriz aprobada

- Administrador: gestión completa dentro del establecimiento, módulos, equipo, precios, configuración y finanzas. Conserva lectura del historial aunque se desactive un módulo; ninguna nueva atención se registra en un módulo desactivado.
- Recepción y caja: Inicio operativo, Agenda, alta/edición de datos básicos de clientes y mascotas, llegada/reprogramación/cancelación, WhatsApp y cobros. Sin edición de historias, comisiones, egresos, informes generales, anulación de ventas ni cierre contable.
- Veterinario: Inicio clínico, agenda clínica y consultas, lectura de antecedentes, edición y cierre de sus atenciones y controles. WhatsApp. Sin finanzas administrativas ni mantenimiento del catálogo.
- Peluquero: Inicio operativo, agenda de peluquería, recepción, baño/corte, notas, listo/entregado e historial de peluquería. Solo avanza/edita sus servicios; puede tomar uno sin asignar. WhatsApp. Sin historia clínica ni finanzas administrativas.
- Habilitaciones adicionales cerradas, administradas por administrador: `cash` (cobrar, implícito para recepción), `appointment_price` (ajustar precio de cita abierta, sin cambiar precios del catálogo ni de futuras visitas). Los profesionales pueden recibirlas sin otra cuenta. No se admite un editor arbitrario de roles.
- Toda operación verifica Tenant, credencial vigente, rol actual, módulos y permiso en el servidor. Desactivar un módulo conserva historia y bloquea nuevas operaciones; no convierte una lista vacía en Veterinaria+Peluquería.
- Caja operativa: ventas/cobros pendientes y movimientos del día sin comisiones ni egresos. El cierre contable, las anulaciones y reportes generales siguen siendo administrativos. Cada cobro y ajuste nuevo guarda identidad/nombre/rol autenticados.
- Atención clínica queda reservada al administrador/veterinario; recepción y peluquería solo leen perfil operativo y alertas estructuradas necesarias para prestar su servicio. Los mensajes de WhatsApp compartidos mantienen el alcance aprobado anteriormente.

## 3. Arquitectura técnica

Política de acceso central en el backend produce permisos efectivos y navegación por rol+módulos. Gate de rutas del dashboard verifica operaciones antes de sus adaptadores existentes. Frontend consume el manifiesto de acceso vigente, usa la misma navegación en Inicio/sidebar y restringe Caja a sus pestañas autorizadas. Autenticación no concede permisos basándose en datos del navegador. Una actualización de permisos surte efecto en nuevas peticiones autenticadas sin confiar en el rol de un JWT antiguo.

La configuración usa `Tenant.activeModules` con vocabulario cerrado `veterinary`, `grooming`, `retail`; al menos uno seleccionado. Las siete combinaciones se prueban. Caja no depende de retail para cobros de citas. Las páginas clínicas/peluquería y sus formularios siguen existiendo; se adapta su exposición y propiedad de escritura en lugar de duplicarlas.

Interfaz: conservar tipografía, fondo claro y acento teal del dashboard aprobado. Equipo muestra funciones y dos habilitaciones con texto explicativo. Configuración muestra tres opciones entendibles y el aviso de conservación del historial. Inicio de trabajadores muestra tareas del día y acciones de su función; las métricas comerciales permanecen en Inicio administrativo.

## 4. Modelo de persistencia

Staff incorpora una lista de habilitaciones de acceso sin sustituir rol, credencial, capacidades de servicio o liquidaciones. Transaction conserva su modelo contable; añade snapshot de quien registra/liquida. Appointment añade snapshot de quien ajusta su precio, sin persistir un nuevo precio derivado. TransactionItem distingue producto/servicio para validar el módulo en nuevas ventas; las filas anteriores permanecen sin clasificar. Pet.operationalAlerts contiene alertas explícitamente compartidas de manejo, sin exponer ni reinterpretar las notas clínicas históricas. Los datos históricos sin autor no se atribuyen retroactivamente.

## 5. Esquema físico

Migración aditiva: Staff.accessPermissions (TEXT[] vacío), Transaction snapshots de actor de cobro, Appointment snapshots de actor de precio, TransactionItem.itemKind (legacy por defecto) y Pet.operationalAlerts (nullable). Sin eliminaciones, cambios de comisiones ni resembrado de negocios existentes. Ejecutar prisma generate después de migrar la base local.

## 6. Validación prevista

Pruebas de las siete combinaciones, cuatro perfiles y habilitaciones; rechazo de privilegios por body/JWT, revocación, rutas directas y cross-tenant; propiedad de atenciones; separación de Caja operativa y finanzas; privacidad de expedientes; permisos de precio y snapshots. Lint/build y recorrido real con cuentas sintéticas locales, retiradas al finalizar. Producción se publica únicamente después de la verificación y autorización de entrega correspondiente.

Validación local ejecutada y evidencia de cierre: [Informe de verificación](../history/TEAM_BUSINESS_ACCESS_VERIFICATION.md). Versión funcional: `2.41.0`; publicación pendiente.
