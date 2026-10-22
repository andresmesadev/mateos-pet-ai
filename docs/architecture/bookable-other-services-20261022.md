# Servicios agendables de la categoría Otros

## 1. Definición funcional

El responsable confirmó Vacunación con «Requiere cita» activado y señaló que
falta en Nueva cita. Lectura productiva del 22/10: activo, requiresAppointment
true, categoría other. El formulario excluye other y los endpoints de horarios
y creación también lo rechazan. Corregir la cadena completa del dashboard.

## 2. Casos de uso

Mostrar servicios activos habilitados para cita, incluidos Otros. Los servicios
sin cita o retirados siguen fuera. Reutilizar Veterinaria para las reservas de
Otros: es el criterio ya usado por compatibleRole para profesionales ajenos a
peluquería. Así Vacunación usa horario/capacidad veterinarios y su personal
habilitado. Otros conserva su categoría comercial y su check de comisión.
No se agrega una tercera agenda ni se cambia el catálogo real.

## 3. Arquitectura técnica

El adaptador declara bookingCategory en GET /dashboard/services. La misma
función determina el bucket al consultar horarios y reservar; el formulario
filtra por esa área operativa y los módulos activos, no por la etiqueta
comercial. Las citas de Otros creadas como vet permanecen visibles para el
veterinario y su atención clínica. Conservar validación de staff, Tenant,
duplicados, horario real y permisos. No modificar el motor de WhatsApp.

## 4. Persistencia

Reutilizar Service.category, requiresAppointment, Appointment.serviceId,
serviceType vet y availabilityBucket vet. Ninguna reclasificación automática
ni escritura en la configuración productiva. Conservar hechos de cobro y stock.

## 5. Esquema físico y validación

Sin migración. Probar catálogo → selector → horarios → reserva con Vacunación,
conservación del serviceId y área vet, exclusión de no agendables/retirados,
módulo veterinario desactivado y Tenant ajeno. Confirmar visibilidad clínica y
protección frente a duplicados. Ejecutar backend, lint/build y Chrome real en
PostgreSQL desechable. Los cambios previos de guardado de peluquería se conservan.
