# Reestructuración de Inicio

> Archivo de diseño concluido. Conserva el diagnóstico y la propuesta de su fecha; no es una lista de trabajo pendiente. Implementación y límites de comprobación: [informe de cierre](../INICIO_REESTRUCTURADO_20261007.md). Estado de publicación: [estado actual](../../ESTADO_ACTUAL.md).

Fecha: 2026-10-07. Estado: propuesta basada en el código actual; todavía no aplicada.

## Qué encontramos

Inicio ya separa al administrador del personal operativo. El administrador tiene indicadores, acciones rápidas, agenda, conversaciones y seguimientos. Recepción, veterinarios y peluqueros tienen una pantalla operativa más sencilla, con accesos y atenciones del día.

Esa base sirve, pero quedó atrás respecto a los módulos que mejoramos:

- Inventario y los cobros por revisar todavía no están integrados en Inicio.
- Consultas y peluquería aparecen principalmente como accesos; sus pendientes requieren entrar a cada módulo.
- Algunos accesos conservan nombres anteriores, como «Historial / Ver ingresos» y «Usa Caja».
- Varios enlaces de Inicio no conservan el establecimiento seleccionado. Los datos y el destino deben corresponder al mismo establecimiento.
- La agenda y los indicadores ocupan el protagonismo incluso cuando lo urgente es responder un mensaje, registrar una atención o revisar un pago.

La revisión comprende `frontend/app/dashboard/page.tsx`, `home/sections.tsx`, `home/operational-home.tsx`, `home/fetchers.ts`, `quick-actions.tsx`, `daily-metrics-cards.tsx`, los permisos de `dashboard-access.ts` y los contratos actuales de Inventario y Punto de venta.

## Propuesta: cuatro cambios coordinados

### 1. Una cabecera útil y acciones inmediatas

Mostrar saludo, fecha de Colombia y establecimiento. Debajo, una barra breve de acciones con los mismos nombres e interfaces que los módulos actuales:

- Crear cita, cuando exista agenda y permiso para agendar.
- Registrar cobro, para quienes tengan acceso a caja.
- Registrar cliente y mascota, con permiso de contactos.
- Ir a consultas o peluquería, según área y permiso.

Las acciones secundarias estarán disponibles sin convertir toda la cabecera en una colección de tarjetas. Todos los enlaces conservarán el establecimiento seleccionado.

### 2. Un resumen del día adaptado al perfil

Separar actividad operativa y resultados administrativos.

Para la operación: citas por recibir, pacientes en espera, atenciones en curso y pendientes de completar. Los indicadores deben llevar a la lista filtrada correspondiente, con estados y reglas iguales a los módulos originales.

Para el administrador: un bloque compacto de resultados reales de hoy y acceso a Reportes. No presentar los ingresos registrados como efectivo disponible, utilidad o pagos confirmados. Los servicios con método de pago por revisar deben identificarse como tales.

Los ingresos, gastos y clientes nuevos se muestran exclusivamente a quien tenga permiso financiero/administrativo. Veterinarios y peluqueros reciben indicadores de trabajo de su área; recepción recibe agenda, atención al cliente y cobros operativos.

### 3. «Necesita atención», en un único lugar

Reunir tareas concretas con acceso directo al caso o filtro correspondiente:

| Pendiente | Destino |
| --- | --- |
| Conversaciones que requieren atención humana | WhatsApp |
| Consulta terminada con historia pendiente | Consultas veterinarias |
| Mascota lista para entregar o visita por revisar | Peluquería |
| Servicio con pago por confirmar | Punto de venta |
| Productos sin disponibles, por reponer o próximos a vencer | Inventario |
| Seguimientos vencidos o de hoy | Seguimiento de clientes |

Cada tarea se muestra únicamente con el módulo y permiso correspondientes. Ordenar por urgencia y fecha, con una vista breve y acceso al resto. No duplicar aquí listados completos de WhatsApp, Inventario ni Seguimiento.

Los conteos deben venir de datos verificables: una página de hasta 200 cobros o una página de productos no equivale al total del establecimiento. Si un contrato existente no ofrece el total, mostrar un enlace o una lista breve que describa su alcance; no inventar indicadores. Ante un error, mostrar «No disponible» y reintento, nunca convertirlo en cero.

### 4. Una jornada clara, sin repetir módulos

Mantener una sola agenda resumida del día, con mascota, propietario, servicio, hora, profesional y estado. Las acciones abrirán la cita o la atención ya implementada.

El administrador puede consultar todas las áreas habilitadas. La vista operativa respeta la asignación y el alcance que ya aplica el servidor; no amplía permisos por mostrar una tarjeta. Una cita cancelada o no asistida no debe recuperar el botón de iniciar atención desde Inicio.

No repetir los seguimientos en dos secciones ni los resultados administrativos en múltiples tarjetas. En un establecimiento que solo opera Pet shop, la jornada se centra en cobros, clientes, WhatsApp e Inventario. Si existe solo veterinaria o solo peluquería, Inicio se adapta a esa configuración.

## Orden visual recomendado

1. **Cabecera y acciones rápidas.**
2. **Resumen de la jornada**, con pocos indicadores relevantes.
3. **Necesita atención**, con pendientes accionables.
4. **Agenda de hoy**, si el establecimiento opera citas.
5. **Resultados del negocio**, compacto y exclusivo del administrador.

En escritorio, pendientes y agenda pueden compartir dos columnas. En móvil se presentan en ese orden, con botones legibles y sin desplazamiento horizontal.

## Qué conservar, quitar y agregar

**Conservar:** creación manual de citas, agenda y ficha de la cita, búsqueda global, separación entre resultados administrativos y trabajo operativo, enlaces a las herramientas existentes.

**Quitar o sustituir:** accesos con nombres anteriores, tarjetas vacías que consumen espacio, contadores repetidos, listas completas que obligan a recorrer Inicio para llegar a la tarea del día.

**Agregar:** una visión breve de los pendientes de los módulos ya implementados, acceso a revisión de pagos e Inventario, destinos filtrados y conservación consistente del establecimiento.

## Alcance y comprobación

Esta propuesta reorganiza la experiencia usando capacidades existentes. No agrega roles, reglas clínicas, automatizaciones, aperturas/cierres de caja ni nuevas entidades. Las fuentes oficiales revisadas son el Plan Maestro, cierre de Fase 1, modelo de dominio y regla de ejecución de Fase 2. Si se necesita un nuevo contrato de datos o una regla de negocio, se documentará su diseño antes de construirlo.

La implementación deberá comprobar:

- Administrador, recepción, veterinario y peluquero: tarjetas, consultas y acciones limitadas a sus permisos reales.
- Establecimientos con veterinaria, peluquería, Pet shop y sus combinaciones, sin módulos inactivos en pantalla.
- Contadores reconciliados con el módulo original y límites de paginación explícitos.
- Estado vacío, carga, fallo parcial y actualización de datos.
- Todos los enlaces mantienen establecimiento, fecha, caso y filtro cuando corresponda.
- Pantallas de escritorio y móvil; lint, compilación y pruebas relevantes.

**Recomendación:** aplicar estos cuatro ajustes como una reestructuración completa de Inicio, conservando el estilo visual del dashboard y las reglas que acabamos de verificar en producción.

## Diseño de implementación — 7 de octubre

Paleta existente: fondo `#f5f8f8`, papel `#ffffff`, texto `#1b353b`, acción `#137568`, superficie secundaria `#e9f2f0`, aviso `#92400e`. Se mantiene Geist; títulos de 20–24 px, cuerpo de 14 px y cifras tabulares. Sin animaciones decorativas.

```text
Establecimiento · perfil                    Fecha · Actualizar
Acciones permitidas
Jornada: programadas / en espera / en atención / terminadas
Necesita atención              Agenda de hoy (máximo 8 citas)
Pendientes por módulo          Abrir la agenda completa
Resultados del negocio — solo permiso finance
```

Crítica previa: la prioridad es llegar a la tarea con un clic. Las tarjetas financieras no deben competir con la jornada; los módulos sin incidencias se resumen en una línea. Un fallo parcial permanece visible y no equivale a «sin pendientes». Pet shop no muestra agenda ni métricas clínicas.

Contratos reutilizados: `/tenant/profile`, `/appointments/today`, `/appointments/week` (historias del día), `/grooming/appointments` (entregas del día), `/conversations?attention=human` (total paginado oficial), `/cash/operational` (hasta 200 movimientos), `/inventory/products?status=low|expired|expiring&limit=1` (presencia, no total), `/next-actions/upcoming` (primeros seis; solo administración y áreas habilitadas) y `/metrics/cashbox` (hechos financieros activos, precisión por línea). No se introduce un contrato HTTP nuevo ni cambios de persistencia. Los filtros de destino se integran como adaptación de navegación en los módulos existentes.
