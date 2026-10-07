# Corrección de precisión de horarios y acceso a Equipo

Requerimiento del responsable (2026-10-06): permitir apertura/cierre con minutos, como 10:30, y corregir Ver equipo y accesos.

## Diseño acotado

La persistencia vigente acepta HH:mm; las citas ya conservan minutos y el dashboard ofrece medias horas veterinarias. La restricción a horas enteras del editor y el truncamiento de minutos del resolvedor son inconsistencias con esa capacidad existente.

Se conservará el contrato numérico de hora de los consumidores: 10:30 = 10.5. El resolvedor de ventana conservará la fracción de minutos al interpretar HH:mm. Las sugerencias se anclarán a la apertura real, manteniendo el paso y la capacidad vigente de una hora. La hora de cierre sigue siendo exclusiva y un turno debe caber en la ventana. La prioridad de áreas/fechas especiales, días hábiles, festivos, turnos consecutivos de peluquería, margen futuro y aislamiento por Tenant se conservan.

El preview de fechas especiales y los textos de citas también conservarán los minutos. No se introduce duración por servicio, capacidad nueva, modelo ni migración.

Se ajustan funciones concretas de availability.service.js, availability-db.service.js y parseo/formato de scheduling.service.js. Esta es una corrección puntual de precisión, documentada antes de implementarse; no una reescritura del motor conversacional ni una nueva regla de negocio.

El acceso a Equipo usará la selección interna de SettingsTabs, incluyendo su protección de borradores. Cambiar la URL mediante un enlace no actualizaba el estado interno de la pestaña.

## Criterios de comprobación

- Guardar y recuperar HH:mm en PostgreSQL, general y por área.
- No ofrecer ni aceptar un turno anterior a la apertura real o que termine después del cierre.
- Misma hora al sugerir, presentar y reservar desde los consumidores existentes.
- Preview de citas antes y después de límites con minutos.
- Horarios enteros conservan su comportamiento.
- Botón Equipo abre la sección; borradores requieren guardar/descartar.
- Lint, compilación y pruebas de disponibilidad/scheduling/dashboard y API pública.
