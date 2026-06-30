# Regla de Ejecución de la Fase 2

**Estado:** Estándar de trabajo vigente — no es una preferencia temporal.
**Aplica a:** todos los entregables de la Fase 2 (2.1, 2.2, 2.3 y cualquiera que se agregue).
**Origen:** formalizada durante el diseño del Entregable 2.1 — Sistema Operativo de Servicios.

---

## Propósito

Esta regla existe para que ningún entregable de la Fase 2 se construya antes de haber sido entendido. La disciplina seguida durante el diseño del Entregable 2.1 —definición funcional, casos de uso, arquitectura técnica, modelo de persistencia y solo entonces esquema físico— no fue un ejercicio puntual. Es el proceso correcto, y de aquí en adelante es obligatorio.

---

## Las cinco etapas previas a la implementación

Ningún entregable de la Fase 2 puede comenzar su implementación hasta completar y aprobar, en este orden, las siguientes etapas:

### 1. Definición funcional
- ¿Qué problema del negocio resuelve?
- ¿Qué trabajo humano elimina?
- ¿Cuál es su objetivo dentro del Sistema Operativo?

### 2. Casos de Uso
- Contrato funcional.
- Actores.
- Flujos.
- Reglas de negocio.
- Eventos de dominio.

### 3. Arquitectura Técnica
- Capa de aplicación.
- Contratos.
- Dependencias.
- Eventos.
- Organización de la solución.
- **Decisiones Arquitectónicas Diferidas** (sección obligatoria, al cierre del documento).

**Sobre las Decisiones Arquitectónicas Diferidas.** Todo documento de Arquitectura Técnica debe cerrar con esta sección, registrando explícitamente las preguntas que el entregable identificó pero decidió no resolver. No representan deuda técnica, no representan errores del diseño, no son tareas olvidadas: son decisiones conscientes que quedan deliberadamente fuera del alcance del entregable para proteger el diseño aprobado y evitar rediseños silenciosos durante la implementación. Una decisión diferida que se resuelve más adelante se resuelve con su propio ADR, nunca implícitamente al escribir código.

### 4. Modelo de Persistencia
- Entidades.
- Relaciones.
- Agregados.
- Invariantes.
- Evolución del modelo.

### 5. Esquema Físico
- Prisma.
- Claves.
- Índices.
- Restricciones.
- Migraciones.

**Solo cuando las cinco etapas anteriores están aprobadas puede comenzar la implementación.**

Cada etapa se aprueba explícitamente antes de avanzar a la siguiente. Avanzar sin aprobación —aunque la siguiente etapa parezca obvia o la implementación parezca sencilla— viola esta regla.

---

## Después de implementar cada entregable

Completada la implementación, son obligatorias las siguientes tres etapas:

### 6. Validación
- Tests.
- Revisión arquitectónica.
- Verificación contra el Plan Maestro.
- Verificación contra el Modelo de Dominio.
- Verificación contra los Principios Permanentes.

### 7. Documentación
- Actualizar la documentación correspondiente.
- Registrar cualquier decisión arquitectónica relevante.
- Actualizar el Plan Maestro únicamente si cambia el roadmap o la estrategia — no para registrar detalles de implementación, que pertenecen a otros documentos.

### 8. Cierre del Entregable
- Confirmar que el objetivo fue alcanzado.
- Documentar qué capacidades nuevas incorpora.
- Documentar qué habilita para el siguiente entregable.
- Registrar el cierre en el historial del proyecto.

**Estándar de nomenclatura para el cierre histórico.** El documento de cierre de cada entregable se crea en `docs/history/` con el nombre `ENTREGABLE_<fase>_<número>_COMPLETION_REPORT.md` (p. ej. `ENTREGABLE_2_1_COMPLETION_REPORT.md`, `ENTREGABLE_2_2_COMPLETION_REPORT.md`). Este es el mismo patrón ya usado para `PHASE_1_COMPLETION_REPORT.md` y para el cierre fundacional (`FOUNDATION_COMPLETED.md`). El propósito de este estándar es que `docs/history/` funcione como la línea de tiempo oficial del proyecto: cualquier persona o IA debe poder recorrer esa carpeta cronológicamente y entender, sin leer código ni conversaciones previas, cómo evolucionó cada fase y cada entregable. Este estándar aplica a todo cierre futuro, no solo a los de la Fase 2.

---

## Alcance y evolución de esta regla

Esta regla no aplica únicamente al Entregable 2.1. Es el proceso oficial de construcción para **todos** los entregables de la Fase 2.

Si durante esta fase se confirma que este flujo mejora la calidad del proyecto, esta regla podrá evolucionar para convertirse en el proceso oficial de ingeniería de toda la Plataforma Operativa Inteligente, más allá de la Fase 2. Esa decisión, si se toma, se documentará explícitamente — no se asume por defecto.

---

*Regla de Ejecución de la Fase 2 · Plataforma Operativa Inteligente · Mateos Pet*
