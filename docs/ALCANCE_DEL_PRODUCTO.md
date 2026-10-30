# Alcance de Huella Nex

**Definición documentada el 28/10/2026**, a partir de la aclaración de Andrés:
el software nació de las necesidades del centro propio y se proyecta como un
producto general para otros establecimientos de Colombia y, posteriormente,
otros países. Esta definición no declara disponibilidad comercial internacional
ni cambia el roadmap técnico aprobado.

## Qué es el producto y para quién

**Huella Nex es una plataforma de gestión operativa para veterinarias, pet shops
y peluquerías caninas y felinas.** Reúne la operación del establecimiento:
clientes y mascotas, agenda, servicios, atención, ventas, inventario, equipo,
caja, comisiones y reportes, con capacidades de comunicación y automatización
según los módulos y canales habilitados.

**Modelo comercial elegido por Andrés el 28/10/2026:** Huella Nex cobrará el
dashboard y la IA gestionada con un cupo definido. Cada establecimiento
conectará su propia cuenta/número de WhatsApp y pagará a Meta los cargos
aplicables. No se exigirá una cuenta propia de OpenAI al establecimiento en
este modelo. La conexión multilínea y los cupos mensuales están implementados
y probados localmente. El 29/10 Andrés aceptó como base inicial 100 créditos de
prueba una sola vez, 1.000 mensuales para Básico y 3.000 para Pro; Personalizado
se cotiza. La medición por duración, contextos ponderados y simulación de costos
ya se comprobaron localmente; [evidencia del medidor](research/AI_CREDIT_METERING_VALIDATION_20261029.md).
La habilitación externa depende de Meta y la oferta definitiva
todavía no está publicada.
[Decisión aceptada y trabajo pendiente, ADR 033](decisions/033-modelo-comercial-dashboard-ia-whatsapp.md).

**Presentación de planes, HN-05 (29/10):** las tarjetas describen capacidades
operativas reales según módulos y permisos, sin inventar cupos de citas/equipo,
sedes, API para terceros o servicio ilimitado. Básico y Pro comparten hoy el
alcance operativo; la diferencia de cupo de IA propuesta sigue condicionada a
su habilitación y oferta definitiva. [Alcance y validación](architecture/billing-plan-description-hn05-20261029.md).

El producto mantiene una base común de software. Cada establecimiento configura
los módulos que necesita y sus reglas operativas dentro de las posibilidades
soportadas. Una necesidad del centro propio puede mejorar la base común;
sus precios, porcentajes o decisiones particulares no se convierten por eso
en valores obligatorios para los demás negocios.

## Alcance por tipo de establecimiento

| Tipo de negocio | Operación que debe poder configurar |
| --- | --- |
| Veterinaria o centro veterinario | Clientes, mascotas, agenda y atención veterinaria, servicios, productos, inventario y cobros; peluquería y venta cuando formen parte de su operación. |
| Peluquería canina o felina | Clientes, mascotas, agenda de peluquería, profesionales, servicios, domicilio cuando lo ofrezca, precios, comisiones, inventario y caja. |
| Pet shop | Productos, inventario, ventas y caja; clientes y mascotas cuando corresponda. Una venta de mostrador puede realizarse sin cita y sin identificar un cliente. |
| Negocio mixto | Combinación de las capacidades habilitadas, conservando la atribución de cada servicio, producto y profesional. |

La tabla describe el alcance del producto y sus configuraciones; no obliga
a todos los establecimientos a usar todos los módulos. Tampoco declara
completos todos los recorridos de habilitación, certificaciones o controles
que aún tengan seguimiento abierto.

## Mateos Pet como primer establecimiento

**Mateos Pet es el primer establecimiento de validación y uso real de Huella
Nex.** Andrés y Lina lo utilizan con su actividad cotidiana desde el
19/10/2026. Sus necesidades originaron el producto y sus ajustes permiten
validar los flujos con clientes, atenciones y movimientos reales.

El establecimiento conserva su nombre, personal, clientes, mascotas, catálogo,
precios, horarios, bases de caja, contratos y porcentajes de comisión propios.
Esas configuraciones pertenecen a su `Tenant`. El porcentaje del 50 % que
pueda acordar con una profesional no es una regla universal de Huella Nex:
la participación depende de la configuración del contrato y del servicio.

Un establecimiento nuevo tiene su configuración y sus datos aislados. No
recibe los clientes, historias, operaciones, credenciales ni acuerdos del
centro Mateos Pet. `Tenant` sigue siendo la unidad de aislamiento del sistema;
esta definición no introduce una entidad de agrupación superior.

La personalización del centro se expresa mediante configuración y datos del
establecimiento. La base común permite atender otros negocios sin mantener
una copia de código diferente para cada uno. Cualquier adaptación adicional
se evalúa conforme al dominio y al proceso de diseño vigente.

**Separación reafirmada por Andrés el 28/10:** la marca, presentación y alcance
del software corresponden a Huella Nex. El nombre comercial, logo, contactos,
documentos de atención y comprobantes de cada establecimiento corresponden a
ese establecimiento. Que un comprobante de Mateos Pet lo identifique como
prestador del servicio es correcto; no convierte al centro en la identidad
del software. La administración y los respaldos de la plataforma corresponden
a su operación técnica y no deben exigir un computador personal de cada negocio.

La revisión inicial encontró dos mensajes de WhatsApp con el nombre fijo del
centro. HN-06 fue corregido y comprobado localmente el 29/10: recordatorios con
identidad por establecimiento y reactivación con cuerpo/variables configurados
por Tenant. La configuración aprobada de Meta y la publicación siguen pendientes;
no se habilitó el canal por esa corrección.
[Alcance y pruebas de identidad](architecture/whatsapp-business-identity-hn06-20261029.md).

**WhatsApp e IA — HN-04, 28/10:** la implementación local admite una conexión
cifrada y revocable por Tenant, verificación de sus activos con Meta y ruta
independiente para mensajes, plantillas, audio y equipo. El canal heredado de
entorno queda limitado a su establecimiento; otro negocio nunca lo hereda.
También se implementó consumo de IA con reserva atómica y cupo mensual por
Tenant. La validación usa PostgreSQL desechable y proveedores simulados.
La aprobación de Meta y la aceptación externa siguen pendientes; la capacidad
comercial permanece desactivada. El dashboard puede operar sin WhatsApp.
[Implementación, evidencias y condiciones de activación](architecture/commercial-providers-validation-hn04-20261028.md).

## Colombia y proyección internacional

**Colombia es el primer mercado de validación.** El funcionamiento actual
utiliza pesos colombianos y la zona horaria de Colombia. El modelo conceptual
reconoce la configuración regional, pero moneda, país y zona horaria por
establecimiento no están resueltos íntegramente en la implementación actual.

La intención de ofrecer Huella Nex en otros países queda registrada como
dirección del producto. Antes de afirmar soporte para un país se deben
verificar su moneda y formatos, zona horaria, idioma necesario, documentos y
requisitos locales de privacidad y facturación. El acceso mediante una página
web no certifica esas adaptaciones. No se incorpora su implementación ni una
fase nueva por esta aclaración.

Los comprobantes operativos del sistema conservan su alcance actual; esta
definición no los presenta como una solución de facturación electrónica
certificada para Colombia o para otros países.

## Funcionamiento en la nube y respaldos

La aplicación y su base de datos de producción funcionan en la VPS. El
computador de Andrés no es necesario para que el equipo use el dashboard.

La revisión inicial del 28/10 identificó dos tareas distintas:

- **VPS:** genera el respaldo cifrado de PostgreSQL cada 30 minutos. El timer
  está activo; la ejecución de las 14:00 Colombia terminó correctamente.
- **Computador de Andrés — tarea retirada posteriormente:**
  `MateosPetAI-OffsiteBackup` consultaba cada 15 minutos y descargaba el último
  conjunto cifrado a `backups/offsite/`. No actualizaba la aplicación ni
  sincronizaba una segunda base de datos en uso.

**Decisión final de Andrés, 28/10/2026:** retirar la tarea automática del
computador porque correspondía a una prueba. Se eliminó únicamente esa tarea
a las 14:31 Colombia, después de comprobar su identidad y guardar su
configuración en `.cache/offsite-task-retired-20261028.xml`, excluida de Git.
Se verificó que ya no está registrada y que se conservan las 112 carpetas de
respaldo previamente descargadas. No se borraron claves ni archivos de datos.

La generación de respaldos de la VPS sigue cada 30 minutos: timer activo y
ejecución de las 14:30 Colombia terminada correctamente, estado 0. La aplicación
y ese respaldo funcionan sin el computador de Andrés. No se conectó Google
Drive ni se configuró un destino externo nuevo.

Las copias locales conservadas son históricas y ya no reciben actualizaciones
automáticas. La recuperación ante pérdida completa de la VPS no tiene ahora
una copia externa que se actualice automáticamente; los ensayos anteriores no
certifican ese escenario bajo la configuración nueva. La clave privada de
recuperación permanece fuera de la VPS. Un destino externo futuro requerirá
una decisión independiente del operador.

## Referencias rectoras

- [Identidad del producto, del centro y de la iniciativa de desarrollo](IDENTIDAD_DEL_PRODUCTO.md).
- [Plan Maestro](PLAN_MAESTRO.md).
- [Modelo de dominio](architecture/domain-model-v1.md).
- [Respaldo y recuperación vigentes](operations/DATABASE_BACKUP_AND_RESTORE.md).
- [Revisión independiente del producto, hallazgos y límites del 28/10](audits/HUELLA_NEX_PRODUCT_REVIEW_20261028.md).
