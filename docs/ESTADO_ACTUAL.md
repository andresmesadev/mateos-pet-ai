# Estado actual del proyecto

**23 de octubre — 2.55.2 publicada:** Inicio muestra hasta diez citas por
página con navegación; las canceladas se ocultan de Inicio y de las vistas
del calendario, conservando historial. Cinco jobs CI, 217 suites/1.822 tests
backend y 170 auxiliares aprobados. Salud HTTPS correcta, respaldo cifrado y
65 migraciones conservadas. Nueva observación desde las 14:04 Colombia;
la anterior se conserva con 21 muestras y cero fallos, sin certificar 48 horas.
La comprobación visual sigue pendiente porque Work desactiva el control del
navegador. [Certificación](history/RELEASE_2_55_2_VPS_20261023.md).

**23 de octubre — mantenimiento de VPS completado:** misma instancia en
Ubuntu 24.04.5 LTS y Docker 29.9.2, paquetes al día y firewall persistente
verificado. Dashboard disponible desde las 12:16 Colombia; aplicación
2.55.1 y 65 migraciones conservadas. Caja/reportes/comisiones leídos sin
registrar operaciones. Respaldos completos Oracle y lógico cifrado verificados;
consola temporal retirada. [Resultados y límites](operations/VPS_OS_MAINTENANCE_RESULT_20261023.md).
La nueva observación empezó a las 12:17; no certifica aún 48 horas y conserva
los fallos anteriores. El pendiente de host del corte del 22/10 queda resuelto;
restauración actual, capacidad y aceptación puntual siguen abiertas.

## Corte histórico del 22 de octubre

**Beta revisada el 22 de octubre:** [tabla vigente de los diez ítems](operations/CLOSED_BETA_STATUS_20261022.md).
**Operación real desde el lunes 19/10**, confirmada por el responsable: clientes,
citas de peluquería/veterinaria, venta de medicamentos y pagos; buen funcionamiento
reportado. Mejoras 2.53.0–2.55.1 publicadas; responsables, soporte e ingresos de
la jornada revisada confirmados. Siguen pendientes comprobaciones puntuales de
stock/base/reportes, medición de carga, recuperación actual, decisiones documentales
y estabilidad técnica. El [monitoreo está activo](operations/REAL_OPERATION_STABILITY_REVIEW_20261022.md):
las ventanas cambiaron con los despliegues; el avance operativo no vuelve a cero.
La actualización mayor de Ubuntu se aplazó al 23/10, con acceso a recuperación
y respaldo del volumen antes de intervenir; no se inició ni se reinició la VPS.

**Publicado el 22 de octubre — 2.55.1 (seguridad):** Node 24.22.1 / OpenSSL
3.5.9 en ambos contenedores, ip-address 10.7.4 y puertos internos únicamente
en localhost. SSH/TLS/permisos endurecidos y nueve actualizaciones estándar del
host aplicadas con respaldo. 217 suites / 1822 tests, 166 auxiliares y cinco
jobs CI aprobados; 14 pantallas HTTPS correctas, PostgreSQL/inventario/cierre
histórico conservados. [Certificación](history/RELEASE_2_55_1_SECURITY_20261022.md).
**Pendiente importante:** Ubuntu 20.04 sin Pro/ESM informa 174 parches de
seguridad pendientes. Docker también está limitado por el repositorio Focal.
La actualización parcial no certifica saneamiento completo del servidor;
[plan de resolución](operations/VPS_OS_MAINTENANCE_PLAN_20261022.md).
WhatsApp sigue pausado; observación vigente 2.55.1, sin certificar aún 48 horas.

**Publicado el 22 de octubre — 2.55.0:** base de caja confirmada, efectivo
dejado al cierre y sugerencia para la siguiente apertura; reportes/Excel/
impresión con participación profesional histórica. Guardado de precio y
domicilio de peluquería sincronizado con la ficha de cada mascota; servicios
de Otros agendables mediante capacidad veterinaria. Next.js 16.4.2 corrige la
auditoría bloqueante aparecida durante CI. Cinco jobs aprobados, respaldo
cifrado verificado, 65 migraciones y 14 pantallas HTTPS correctas. Inventario
y cierre histórico conservados; WhatsApp pausado. [Registro de publicación](history/RELEASE_2_55_0_VPS_20261022.md).
La ventana anterior 2.54.0 tuvo ocho muestras fallidas y se conserva como
incidente. La nueva observación 2.55.0 no certifica todavía 48 horas ni cierra
la aceptación operativa de beta. Las validaciones locales inferiores conservan
su fecha; los tres ajustes descritos ya están publicados.

**Mejora local del 22 de octubre — base de caja y reportes:** Caja permite
confirmar el efectivo inicial, registrar cuánto se deja al cerrar y sugerirlo
en la siguiente apertura. La base permanece separada de ingresos y resultados.
Reportes, Excel e impresión muestran participación profesional y saldo tras
reservarla, usando comisiones históricas. 217 suites / 1822 tests backend,
13 comprobaciones nuevas Chrome/PostgreSQL y 63 de regresión, 10 pruebas de
reportes/Excel, lint/build aprobados. Migración aditiva 65 verificada únicamente
en PostgreSQL desechable. [Alcance y evidencia](history/CASH_OPENING_PROFESSIONAL_REPORTS_VERIFICATION_20261022.md).
Publicado posteriormente en 2.55.0 con migración aditiva 65; sin rellenar
importes desconocidos de cierres anteriores.

**Corrección local del 22 de octubre — Otros agendables:** Vacunación y los
servicios activos de Otros con «Requiere cita» ya aparecen y pueden reservarse
mediante la agenda veterinaria, conservando categoría comercial, permisos y
check de reparto. 216 suites / 1804 tests backend y 18 comprobaciones
Chrome/PostgreSQL (incluida la sincronización previa de expediente), lint/build
aprobados. [Causa y evidencia](history/BOOKABLE_OTHER_SERVICES_VERIFICATION_20261022.md).
Este ajuste y el guardado conjunto de peluquería fueron publicados en 2.55.0.

**Corrección local del 21 de octubre — guardado conjunto:** modificar y guardar
precio/domicilio de una cita abierta de peluquería actualiza también el
expediente de su mascota. Aplica a todas las mascotas del Tenant, conserva
cobros históricos y no crea overrides ocultos al guardar habituales.
216 suites / 1800 tests backend, 14 comprobaciones Chrome/PostgreSQL del código
final, lint y build aprobados. [Alcance y evidencia](history/GROOMING_APPOINTMENT_PET_SYNC_VERIFICATION_20261021.md).
Publicado posteriormente en 2.55.0; conserva atenciones/cobros históricos.

**Publicado el 21 de octubre — 2.54.0:** bloqueo diario de citas repetidas
por mascota y servicio, retiro por error desde Agenda con motivo/auditoría y
preservación de hechos clínicos/financieros. [Diseño](architecture/appointment-duplicates-and-removal-20261021.md)
y [validación/publicación](history/RELEASE_2_54_0_VPS_20261021.md).
Cinco jobs CI aprobados, respaldo cifrado verificado, 64 migraciones y 14
destinos HTTPS autenticados correctos. Retiro individual autorizado simulado
y aplicado con auditoría, conservando la atención correcta y sus hechos
financieros. WhatsApp pausado; nueva ventana de observación 2.54.0 iniciada,
sin declarar cumplidas 48 horas ni cerrar la aceptación operativa de beta.

**Publicado el 20 de octubre — 2.53.0:** existencias iniciales,
corrección de cantidad/costo de entradas y retiro de productos erróneos con
auditoría; mejoras adaptables de Agenda, cabecera y cierre diario. Validación
local completa; cinco jobs CI aprobados, respaldo cifrado verificado, 63
migraciones y 14 destinos HTTPS autenticados correctos. Stock y jornada cerrada
conservados; WhatsApp pausado. CI y despliegue se registran en la
[evidencia de publicación](history/RELEASE_2_53_0_VPS_20261020.md).
La [revisión actual de beta](operations/CLOSED_BETA_STATUS_20261022.md) conserva
pendientes comprobaciones puntuales de inventario/base/reportes; la operación real del paso 10 y los
ingresos de la primera jornada ya fueron confirmados. Los estados de jornada
abierta de las publicaciones inferiores son capturas históricas: la revisión
del 20 de octubre confirmó el cierre oficial del 19.

**Publicado el 19 de octubre — 2.52.0:** comisión por cada línea de servicio pagada, conservando área, check de reparto y profesional en cobros mixtos. Consulta directa y uñas repartidas pueden coexistir; productos, domicilio y servicios directos no generan parte adicional. 214 suites / 1.766 pruebas backend, 16 integraciones PostgreSQL, 166 helpers y 51 comprobaciones Chrome correctas; lint/build y cinco jobs CI aprobados. Respaldo verificado, 62 migraciones, salud HTTPS y WhatsApp en pausa. Corrección legítima autorizada de Dayra: dos comisiones faltantes de 14000 y 4000, comprobantes intactos; Caja confirma 117000 por seis servicios y saldo 377000, día abierto. [Evidencia de publicación y auditoría](history/RELEASE_2_52_0_VPS_20261019.md).

**Publicado el 19 de octubre — 2.51.0:** Tipo de contrato por integrante (Fijo o Prestación de servicios con porcentaje propio) y reparto opcional por servicio. Los datos antiguos conservan su regla hasta configurarlos; comisiones y cierres históricos inmutables. 213 suites / 1.747 pruebas backend, 16 integraciones PostgreSQL y 46 comprobaciones Chrome; lint, build y cinco jobs CI correctos tras corregir un consumidor de disponibilidad que omitía tenantId. Respaldo verificado, 61 migraciones, salud HTTPS correcta y WhatsApp en pausa. Ningún contrato real asignado automáticamente. [Evidencia y límites](history/RELEASE_2_51_0_VPS_20261019.md).

Fecha de corte documental original: **8 de octubre de 2026**. Actualización del **19 de octubre**: mejoras operativas publicadas en **2.50.0**, etiquetas de agenda en **2.50.1**, Caja compacta en **2.50.2**, modalidad de llegada en **2.50.3** y cierre oficial desde Caja con reserva de comisiones en **2.50.4**; WhatsApp conserva su pausa explícita y el canal privado sigue deshabilitado. [Certificación productiva vigente](history/RELEASE_2_50_4_VPS_20261019.md). Las publicaciones históricas conservan su fecha y evidencia. Este documento orienta la lectura; no sustituye el Plan Maestro, el modelo de dominio ni los ADR.

## Publicación y trabajo local

**Publicado el 19 de octubre — 2.50.4:** Cerrar día desde Caja guarda el snapshot oficial y recupera respuestas inciertas; muestra automáticamente la reserva del profesional y el saldo posterior, con consulta de comisiones por período. La reserva no registra pago real ni concilia gastos manuales con comisiones pagadas. Inventario/POS explica y facilita habilitar Venta con precio, conservando usos clínicos; Peluquería aclara servicio terminado, entrega y pago independientes. 211 suites/1.721 pruebas backend, 43 comprobaciones Chrome/PostgreSQL y CI aprobados, lint/build correctos. Respaldo verificado; PostgreSQL y 60 migraciones conservados. Lectura clínica: ingresos 494000, reserva 99000, saldo 395000; jornada real abierta. [Evidencia y límites](history/RELEASE_2_50_4_VPS_20261019.md).

**Publicado el 19 de octubre — 2.50.3:** selector de llegada habitual en Datos y cuidados → Peluquería y domicilio de cada mascota; conserva citas y pagos existentes. 210 suites/1.719 pruebas backend, 40 comprobaciones Chrome/PostgreSQL, lint/build y cinco jobs CI aprobados. Respaldo verificado, migración aditiva aplicada (60 totales), PostgreSQL conservado y lectura autenticada de la ficha correcta. Captura: 257 propietarios, 305 mascotas, 5 citas. HTTPS final correcto tras un 503 intermedio no reproducido; [evidencia y límites](history/RELEASE_2_50_3_VPS_20261019.md).

**Publicado el 19 de octubre — 2.50.2:** catálogos cerrados hasta buscar o abrirlos explícitamente; domicilio opcional sin línea automática de $0. Servicio principal conservado, comprobantes previos y recuperación de pagos inciertos intactos. Backend: 210 suites/1.708 pruebas; 164 comprobaciones auxiliares; 39 comprobaciones Chrome/PostgreSQL; lint/build y CI aprobados. Respaldo cifrado verificado, mismo PostgreSQL y 59 migraciones; HTTPS administrativo correcto y datos de beta conservados: 257 propietarios, 305 mascotas y 5 citas. [Certificación](history/RELEASE_2_50_2_VPS_20261019.md).

**Publicado el 19 de octubre — 2.50.1:** estados de Agenda de hoy centrados verticalmente y en una columna uniforme aunque aparezca Definir precio; temporales `.tmp/` conservados e ignorados por Git. Lint/build correctos, 38 comprobaciones Chrome/PostgreSQL y CI completo aprobados. Respaldo cifrado verificado, mismo contenedor PostgreSQL, 59 migraciones y conteos productivos conservados: 256 propietarios, 304 mascotas y 4 citas. [Certificación](history/RELEASE_2_50_1_VPS_20261019.md). La base ya fue importada por el responsable después de 2.50.0; las referencias inferiores a una base vacía describen capturas anteriores.

**Publicado el 19 de octubre — 2.50.0:** lote funcional `a8e6918`, CI completo aprobado, respaldo cifrado comprobado y seis migraciones aplicadas (59 totales). HTTPS administrativo, 12 pantallas y 11 consultas de API correctos; conteos operativos conservados y PostgreSQL sin reemplazo. Monitor `5c71e20` aprobado en CI reconoce la pausa explícita sin inventar procesamiento de mensajes. La VPS todavía no tiene clientes, mascotas ni servicios cargados; importar el CSV y configurar el establecimiento desde su cuenta son pasos posteriores a la publicación, sin copiar la base local. Las entradas locales siguientes son capturas históricas del desarrollo del lote ya publicado, no pendientes de otro despliegue.

**Continuación local del 19 de octubre — jornada manual y pausa de WhatsApp:** WhatsApp local deshabilitado mediante flag reversible; webhook 503 y salud 200 con worker pausado. Agenda manual muestra todos los turnos libres según área/habitual y permite horas pasadas de hoy como llegada, manteniendo ocupación/cierres y política autónoma separada. [ADR 027](decisions/027-agenda-manual-sin-anticipacion-ni-secuencia.md), [diseño](architecture/manual-agenda-and-whatsapp-pause-20261019.md) y [evidencia](history/MANUAL_AGENDA_WHATSAPP_PAUSE_VERIFICATION_20261019.md): 209 suites/1.703 pruebas, 37 comprobaciones Chrome/PostgreSQL y lint/build/diff correctos. Sin migración, citas reales creadas para probar ni publicación.

**Continuación local del 19 de octubre — orden del menú:** Clientes y mascotas pasa inmediatamente debajo de Agenda en la lista compartida de navegación del dashboard; enlaces, alias y permisos conservados. Cambio exclusivamente de presentación, sin dominio ni persistencia nuevos. ESLint del sidebar exit_code 0; tres pruebas existentes de navegación aprobadas; diff correcto. Sin publicación.

**Continuación local del 19 de octubre — contacto importado y propietario:** correo retirado de las vistas de contacto, teléfonos adicionales visibles individualmente y botones de mascota uniformes. Reparación local con respaldo: 26 propietarios recuperan teléfonos y 256 fichas limpian metadatos de notas, conservando observaciones; 4.927 visitas, 308 mascotas y 9 citas intactas. [Diseño](architecture/owner-contact-import-cleanup-20261019.md) y [evidencia](history/OWNER_CONTACT_IMPORT_CLEANUP_VERIFICATION_20261019.md): 208 suites/1.695 pruebas, ensayos Chrome/PostgreSQL de 15 y 36 comprobaciones, lint/build/diff correctos. Sin migración ni publicación.

**Continuación local del 19 de octubre — retirar Nueva zona:** bloque Domicilios de peluquería retirado del catálogo de configuración, junto con su editor y estado exclusivo. Valores de mascota/cita y datos históricos conservados. [Alcance y evidencia](architecture/remove-transport-zone-settings-20261019.md): lint/build/diff correctos y 35 comprobaciones Chrome/PostgreSQL aprobadas. Sin migración ni publicación.

**Continuación local del 19 de octubre — peluquería cada 20 minutos:** cadencia de recepción compartida por disponibilidad, reserva atómica, reprogramación y asignación del peluquero; duración de catálogo y veterinaria conservadas. [ADR 026](decisions/026-recepcion-peluqueria-cada-20-minutos.md), [diseño](architecture/grooming-twenty-minute-slots-20261019.md) y [evidencia](history/GROOMING_TWENTY_MINUTE_SLOTS_VERIFICATION_20261019.md): 206 suites/1.688 pruebas, 35 comprobaciones Chrome/PostgreSQL, lint y diff correctos. Sin migración, datos reales modificados ni publicación.

**Continuación local del 17 de octubre — retirar Tarifas acordadas:** pestaña, panel y consulta exclusivos retirados de la ficha de mascota; las secciones restantes se redistribuyen y Peluquería y domicilio permanece en Datos y cuidados. [Alcance y verificación](architecture/pet-profile-remove-agreed-prices-tab-20261017.md): lint/build/diff correctos y 34 comprobaciones Chrome/PostgreSQL aprobadas. Sin borrar tarifas guardadas, cambiar backend ni publicar.

**Continuación local del 17 de octubre — formulario de mascota:** identificación, peluquería/domicilio y datos clínicos organizados con controles de 44 px, notas a todo el ancho y adaptación móvil. Corregido el borrado explícito de notas que antes conservaba el texto anterior. [Diseño](architecture/pet-profile-visual-20261017.md) y [evidencia](history/PET_PROFILE_VISUAL_VERIFICATION_20261017.md): 206 suites/1.682 pruebas, 34 comprobaciones Chrome/PostgreSQL, lint/build/diff correctos. Sin nueva migración, fichas reales editadas ni publicación.

**Continuación local del 17 de octubre — barrio del propietario y formulario:** contacto/ubicación/notas organizados visualmente; Barrio opcional guardado en el cliente, visible desde mascota y propuesto en traslados nuevos sin cambiar snapshots anteriores. [Diseño](architecture/client-neighborhood-form-20261017.md) y [evidencia](history/CLIENT_NEIGHBORHOOD_FORM_VERIFICATION_20261017.md): 205 suites/1.679 pruebas; ensayos Chrome/PostgreSQL de 15 y 33 comprobaciones aprobadas; lint/build/diff correctos. Migración aditiva local aplicada y Prisma regenerado: 59 migraciones desde cero, seis del lote pendientes de publicación. Sin fichas reales editadas ni VPS modificada.

**Continuación local del 17 de octubre — domicilio simplificado y barrio:** formulario sin zona, observaciones ni casilla; Valor del domicilio aplicado al guardar y Barrio persistido por cita. Referencia inicial, edición manual, cero gratuito y vacío pendiente conservados. [Diseño](architecture/grooming-transport-simple-address-20261017.md) y [evidencia](history/GROOMING_TRANSPORT_SIMPLE_ADDRESS_VERIFICATION_20261017.md): 204 suites/1.673 pruebas, 33 comprobaciones Chrome/PostgreSQL, lint/build y diff correctos. Migración aditiva local aplicada y Prisma regenerado; 58 migraciones verificadas desde cero y cinco del lote pendientes de publicación. Sin datos reales editados ni VPS modificada.

**Continuación local del 17 de octubre — alta con precios por mascota:** Nuevo propietario + mascota(s) muestra todo el contacto opcional en Contacto del propietario y permite definir servicio/domicilio por mascota en la misma creación atómica. Conserva cero/pendiente, permisos y Tenant. [Diseño](architecture/new-owner-pet-grooming-prices-20261017.md) y [evidencia](history/NEW_OWNER_PET_GROOMING_PRICES_VERIFICATION_20261017.md): 204 suites/1.669 pruebas, 11 comprobaciones Chrome/PostgreSQL, lint/build y diff correctos. Sin migración ni publicación.

**Continuación local del 17 de octubre — peluquería visible en ficha:** Peluquería y domicilio pasa a Datos y cuidados, antes de Datos clínicos, con los importes y guardado existentes; conserva borrador al alternar edición. [Diseño](architecture/pet-grooming-above-clinical-20261017.md) y [evidencia](history/PET_GROOMING_ABOVE_CLINICAL_VERIFICATION_20261017.md): 31 comprobaciones Chrome/PostgreSQL, lint/build y diff correctos. Sin cambio backend, migración ni publicación.

**Continuación local del 17 de octubre — contacto principal visible:** ficha del propietario con «Citas de sus mascotas» y campos de contacto/notas autorizadas visibles al editar, manteniendo opcionales y permisos. [Diseño](architecture/client-contact-visible-fields-20261017.md) y [evidencia](history/CLIENT_CONTACT_VISIBLE_FIELDS_VERIFICATION_20261017.md): 12 comprobaciones autenticadas Chrome/PostgreSQL, lint/build y diff correctos. Sin cambio backend, migración ni publicación.

**Continuación local del 17 de octubre — nombres de mascotas en Clientes:** tabla y tarjetas muestran todos los nombres de mascotas junto al propietario/teléfono; Citas y Última actividad se retiran de esta vista. Conserva acciones, paginación y separación por establecimiento. [Diseño](architecture/client-list-pet-names-20261017.md) y [evidencia](history/CLIENT_LIST_PET_NAMES_VERIFICATION_20261017.md): 203 suites/1.659 pruebas, 11 comprobaciones Chrome/PostgreSQL, lint/build correctos. Sin migraciones, cambios de datos reales ni publicación.

**Continuación local del 17 de octubre — búsqueda por propietario o mascota:** Nueva cita busca por propietario, teléfono y nombre de mascota; muestra su asociación y permite seleccionar directamente la mascota. Encuentra mascotas antiguas y distingue nombres repetidos sin cruzar establecimientos. [Diseño](architecture/appointment-owner-pet-search-20261017.md) y [evidencia](history/APPOINTMENT_OWNER_PET_SEARCH_VERIFICATION_20261017.md): 203 suites/1.659 pruebas, 30 comprobaciones Chrome/PostgreSQL, lint/build correctos. Sin migraciones, cambios de datos reales ni publicación.

**Continuación local del 17 de octubre — peluquero único automático:** reservar, registrar llegada/inicio o cerrar grooming sin responsable asigna al único candidato disponible; con varios solicita elección y continúa la acción. Conserva Tenant, capacidades, horarios, ausencias, cruces y comisión del responsable. [Diseño](architecture/unique-groomer-assignment-20261017.md) y [evidencia](history/UNIQUE_GROOMER_ASSIGNMENT_VERIFICATION_20261017.md): 202 suites/1.654 pruebas, 29 comprobaciones Chrome/PostgreSQL, lint/build correctos. Sin migración, cambio de datos reales ni publicación.

**Continuación local del 17 de octubre — carrito único y comisión final:** las dos respuestas del responsable quedaron implementadas en [ADR 025](decisions/025-carrito-unico-de-cita-y-comision-final.md). Registrar pago abre servicio/domicilio editables y admite adicionales con un solo pago. Stock, obligación y corrección de comisión por anulación/reemplazo son atómicos; cierres/liquidaciones conservan sus límites. [Evidencia](history/APPOINTMENT_MIXED_CHECKOUT_VERIFICATION_20261017.md): 201 suites/1.645 tests, 24 pruebas POS y 25 comprobaciones Chrome/PostgreSQL, lint/build correctos. 57 migraciones verificadas desde cero; cuatro del lote pendientes de publicación. Sin pagos reales, cambios de clientes del ensayo ni VPS. Sustituye los pendientes funcionales del registro parcial siguiente.

**Continuación local del 17 de octubre — Agenda con espacio propio y Todos:** Agenda de hoy ocupa una fila completa; prioridades debajo. POS permite ver productos y servicios juntos, con sus permisos y catálogos existentes. [Diseño](architecture/home-agenda-and-checkout-20261017.md) y [verificación parcial](history/HOME_AGENDA_CATALOG_PARTIAL_VERIFICATION_20261017.md): 25 pruebas de funciones, cuatro perfiles en navegador, 21 comprobaciones Chrome/PostgreSQL, lint/build correctos. El carrito único de cita con extras sigue pendiente de las respuestas sobre edición de precios y efecto en comisión; Finanzas conserva el ADR 024. Sin publicación ni cambios de datos reales.

**Continuación local del 17 de octubre — pago pendiente hasta confirmar en Caja:** decisión funcional resuelta e implementada mediante [ADR 024](decisions/024-cita-pendiente-hasta-confirmacion-de-pago.md). Finalizar conserva una obligación única sin sumar ingresos; el icono de Caja abre el pago de esa cita. Confirmar registra fecha real, método y operador, sin duplicación concurrente ni cambios en comisiones o cobros históricos. [Evidencia final local](history/APPOINTMENT_PENDING_PAYMENT_VERIFICATION_20261017.md): 200 suites/1.636 pruebas, 12 comprobaciones PostgreSQL, 19 de navegador, lint/build y diff correctos. Las 56 migraciones se aplicaron desde cero en una base temporal; tres migraciones del lote siguen pendientes de publicación. Datos reales del ensayo y VPS conservados; producción continúa en 2.49.0. Aviso preexistente del reactor de automatizaciones documentado, sin certificar ese recorrido.

**Ensayo local previo del 17 de octubre — dirección, agenda y POS:** dirección y barrio del cliente visibles desde Mascota y propuestos en la cita; acciones rápidas en Agenda de hoy; servicio/domicilio/total separados; buscador POS desplazable. [Diseño](architecture/appointment-cash-usability.md) y [verificación parcial histórica](history/APPOINTMENT_CASH_USABILITY_PARTIAL_VERIFICATION_20261017.md): 199 suites/1.628 pruebas, 17 comprobaciones Chrome/PostgreSQL, lint/build correctos. La decisión financiera que entonces estaba pendiente quedó resuelta en la continuación anterior. Durante estas comprobaciones no se alteraron los datos reales del ensayo local ni la VPS.

**Simplificación local posterior, 17 de octubre:** Nueva cita deja de exigir logística. En la pestaña existente de Mascota se editan valor del servicio y recargo del domicilio; se conservan los acuerdos importados. La ficha completa oculta alertas vacías y su editor deja de ocupar el encabezado. [Diseño del ajuste](architecture/grooming-transport-simplification.md) y [evidencia actualizada](history/GROOMING_TRANSPORT_VERIFICATION_20261017.md): 199 suites/1.627 pruebas, 10 comprobaciones financieras PostgreSQL, 15 de navegador, lint/build correctos. Dos migraciones locales de transporte pendientes de publicación; ningún cliente real importado.

**Trabajo local del 17 de octubre — peluquería, domicilio e importación:** zonas y modalidades de traslado, precio individual en centro y total con domicilio, confirmación por atención y cobro compartido explícito. La comisión recibe solo peluquería y Finanzas el total, dentro de la transacción de cierre. Complementos sin reserva admiten duración y precio pendientes. CSV con especies y ambas tarifas validado: 291 registros de contacto, nombres y grupos conservados, sin carga real. [Diseño](architecture/grooming-transport-implementation.md), [ADR 023](decisions/023-precio-peluqueria-transporte.md) y [evidencia del lote](history/GROOMING_TRANSPORT_VERIFICATION_20261017.md): 198 suites/1.616 tests, 8 pruebas del lector, 9 comprobaciones PostgreSQL, 13 comprobaciones de navegador, lint y build correctos. Pendiente de commit, push y despliegue; producción continúa en 2.49.0 y WhatsApp conserva su pausa.

**Trabajo local del 16 de octubre — importación con especie:** corrección del CSV y del endpoint de importación para conservar Perro/Gato por mascota, revisar la especie antes de confirmar y rechazar especies ausentes antes de escribir datos. [Contrato](architecture/contact-import-species.md) y [verificación local](history/CONTACT_IMPORT_SPECIES_VERIFICATION_20261016.md): 197 suites/1.599 tests de backend, 7 pruebas del lector, lint y build correctos. Copia de datos revisada preparada con especies; no importada. Pendiente del commit y despliegue del lote de mejoras, no publicada en 2.49.0.

**Publicado el 16 de octubre — 2.49.0:** [registro autónomo del administrador](architecture/self-service-administrator-registration.md), con negocio, credencial individual e ingreso al dashboard sin exigir WhatsApp. El alta crea un establecimiento nuevo; no reemplaza automáticamente el Tenant o administrador conservados. CI aprobado, respaldo verificado, 53 migraciones y HTTPS autenticado correctos. [Evidencia productiva](history/RELEASE_2_49_0_VPS_20261016.md). Nueva observación desde las 12:35:56 Colombia; fin previsto el 18 de octubre a esa hora si cumple continuidad. La cuenta real y apertura de la beta siguen pendientes.

**Estado operativo posterior, 16 de octubre, 10:24 Colombia:** [arranque limpio aplicado](operations/DASHBOARD_ONLY_CLEAN_START_20261016.md). Dashboard conectado a una base nueva sin clientes, mascotas, citas o historial de pruebas; negocio y administrador conservados. Servicios/personal pendientes de revisión, sin cuentas de ejemplo. WhatsApp bloqueado y empleados del canal pausados. Nueva observación desde las 10:25; sustituye como captura vigente a la de las 09:51, conservada incompleta.

**Preparación operativa del 16 de octubre:** Financiero y Administración/Inventario registrados en el establecimiento; nueva observación de 48 h iniciada en la VPS a las 09:51 Colombia, sin reiniciar la aplicación. [Aplicación y límites](operations/OWN_CLINIC_BETA_APPLICATION_20261016.md). Acta, datos de apertura y revisión de privacidad real siguen pendientes; no se declara apertura de la beta.

| Ámbito | Estado respaldado por evidencia |
| --- | --- |
| Versión declarada y productiva del backend | `2.50.4`, en `backend/package.json`, lockfile y salud de la VPS. [Publicación y evidencia](history/RELEASE_2_50_4_VPS_20261019.md). |
| Asistentes operativos | Financiero y Administración/Inventario publicados en el dashboard, con confirmación humana y recuperación por recibo. [Validación local](history/ENTREGABLE_EMPLEADOS_OPERATIVOS_COMPLETION_REPORT.md), [certificación productiva de lectura](history/RELEASE_2_48_0_VPS_20261016.md). |
| Canal privado de operadores por WhatsApp | Infraestructura publicada: vinculación verificada, sesiones revocables, selección de empleado y confirmación nativa. **Deshabilitado en producción**; sin prueba real de Meta en esta entrega. [Validación y límites](history/RELEASE_2_48_0_VPS_20261016.md). |
| Última publicación documentada | [2.50.4 — Inventario, cierre y comisiones](history/RELEASE_2_50_4_VPS_20261019.md), 19 de octubre: CI aprobado, respaldo cifrado verificado, sin migración nueva, HTTPS autenticado y datos de la beta conservados. |
| Inicio, navegación y continuidad de trabajo | Mejoras publicadas en 2.45.0, después de la [revisión general del dashboard](history/REVISION_GENERAL_DASHBOARD_20261008.md). |
| Correcciones finales del frontend | Recuperación del pago, pendientes de todas las fechas, seguimiento clínico con reintento y bloqueo del precio durante el guardado publicados en 2.45.0. [Evidencia y límites del cierre local](history/FRONTEND_CIERRE_AJUSTES_20261008.md). La comprobación manual con zoom real y lector de pantalla continúa sin certificar. |
| Inventario y Seguimiento de clientes | Publicados en [2.43.0](history/RELEASE_2_43_0_VPS_20261005.md), después de la implementación y migración de Inventario en [2.42.0](history/RELEASE_2_42_0_VPS_20261005.md). |

## Fuentes por módulo

| Módulo | Diseño o contrato | Evidencia de referencia |
| --- | --- | --- |
| Inicio y recorridos entre módulos | [Modelo de dominio](architecture/domain-model-v1.md) y [propuestas implementadas](history/designs/README.md) | [Revisión general local](history/REVISION_GENERAL_DASHBOARD_20261008.md), [continuidad y seguimientos](history/CIERRE_INICIO_CONTINUIDAD_Y_SEGUIMIENTOS_20261008.md) |
| Administración | [Acceso por perfil y áreas](architecture/team-business-access.md), [decisiones](decisions/README.md) | [Revisión del conjunto](history/ADMINISTRACION_REVISION_CONJUNTO_20261007.md), [publicación](history/RELEASE_2_44_0_VPS_20261007.md) |
| Agenda | [Horarios por servicio](decisions/012-horarios-por-servicio.md), [excepciones](decisions/013-excepciones-fechadas-de-agenda.md), [equipo](decisions/011-equipo-disponibilidad-agenda.md) | [Excepciones de agenda](history/AGENDA_EXCEPTIONS_COMPLETION_REPORT.md), [disponibilidad del equipo](history/EQUIPO_DISPONIBILIDAD_AGENDA_20261007.md) |
| Consultas y expediente | [Correcciones de historia clínica](architecture/clinical-history-corrections.md), [clientes y mascotas](architecture/contacts-dashboard-maintenance.md) | [Recorrido real en PostgreSQL local](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| Peluquería | [Diseño e integración](architecture/grooming-dashboard.md) | [Recorrido y aislamiento local](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| WhatsApp | [Atención compartida](architecture/whatsapp-team-workspace.md), [ADR 014](decisions/014-whatsapp-atencion-compartida.md) | [Revisión local y límites](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| Punto de venta | [Espacio POS](architecture/pos-workspace.md), [nombres y paginación](architecture/pos-history-pagination.md) | [Publicación 2.42.0](history/RELEASE_2_42_0_VPS_20261005.md), [integración local](history/REVISION_GENERAL_DASHBOARD_20261008.md) |
| Inventario | [Cinco etapas aprobadas](architecture/inventory-workspace.md), [ADR 015](decisions/015-inventario-productos-insumos.md), [venta atómica](decisions/016-venta-inventario-atomica.md) | [Implementación](history/ENTREGABLE_INVENTARIO_COMPLETION_REPORT.md), [publicación 2.43.0](history/RELEASE_2_43_0_VPS_20261005.md) |
| Seguimiento de clientes | [Integración](architecture/customer-followup-integration.md) | [Ajustes y comprobaciones](history/SEGUIMIENTO_CLIENTES_AJUSTES_FINALES_20261005.md), [límites de prueba real](history/RELEASE_2_43_0_VPS_20261005.md) |

## Pendientes que la limpieza no cierra

- **Accesibilidad manual:** zoom real y lector de pantalla continúan pendientes; los controles automatizados no sustituyen esas comprobaciones.
- **Beta operativa propia:** foco indicado el 16 de octubre: usar primero en la veterinaria del responsable. La [revisión actual](operations/OWN_CLINIC_BETA_REVIEW_20261016.md) distingue puesta en marcha, cuentas reales, datos, recuperación y nueva observación de 48 h. El paso 8 de agenda conserva su cierre; capacidad y estabilidad no se cierran por salud correcta. La comercialización externa se evalúa después.
- **Reactivación por WhatsApp real:** el informe de publicación 2.43.0 documenta la falta de nombre/idioma de plantilla aprobada. No consta en ese informe un envío real concluido; no darlo por certificado a partir de pruebas simuladas.
- **Documentos y datos reales:** el paquete 1.1 quedó cerrado para un piloto individual ficticio; los campos públicos son placeholders deliberados y las copias completas están privadas. Revisar su aplicación a datos y operaciones reales de la veterinaria, sin confundirla con el cierre anterior. [Estado y alcance](legal/README.md), [revisión de beta propia](operations/OWN_CLINIC_BETA_REVIEW_20261016.md).
- **Fase 8:** el roadmap 8.1–8.3 y la extensión 8.4 tienen informes de cierre. Eso no equivale a inventar un cierre formal de fase distinto del registrado en el Plan Maestro.

## Uso de documentos antiguos

Las propuestas concluidas sirven para entender el diseño y sus aprobaciones. Las auditorías y procedimientos anteriores sirven como antecedentes, con sus límites originales. Para saber qué funciona hoy, partir de esta página y contrastar el diseño con sus ADR, el código y la evidencia más reciente.
