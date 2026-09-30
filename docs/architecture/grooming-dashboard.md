# Atención de peluquería en el dashboard

Fecha: 2026-09-30. Mejora operativa autorizada; no reabre fases cerradas.

## 1. Definición funcional
Un espacio de Peluquería para recibir mascotas, atender baños y cortes, registrar notas sencillas y confirmar la entrega. Notas de la atención contiene cuidados especiales, observaciones, corte y productos utilizados. Se conserva por visita y mascota para la siguiente atención.

## 2. Casos de uso
- Administrador consulta citas de peluquería por día y busca mascota o propietario; filtra por peluquero y etapa de atención.
- Recibe e inicia mediante las transiciones ya existentes. Respeta la tolerancia de llegada de 30 minutos y separa citas antiguas por revisar.
- Guarda una nota de hasta 6000 caracteres. Una versión desactualizada no sobrescribe la nota de otro editor.
- Consulta notas de visitas anteriores de esa mascota, sin mezclar historias clínicas.
- Asigna responsable y precio con la ficha operativa existente. Completar usa el comando único de Agenda y conserva las reglas de comisiones y precios.
- Una cita completada está lista para entrega; confirmar entrega guarda la fecha una sola vez. No repite el cierre financiero.

## 3. Arquitectura
Rutas de dashboard autenticadas y tenant-scoped. Lista y notas se apoyan en Appointment y en su mascota. Precio exclusivamente por price-resolver; completar mediante completeAppointment. La cuenta administrativa existente usa esta sección. No se crea un nuevo acceso individual de peluquero en este alcance. El acceso restringido de veterinario no habilita rutas de peluquería.

## 4. Persistencia
Appointment añade groomingNotes, groomingNotesVersion (1 inicialmente), groomingNotesUpdatedAt y groomingDeliveredAt. La nota vive en el dominio operativo, sin dependencia de MedicalRecord. Guardado condicional por versión; entrega condicional por status completed y fecha de entrega nula. No hay auditoría de versiones de notas en este alcance. Notas antiguas de la ficha general permanecen accesibles desde la ficha de mascota.

## 5. Esquema físico
Migración aditiva 20260930190000_grooming_visit_notes. Sin nuevos estados de cita, tablas, agrupaciones de tenants ni reglas contables. Índices existentes por tenant/date y petId sostienen las lecturas. Historia paginada por cursor de cita y fecha. Notas no se copian a una nueva visita.

## Diseño de interfaz
Mantener tipografía y paleta del dashboard: fondo #f3f8f7, texto #15343d, teal #007c76, blanco #ffffff y ámbar #b45309 para peluquería. Lista operativa con etapas visibles y acciones directas; formulario centrado de notas, ancho cómodo, un campo principal y antecedentes colapsables. Etiquetas sencillas; sin terminología médica ni métricas comerciales duplicadas.

## Validación
- Migración local aplicada y Prisma Client regenerado: 39 migraciones.
- Backend: 148 suites y 1128 pruebas aprobadas. Casos específicos: permisos y módulo, alcance de tenant y mascota, fechas inválidas, versiones y colisiones, notas de citas cerradas, entrega idempotente e historia paginada.
- `node scripts/verify-grooming-local.cjs`: ejecuta el adaptador HTTP real con PostgreSQL dentro de una transacción revertida. Guardado, conflicto, consulta de notas y entrega verificados; cero cobros o comisiones de la prueba; fixture ausente al finalizar.
- Frontend: lint y build aprobados; búsqueda por mascota, citas anteriores, nota centrada y antecedentes comprobados en navegador. No se simuló una atención real ni se completaron citas de usuarios para probar.
- Versionado evaluado: mantenimiento autorizado del dashboard, sin cierre de fase ni tag oficial; permanece la versión declarada 2.39.11. El commit identifica el cambio desplegado.
