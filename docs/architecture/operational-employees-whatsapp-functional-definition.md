# Empleados operativos por WhatsApp — Etapa 1: definición funcional

Fecha: **2026-10-15**, Colombia. **Estado: Etapa 1 aprobada explícitamente por el responsable.**

Aprobación recibida: «Aprobar Etapa 1 y pasar a casos de uso». Autoriza preparar la [Etapa 2](operational-employees-whatsapp-use-cases.md). No autoriza arquitectura, persistencia, esquema físico ni implementación sin sus aprobaciones posteriores.

El responsable pidió implementar el acceso a los nuevos asistentes desde WhatsApp. Esta solicitud autoriza iniciar el diseño de la ampliación. Las cinco etapas anteriores aprobaron una primera entrega por dashboard y excluyeron expresamente el canal interno de WhatsApp; no se interpreta esa aprobación como diseño aprobado de este canal. Se aplica la [regla de ejecución](../PHASE_2_EXECUTION_RULE.md): aprobar cada etapa antes de avanzar. No se implementan código, esquema, migraciones, activaciones ni envíos con este documento.

## 1. Problema y objetivo

El propietario y el personal autorizado necesitan consultar la operación y preparar gastos o entradas desde el teléfono, sin abrir el dashboard para cada tarea. Hoy WhatsApp atiende a clientes mediante el Recepcionista; Financiero y Administración/Inventario operan desde el dashboard.

La ampliación ofrece una puerta interna por WhatsApp a los mismos asistentes y casos existentes. Conserva los permisos del operador, el establecimiento, la propuesta revisable y la confirmación humana. El resultado debe ser recuperable desde ambos canales bajo la misma identidad; cambiar de canal no crea otra operación ni otra autoridad.

El beneficio esperado es reducir búsqueda y transcripción mientras el operador está atendiendo, comprando insumos o recibiendo mercancía. No se promete automatizar cualquier tarea manual ni gestionar dinero o stock sin revisión.

## 2. Base y límites comprobados

| Fuente actual | Evidencia y consecuencia para esta ampliación |
| --- | --- |
| [Plan Maestro](../PLAN_MAESTRO.md), principios y arquitectura conceptual | Los canales son reemplazables; la coordinación y las reglas viven en aplicación/dominio. WhatsApp no implementará otra contabilidad ni otro inventario. |
| [Cierre de Fase 1](../history/PHASE_1_COMPLETION_REPORT.md) | La soberanía del dominio habilita nuevos canales invocando los casos existentes, sin trasladar las reglas al bot. |
| [Modelo de dominio](domain-model-v1.md), Empleados Digitales y Comunicación | El agente trabaja para el negocio, tiene límites y auditoría; todo mensaje saliente pasa por Comunicación. Tenant continúa como única unidad de aislamiento. |
| [Casos aprobados de asistentes](digital-employees-use-cases.md) | Incluyen ocho casos F1–F3/A1–A5. Su primera entrega declara «No se añade canal WhatsApp interno ni ejecución programada». Este documento propone ampliar el canal, no agregar comandos de negocio. |
| `Staff.phone` / `StaffCredential` | Existe teléfono de contacto y credencial con estado/versión; el teléfono no tiene evidencia de verificación para iniciar sesiones. No se convierte un número de contacto en autorización automática. |
| `frontend/auth.ts` y lector de acceso de Inventario | Conviven cuentas de personal y acceso administrativo global. La primera posee `staffId`/versión de sesión; la segunda no se debe convertir en un Staff ficticio ni aceptarse por correo escrito en un chat. |
| `Conversation.userId` y `sendMessage` | Actualmente la conversación requiere un cliente `User`, y Enviar Mensaje exige `userId`. No se puede adjuntar una atención financiera privada al historial de un cliente ni crear un cliente ficticio para el operador. |
| Worker de entrada y Recepcionista | El worker envía al Recepcionista y prepara respuestas con `user.id`; no tiene todavía una salida interna de operador. Se requiere diseño explícito del enrutamiento y del contrato de respuesta. |
| Webhook | La ruta POST ya aplica verificación de firma antes del controlador. La vinculación no sustituirá esa autenticidad del proveedor ni admitirá una identidad elegida en el texto. |

La [prueba interna con IA real](../history/PRUEBA_INTERNA_EMPLEADOS_20261015.md) certifica el recorrido de aplicación de los asistentes, no su integración con WhatsApp ni la identidad del personal por ese canal.

## 3. Usuarios y acceso propuesto

| Actor | Acceso por este canal |
| --- | --- |
| Administrador/propietario verificado | Las consultas y operaciones que ya permite su cuenta, limitadas a un establecimiento concreto. |
| Personal con cuenta activa | Solo las tareas permitidas hoy por su perfil, permisos y módulos. Vincular WhatsApp no añade Finanzas ni gestión de inventario. |
| Cliente o número sin vinculación vigente | Atención de clientes existente. No obtiene datos internos por pedir hablar con el Financiero o declararse administrador. |

Cada persona inicia la vinculación desde su propia sesión autenticada del dashboard y debe demostrar control del número asociado. Un administrador puede gestionar la habilitación y revocarla; no puede convertir a otra persona en sí mismo mediante un nombre o número escrito.

Se propone incluir el acceso administrativo actual del propietario, además del personal. Su vínculo se crea desde la sesión real del dashboard con un Tenant elegido y conserva esa identidad administrativa dentro de ese alcance. No hereda una vista global de otros establecimientos. La autoridad y revocación de ese principal deben resolverse expresamente en los casos de uso y arquitectura; si no pueden comprobarse, el canal no concede acceso. No se inventará `staffId`, ni se aceptará `type: admin` procedente del mensaje.

Un mismo número no podrá representar ambiguamente dos operadores dentro del mismo establecimiento. Cualquier conflicto exige resolver la vinculación desde el dashboard. Si la misma persona trabaja con varios negocios, cada vínculo permanece aislado por Tenant y canal receptor; no se crea una Organización ni una cuenta de negocio superior.

## 4. Recorrido del operador

1. **Vincular:** desde su cuenta del dashboard, la persona solicita habilitar su WhatsApp para el establecimiento y completa una comprobación de control de ambos extremos. La vinculación tiene estado visible y puede revocarse. El protocolo exacto, plazos e intentos pertenecen a Etapa 2; no se envían contraseñas por WhatsApp.
2. **Entrar al modo negocio:** en el WhatsApp del establecimiento, una acción explícita abre la atención interna para el operador ya vinculado. El mensaje indica el establecimiento, la identidad y las tareas disponibles. La IA no decide quién es administrador ni qué negocio corresponde.
3. **Pedir una tarea:** el operador puede escribir, por ejemplo, «Consulta el cierre de ayer» o «Prepara un gasto de 25.000 pesos por insumos». La aplicación deriva a la especialización admitida. Si hay ambigüedad, solicita elegir tarea; no ejecuta varias operaciones por inferencia.
4. **Completar:** se solicitan los datos faltantes de esa atención. Un nombre de producto se busca en el catálogo autorizado y el operador selecciona un resultado concreto cuando haga falta. No se inventan IDs ni se incorporan instrucciones de nombres o reportes como órdenes.
5. **Revisar:** el chat muestra la propuesta concreta, incluidos importe, fecha, categoría/pago o producto, presentación, cantidad, costo y lote/vencimiento cuando corresponda. Si los datos no caben o no pueden mostrarse completos, se continúa con un enlace autenticado al dashboard; no se confirma una vista parcial.
6. **Confirmar o descartar:** el operador realiza una acción separada vinculada a la propuesta y revisión mostradas. Un «sí» suelto, un mensaje reenviado o una instrucción dentro del texto no bastan. Corregir cambia la revisión e invalida la confirmación anterior.
7. **Recuperar:** se presenta el recibo que realmente quedó guardado. Repetir el mensaje, pulsar dos veces o recuperar después de una desconexión no crea otro gasto ni otra entrada. Si el resultado es incierto se consulta antes de ofrecer otra ejecución.
8. **Salir:** la persona cierra el modo negocio o este caduca por inactividad. La salida no elimina los hechos ni la auditoría. Los plazos y la renovación se concretan antes de arquitectura.

Se conserva el WhatsApp ya conectado del establecimiento como primera opción; no se exige comprar otro número para este alcance. Solo se habilitará un negocio cuyo canal receptor pueda identificarse y responderse correctamente bajo el mismo Tenant. La auditoría de credenciales/canal existente será una precondición técnica; no se prometerá operación multiestablecimiento donde esa infraestructura no la soporte.

## 5. Trabajo incluido

| Empleado | Trabajo disponible por WhatsApp |
| --- | --- |
| Financiero | Consultar historial financiero, cierre existente y período oficial; preparar/corregir/descartar/confirmar gastos. Las consultas no crean cierres ni períodos. |
| Administración e Inventario | Buscar productos y alertas; consultar detalle, lotes, vencimientos y movimientos; preparar/corregir/descartar/confirmar entradas. |
| Atención interna | Vincular y revocar acceso, entrar/salir del modo negocio, aclarar destinatario/tarea y recuperar la propia atención. |

Los resultados extensos ofrecen resumen identificado como tal y continuación explícita o acceso autenticado al detalle. Una página no se presenta como inventario completo ni un tramo de datos como total global. Los límites actuales del dominio permanecen vigentes.

Las consultas y propuestas tienen dueño. Un administrador no adquiere por este canal el derecho a leer la atención privada de otro principal si el contrato actual no lo permite.

## 6. Reglas que no se negocian

- **Identidad verificada:** el nombre del perfil de WhatsApp, `Staff.phone`, un correo en el texto y una sesión del Portal del Cliente no habilitan operación interna.
- **Tenant del canal:** establecimiento y operador se resuelven de fuentes confiables y de su vínculo verificado. Nunca se obtienen de una instrucción del modelo o de un ID escrito por el remitente.
- **Permisos actuales:** se verifican al consultar, preparar, confirmar, recuperar y antes de entregar una respuesta privada encolada. Desactivar cuenta/credencial, cambiar permisos o revocar el vínculo impide continuar con la autoridad anterior.
- **Confirmación concreta:** el modelo interpreta/prepara; la aplicación exige una confirmación separada, del mismo operador, sobre contenido y revisión vigentes. La vigencia de 15 minutos de las propuestas listas conserva el contrato operativo ya aprobado.
- **Separación de conversaciones:** datos internos no se guardan en el historial/RAG de clientes ni aparecen en su bandeja por reutilizar un `userId`. Una persona que también sea cliente puede cambiar de modo explícitamente, con memorias y alcances separados.
- **Fallo de acceso:** un mensaje del modo negocio bloqueado, vencido o ambiguo no cae silenciosamente al motor de clientes. Se pide restablecer acceso o salir de ese modo, sin revelar datos privados.
- **Envío gobernado:** todas las respuestas pasan por Comunicación; no hay envíos directos al proveedor desde el agente. La pérdida o incertidumbre de un envío no reejecuta la operación de negocio.
- **Control humano:** el administrador puede revocar la vinculación desde el dashboard; la persona pierde acceso interno aunque conserve su número. Cambiar de número requiere verificar un vínculo nuevo.
- **Trazabilidad:** solicitud, revisión, confirmación, recibo, operador, Tenant y origen WhatsApp quedan relacionados. No se guardan contraseñas, secretos ni códigos de acceso en razonamientos del modelo o logs generales.

La vinculación implica que las respuestas autorizadas circulan por WhatsApp. La activación debe comunicarlo y permitir retirarla; las respuestas expondrán solo lo necesario para la tarea solicitada. No se añaden grupos, difusión ni acceso de terceros.

## 7. Ampliación conceptual aceptada en Etapa 1

La implementación actual de Comunicación modela conversaciones de clientes. Este requisito nuevo pide **atención interna de operadores**. La aprobación de Etapa 1 acepta las siguientes extensiones conceptuales; sus contratos detallados se proponen en Etapa 2:

- Equipo/identidad: vínculo verificado y revocable entre el operador existente y su dirección de canal, siempre dentro del Tenant.
- Comunicación: participantes y conversaciones internas autorizadas, separadas de las de clientes; destinatario interno verificable sin inventar un cliente `User`.
- Empleados Digitales: los casos operativos existentes pueden iniciarse por este canal manteniendo el mismo dueño, revisión, permiso y recibo.

No se crea otro dominio financiero, otro inventario ni otro empleado generalista. Tras la aprobación se registra esta ampliación en el [modelo conceptual](domain-model-v1.md), distinguiendo definición aceptada de capacidad todavía no implementada. La Etapa 2 propone sus contratos y reglas detallados; la Etapa 3 definirá su ubicación técnica. Si contradice un contrato congelado, se documentará la reconciliación correspondiente antes de implementar.

## 8. Fuera de esta primera entrega

Audio, imágenes, lectura de facturas, grupos, campañas/reactivación, mensajes proactivos nuevos, cierres financieros nuevos, ventas/cobros, consumos/ajustes/devoluciones y cambios clínicos. Los flujos de clientes, Recepcionista y Coordinador de Agenda conservan su responsabilidad y sus reglas.

No se compra un número, cambia el proveedor, abre la API a integradores, introduce una Organización ni reescribe el motor conversacional. Cualquier edición necesaria en archivos protegidos debe justificarse explícitamente durante arquitectura según el [ADR 010](../decisions/010-reconciliacion-motor-conversacional-memoria.md); esta aprobación funcional no da por autorizada una reescritura.

## 9. Criterios de aceptación funcional

1. El propietario y el personal habilitado pueden vincular, usar y revocar su número con una identidad comprobable.
2. Un cliente sin ese vínculo no obtiene datos internos aunque conozca nombres de empleados o IDs de recursos.
3. Las consultas disponibles coinciden con los permisos del dashboard y con los ocho casos operativos aprobados.
4. Un gasto o entrada requiere datos completos, revisión mostrada y confirmación explícita; el modelo no puede sustituir esa acción.
5. Duplicados, reintentos, concurrencia y desconexión recuperan una sola operación mediante el mismo recibo.
6. Un cambio de rol, revocación o sesión vencida bloquea también una entrega privada pendiente; no solo el siguiente comando.
7. Mensajes internos e historial de clientes permanecen separados aun si una persona usa ambos modos.
8. Un error interno o un número ambiguo no se transforma en acceso administrativo ni inicia una reserva de cliente por accidente.
9. Se prueban el recorrido completo y las regresiones de clientes, primero con datos sintéticos y después con un envío controlado autorizado al número de prueba del operador.

## 10. Próximo paso tras aprobar

Preparar **Etapa 2: casos de uso** con actores, verificación/vinculación, modo negocio, revocación, consultas, selección de producto, propuestas, confirmación, recuperación, respuestas tardías y convivencia con clientes. Debe cerrar los plazos y la autoridad del administrador actual antes de avanzar a arquitectura. Después se someten a aprobación arquitectura, persistencia y esquema físico, en ese orden.
