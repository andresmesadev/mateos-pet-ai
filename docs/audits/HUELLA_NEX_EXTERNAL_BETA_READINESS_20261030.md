# Huella Nex: preparación de producto y beta externa

**Corte:** 30/10/2026, Colombia. **Tipo:** evaluación de preparación del
producto comercial, no una publicación ni certificación jurídica o de seguridad.

## Dictamen

Huella Nex ya es un producto operativo con su primer cliente, Mateos Pet,
utilizado con datos y actividad reales desde el 19/10. Es un **candidato técnico
a beta cerrada asistida del dashboard**, con evidencia local favorable para
veterinarias, peluquerías y pet shops. No hay evidencia suficiente para declarar
abierta una beta externa ni una oferta SaaS autónoma lista para vender sin
acompañamiento.

Son tres decisiones distintas:

| Etapa | Evaluación |
| --- | --- |
| Uso real en el primer cliente | Sí, confirmado por el responsable y documentado. No se reclasifica como datos ficticios. |
| Beta cerrada asistida con otro negocio, dashboard manual | Viable como siguiente objetivo, condicionada a los controles de admisión enumerados abajo. WhatsApp no es requisito de esta modalidad. |
| Oferta completa dashboard + IA con cupo + WhatsApp propio | No lista para aceptación externa; HN-04 sigue abierto. |

La frontera no es el número de días de uso ni de pruebas aprobadas. Falta
acreditar cómo se incorpora, atiende, protege y eventualmente retira un cliente
que no es el centro de Andrés y Lina.

## Identidad, alcance y evidencia

Huella Nex es el software general; Mateos Pet es su primer establecimiento y
cliente. Nexo Web sigue siendo la iniciativa de desarrollo de Andrés, sin
constitución empresarial confirmada. El prestador de una futura oferta se debe
identificar conforme a su situación real, sin inventar una sociedad.

Se contrastaron alcance, identidad, revisión HN-01–07, informe final local,
estado de beta propia, recuperación, estabilidad, documentación y rutas de
cuentas/datos. Se buscaron además evidencias transversales de salida de tenant,
exportación y recuperación de contraseñas. La ausencia de evidencia de un
recorrido completo no se interpreta como ausencia de todas sus piezas.

**Repetición del 30/10:** 235 suites y 2.114 pruebas backend aprobadas; 41
archivos y 285 pruebas de flujos aprobadas. Se mantuvo la configuración de
pruebas aislada. **Evidencia del 29/10**, no repetida como prueba nueva hoy:
17 pruebas PostgreSQL, 23 comprobaciones de navegador, 60 controles de diseño,
compilación optimizada, lint y TypeScript correctos.
[Informe final local](HUELLA_NEX_FINAL_LOCAL_REVIEW_20261029.md).

**Ampliación del 30/10, punto 1 del software general:** se comprobaron ciclos
operativos de tres establecimientos sintéticos con un módulo exclusivo por
actividad, incluyendo configuración, operación, inventario, cobro y cierre.
Resultado: 18 comprobaciones de integración aprobadas. Se corrigió una pérdida
de contexto transaccional en el registro de entregas de eventos; regresión
posterior: 236 suites y 2.117 pruebas backend aprobadas. Ver alcance, importes y
límites en [Ciclos por actividad](HUELLA_NEX_GENERAL_BUSINESS_CYCLES_20261030.md).
Esta evidencia es local y no reemplaza la jornada de un negocio externo.

**Punto 2, incorporación guiada (30/10):** la guía existente se amplió hasta
inventario, apertura, primera operación y cierre, con entrada desde Inicio y
registro. Se adaptó a los módulos del negocio y se comprobó navegación, protección
de borradores, recuperación de guardado fallido y presentación en cuatro anchos.
Resultado final: 24 comprobaciones aisladas aprobadas y 285 pruebas de flujos
aprobadas, con build/TypeScript/lint correctos. Ver
[Revisión de incorporación guiada](HUELLA_NEX_GUIDED_SETUP_REVIEW_20261030.md).
La aceptación de una persona de otro negocio sigue pendiente.

**Punto 3, soporte/recuperación/salida asistida (30/10):** se preparó el
procedimiento y se ensayó recuperación del administrador mediante el mecanismo
existente, rechazo de cuenta/sesión anterior y conservación de permisos. La
herramienta de entrega operacional prepara una copia consistente y acotada al
negocio, con 43 grupos revisados y exclusiones expresas. Pasaron 22 comprobaciones
aisladas y 290 pruebas de flujos; no se modificó producción ni se entregaron datos
a terceros. Ver [Revisión de soporte](HUELLA_NEX_SUPPORT_LIFECYCLE_REVIEW_20261030.md)
para los límites y comprobaciones humanas que corresponden a cada caso real.

**Punto 4, configuración propia del establecimiento (30/10):** los registros
nuevos comienzan sin días de atención abiertos; comprobantes y fichas PDF usan
el contacto público del negocio y verifican su identidad antes de imprimir.
Las respuestas de horarios respetan las áreas activas y minutos configurados.
Se comprobaron tres negocios aislados con franjas y contactos diferentes,
incluyendo reintento tras error y rechazo de identidad ajena. Resultado:
24 comprobaciones de integración, 2.120 pruebas backend y 290 pruebas de flujos
aprobadas, con build/TypeScript/lint correctos. Ver
[Revisión de configuración](HUELLA_NEX_TENANT_CONFIGURATION_REVIEW_20261030.md).
No se publicaron cambios ni se modificó la configuración del primer cliente.

**Punto 5, visibilidad del servicio (30/10):** Inicio separa respuesta del
dashboard manual, pausa/configuración de WhatsApp y situación de IA, con fecha
y reintento. No confunde configuración con entrega ni cupo con disponibilidad
del proveedor. La consulta usa señales existentes sin llamar a Meta/OpenAI.
Resultado local: 24 comprobaciones de integración, 2.136 pruebas backend y 292
pruebas de flujos aprobadas; build/TypeScript/lint correctos. Ver
[Revisión de visibilidad](HUELLA_NEX_SERVICE_VISIBILITY_REVIEW_20261030.md).
No sustituye estabilidad vigente, monitorización ni aceptación externa.

**Punto 6, evaluación por un negocio externo (30/10):** se prepararon el
[procedimiento](../operations/HUELLA_NEX_EXTERNAL_BUSINESS_EVALUATION.md) y la
[ficha vacía](../operations/HUELLA_NEX_EXTERNAL_BUSINESS_EVALUATION_TEMPLATE.md)
para medir incorporación, ayuda, incidencias, conciliación y decisión del
participante. Los recorridos diferencian los tres nichos y combinaciones.
Preparación documental completa; ejecución y aceptación externa pendientes.
No se invitó a un negocio, crearon cuentas reales ni completaron resultados
por suposición. BETA-07 permanece abierto.

**Demostración técnica autorizada después de preparar el punto 6 (30/10):**
se ejecutó la combinación de guía, ciclos por actividad y visibilidad en una
base temporal: **30 comprobaciones aprobadas, 0 fallos**, con conciliación de
los tres negocios ficticios. El proceso automático duró 59,8 segundos; no es
tiempo humano de aprendizaje. La práctica con una persona externa no fue
solicitada para esta ejecución y sigue pendiente. Ver
[resultado y límites](HUELLA_NEX_TECHNICAL_DEMONSTRATION_20261030.md).

## Recorrido actual del software general: seis puntos

**Barrido previo a publicación (30/10):** se actualizaron dependencias con
parches compatibles, se excluyeron artefactos privados/generados y se añadió
control de higiene y PostgreSQL comercial al CI. Regresión local favorable y
auditorías de producción sin avisos conocidos; persiste el aviso bajo de
desarrollo de Jest/deepmerge. Ver [barrido](HUELLA_NEX_PREPUBLICATION_CLEANUP_20261030.md).
Ese barrido no cerraba BETA-01. Después, por autorización expresa de Andrés,
se publicó **3.0.0** el 30/10 a las 18:32 Colombia: CI de seis trabajos aprobado,
respaldo verificado, migraciones y lecturas posteriores correctas. Ver
[certificación de publicación](../history/RELEASE_3_0_0_20261030.md).

Esta numeración identifica la revisión guiada del 30/10. No sustituye los
ítems históricos del centro, HN-01–07 ni los criterios BETA-01–08 de admisión.

| Punto | Tema | Estado del trabajo preparado |
| --- | --- | --- |
| 1 | Ciclos independientes para los tres nichos | Comprobados localmente con datos sintéticos. |
| 2 | Incorporación guiada | Implementada y comprobada localmente; aprendizaje externo por observar. |
| 3 | Soporte, recuperación de cuenta y salida | Procedimiento y ensayo técnico preparados; verificación humana por caso. |
| 4 | Configuración propia de cada negocio | Correcciones y comprobaciones locales completas. |
| 5 | Visibilidad del servicio | Resumen implementado y comprobado localmente. |
| 6 | Evaluación con negocio externo | Procedimiento y ficha preparados; ejecución real pendiente de admisión y participante. |

Completar la preparación de estos seis puntos no publica el lote ni equivale
a abrir la beta externa. Las condiciones de admisión se mantienen abajo.

La revisión inicial consultó `a7c60e5` y no inspeccionó la VPS. La publicación
posterior sí verificó en vivo **3.0.0**, código de aplicación `edae4d3`.
Su estado y límites se registran en la certificación enlazada; no se deduce
estabilidad continua de las comprobaciones puntuales.

## Lo que ya tiene valor vendible

- Base común con módulos por establecimiento: Veterinaria, Peluquería y Pet shop,
  y combinaciones, sin duplicar el código por negocio.
- Clientes, mascotas, agenda, servicios, atención, inventario, venta de
  mostrador, caja, pagos mixtos, comisiones y reportes dentro del alcance probado.
- Roles, permisos, credenciales con hash, revocación y aislamiento por `Tenant`.
- Configuración del propio negocio: catálogo, horarios, personal y acuerdos.
- Registro con cuenta administrativa y aviso de preparación parcial.
- Presentación de planes ajustada a capacidades comprobadas.
- Contención local de canales/cupos de IA para que un segundo negocio no
  herede las credenciales, línea ni saldo del primero.

Esto demuestra capacidad técnica y utilidad en el primer cliente. No demuestra
todavía demanda, precio aceptado, margen real o adopción independiente en los
tres mercados. Las pruebas sintéticas complementan la operación de Mateos Pet;
no sustituyen la validación con otros negocios.

## Pendientes priorizados

| ID | Prioridad y alcance | Evidencia y mejora necesaria | Comprobación para cerrar |
| --- | --- | --- | --- |
| BETA-01 | Cerrado para la publicación 3.0.0 del 30/10 | Lote publicado: versiones coherentes, CI aprobado, respaldo y migraciones verificados; lecturas autenticadas correctas. | Mantener la evidencia de esta versión y las capacidades comerciales pendientes desactivadas. No sustituye los demás criterios de admisión. |
| BETA-02 | Antes de asumir custodia de otro negocio | Recuperación ante pérdida completa de VPS. Se retiró la copia del computador y no hay un destino externo automático nuevo documentado. | Elegir almacenamiento independiente gestionado desde la plataforma; probar copia cifrada, restauración y custodia de claves. No requiere Google ni un computador del cliente. |
| BETA-03 | Antes de admisión externa | Acreditar estabilidad de la versión que se ofrecerá. La última revisión documental conserva el ítem 9 abierto por timeouts y dependencia OpenAI. | Revisar muestras actuales, causas y cobertura; acordar y cumplir la ventana de aceptación. Distinguir dashboard disponible de integración IA degradada. |
| BETA-04 | Antes de incorporar un cliente externo | Condiciones y privacidad del software comercial. Los documentos aprobados del centro describen la operación de Mateos Pet. | Paquete específico para el negocio externo: prestador real, alcance, tratamiento/acceso a datos, proveedores, soporte, salida y constancia de aceptación. Revisar su adecuación antes de utilizarlo. |
| BETA-05 | Antes de cobrar o prometer un plan | Oferta y costos finales. Precios y cupos aceptados son una base propuesta; Básico y Pro comparten operación y su diferencia de IA no está activa comercialmente. | Acordar la oferta de beta y qué incluye/excluye, coste total y límites; no presentar márgenes simulados como observados ni comprobantes operativos como facturación electrónica. |
| BETA-06 | Procedimiento y ensayo técnico asistido preparados el 30/10 | Recuperación del administrador y copia operacional del negocio comprobadas en aislamiento. Alcance/exclusiones y límites en la revisión de soporte; no incluye entrega humana ni archivos originales de proveedores. | Aplicar la verificación real del solicitante, acordar alcance, medio protegido, conservación/terminación y registrar resolución o recepción cuando corresponda. No declarar una entrega más amplia que el paquete efectivamente preparado. |
| BETA-07 | Para abrir y evaluar la beta | Procedimiento y ficha preparados el 30/10; ejecución con un negocio independiente pendiente. Un primer cliente propio no prueba por sí solo que otro aprenda y opere con autonomía. | Acordar participante y condiciones de admisión; ejecutar el recorrido, medir ayuda/tiempos, conciliar y conservar su decisión. Ampliar a cada nicho antes de afirmar validación comercial en los tres. |
| BETA-08 | Solo si se ofrece WhatsApp/IA comercial | HN-04: documentación/aprobación Meta, configuración, presupuesto/cupos y aceptación externa con cuentas apropiadas. | Completar las condiciones de activación y probar conexión, entrega/recepción, consumo, renovación/desconexión; no usar clientes del centro como prueba externa implícita. |

BETA-02 mantiene la decisión previa de retirar la tarea del PC. El hallazgo
no autoriza reactivarla ni contratar almacenamiento. Los respaldos del mismo
servidor protegen ciertos errores y pérdidas lógicas, pero no acreditan
recuperación si desaparece ese servidor y sus copias.

BETA-03 es un pendiente de **evidencia vigente**: no afirma que la aplicación
esté caída hoy. El transcurso del tiempo no convierte automáticamente una
ventana con fallos en una ventana limpia. No se reinicia ni descarta historia
para obtener un resultado favorable.

## Mejoras del producto que priorizaría

1. **Incorporación repetible:** guía por actividad para completar negocio,
   horarios, equipo, catálogo, stock inicial y apertura; terminar con una
   operación comprobada. Reutilizar los módulos y flujos existentes.
2. **Soporte y recuperación repetibles:** responsable, medio y horario de
   atención, verificación de identidad e historial del caso. El correo de
   soporte existe; eso por sí solo no prueba que el proceso funcione.
3. **Separación de configuración y producto:** revisar cada solicitud nueva
   de Mateos Pet y decidir si es configuración de ese cliente o necesidad
   común; no convertir sus precios, contratos o prácticas en valores globales.
4. **Control del servicio ofrecido:** distinguir operación disponible, IA
   degradada y WhatsApp desconectado, con alcance claro para el usuario.
   Revisar observación y recuperación antes de prometer disponibilidad.
5. **Aprendizaje comercial medido:** registrar tiempo de incorporación,
   tareas que requieren ayuda, errores/incidencias, conciliación e intención
   de continuar del participante. Evitar porcentajes de preparación inventados.

Son prioridades de preparación y validación del producto actual, no una nueva
fase, un compromiso de construir cada pantalla ni autorización para ampliar
el dominio. Una necesidad funcional nueva debe pasar por el diseño vigente.

## Qué no hace falta para empezar esa beta

No se exige incorporar sedes/organizaciones, abrir API a terceros, adaptar
todos los países, construir cada recuperación como autoservicio ni activar
WhatsApp para poder validar el dashboard manual. No se amplía el roadmap por
una lista de deseos. Colombia y su configuración actual son el alcance inicial;
internacionalización queda fuera de esta admisión.

## Orden de trabajo propuesto

Primero verificar evidencia actual de estabilidad y acordar recuperación
independiente; después preparar/publicar el lote bajo una instrucción expresa.
En paralelo, concretar condiciones de beta y procedimientos de incorporación,
soporte y salida. Con esas condiciones cumplidas se puede admitir un primer
negocio externo al dashboard manual, con acompañamiento y alcance declarado.
HN-04 se completa aparte si se va a incluir su oferta de IA/WhatsApp.

**Respuesta a “¿ya llegamos a beta?”:** la operación del primer cliente es real
y el candidato ha superado la revisión local. Estamos en preparación de una
beta cerrada asistida externa; todavía no debe anunciarse como abierta ni
como SaaS completamente autónomo. La decisión de apertura debe quedar expresa
y apoyada en los criterios anteriores, sin borrar los cierres históricos.

## Límites de esta revisión

No se ejecutaron despliegues, cambios de cuentas, compras, envíos, acciones en
Meta, auditorías de cumplimiento legal o pruebas de penetración. No se repitió
una restauración de producción ni se inspeccionó el contenido de respaldos
reales. No se certifica seguridad absoluta ni capacidad máxima de la VPS.

Referencias: [identidad](../IDENTIDAD_DEL_PRODUCTO.md),
[alcance](../ALCANCE_DEL_PRODUCTO.md),
[respaldos vigentes](../operations/DATABASE_BACKUP_AND_RESTORE.md),
[estabilidad documentada](../operations/REAL_OPERATION_STABILITY_REVIEW_20261022.md),
[seguimiento de la operación propia](../operations/CLOSED_BETA_STATUS_20261022.md),
[alcance de documentos del centro](../legal/README.md),
[activación comercial HN-04](../architecture/commercial-providers-validation-hn04-20261028.md).
