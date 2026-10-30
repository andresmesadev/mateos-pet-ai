# Huella Nex: incorporación guiada de un establecimiento

**Fecha:** 30/10/2026, Colombia. **Punto 2:** implementación y comprobación local
aprobadas para los recorridos descritos. Publicación y aceptación por un negocio
independiente siguen siendo decisiones separadas.

## Problema y comportamiento resultante

La guía existente de Administración estaba plegada, no tenía acceso específico
desde Inicio y terminaba en configuración/equipo, sin inventario, apertura,
primera operación ni cierre. La página posterior al registro hablaba de una
primera cita incluso para un pet shop exclusivo.

Ahora «Preparar mi negocio» desde Inicio y desde el registro lleva a la guía
abierta. Se conserva la opción de plegarla en Administración. Incluye enlaces a
los flujos existentes hasta el cierre: nueve pasos para negocios con atención
por cita y siete para un pet shop exclusivo. Los botones de sección desplazan
la vista hasta el formulario elegido.

El texto distingue venta de productos y consumo de insumos; explica apertura
separada de ingresos, contratos/porcentajes y servicios directos, cobro mixto y
revisión previa al cierre. Reutiliza identidad, módulos y datos del propio
establecimiento. No introduce un requisito de usar la configuración de Mateos Pet.

Las referencias de contacto, servicios con cita y horario se calculan con los
datos cargados de Administración. Los servicios usan también `bookingCategory`,
para incluir los reservables de otras categorías en su área correcta. Equipo,
inventario y caja siguen «Por revisar»: no se consulta su estado para emitir una
certificación automática ni se marca un paso terminado por abrirlo.

Esta es una mejora de presentación de flujos ya implementados, dentro de
Configuración del Negocio. No agrega reglas de dominio, entidades, endpoints,
migraciones ni llamadas autenticadas desde el navegador fuera del proxy.

## Validación

Se amplió el ensayo aislado de ciclos por actividad con un recorrido real de UI
de la guía en cada uno de los tres negocios sintéticos:

- Acceso desde Inicio, apertura de la guía y pasos apropiados al módulo.
- Navegación a Áreas, Equipo, Datos, Inventario, Caja y primera operación.
- Borrador protegido al intentar salir sin guardar; cancelar conserva el texto.
- Primer guardado de contacto con respuesta 503 simulada: error visible,
  borrador conservado y segundo intento real confirmado. El contacto guardado
  aparece en la guía después de la actualización de datos.
- Tras configurar servicios/horarios mediante los adaptadores HTTP existentes,
  la guía refleja sus referencias al recargar y conduce al cierre del día.
- Presentación a 320, 390, 768 y 1440 píxeles sin desbordamiento horizontal;
  acciones de al menos 44 píxeles. Se revisaron capturas de escritorio y móvil.
- Cada negocio completa además su ciclo anterior: operación, inventario, pago,
  comisión y cierre con los importes conciliados del punto 1.

Ejecución final, después del ajuste de desplazamiento:

```text
node scripts/verify-onboarding-local.cjs --guided-business-setup
Onboarding integration: 24 passed, 0 failed.
PASS own temporary PostgreSQL container removed
```

La incorporación usa PostgreSQL temporal exclusivo, migraciones desde vacío,
comprobación de cero diferencias frente al esquema y navegador con bloqueo de
orígenes externos. No modifica datos reales, VPS, proveedores ni cobros reales.

Otras comprobaciones del cambio:

```text
Next.js 16.4.2: Compiled successfully
TypeScript: finalizado sin errores
Flujos Node: 41 archivos, 285 pruebas, 285 pass, 0 fail
ESLint frontend: exit 0, sin diagnósticos
Node --check: scripts de guía y ciclos sin errores
git diff --check: sin errores
```

El backend no cambió en este punto; la regresión de 236 suites/2.117 pruebas del
punto 1 no se presenta como una nueva ejecución de este punto. El ensayo conserva
la advertencia de deprecación de consultas concurrentes de `pg` ya documentada;
no afectó los resultados. La versión candidata permanece en 2.58.3, sin tag,
commit, push ni despliegue nuevos.

Capturas y resultados sintéticos regenerables:
`.cache/guided-business-setup/`, excluido de Git.

## Límites

Se comprobaron los enlaces, estados observables y recuperación de errores de la
guía, junto con los ciclos operativos aislados. Las configuraciones completas
de servicios/equipo/inventario y las operaciones del ciclo usan sus adaptadores
HTTP reales; no se afirma que todos esos formularios se hayan cumplimentado
manualmente en esta ejecución. No se simuló aceptación por una persona externa
sin formación ni se probó aquí la recuperación del administrador o salida íntegra
de sus datos. Esos pendientes conservan su evaluación de admisión externa.

El recorrido de referencia para formación queda en
[Preparar un establecimiento](../operations/HUELLA_NEX_BUSINESS_START_GUIDE.md).
