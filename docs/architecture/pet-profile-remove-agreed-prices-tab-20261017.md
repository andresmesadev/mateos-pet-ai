# Retirar la pestaña Tarifas acordadas de la mascota

1. Funcional: quitar la pestaña y el panel de Tarifas acordadas de la ficha, a petición del usuario; los valores de servicio y domicilio siguen en Datos y cuidados.
2. Casos de uso: consultar y editar la ficha sin una sección de tarifas adicional; conservar historial, peluquería y precios actuales.
3. Arquitectura: retirar de PetMedicalSheet el panel, su consulta, estado y edición exclusivos; ajustar las columnas de las pestañas restantes. Mantener servicios backend y resolución de precios existentes.
4. Persistencia: no borrar datos ni modificar contratos o permisos; sin cambios de base de datos.
5. Esquema y verificación: sin migración; lint, build y ensayo existente de ficha/agenda/Caja, con datos desechables.

Eliminación de presentación dentro de las capacidades existentes; no introduce reglas de negocio ni funcionalidades de fases futuras. Sin publicación del lote.

Verificación ejecutada: ESLint del componente exit_code 0; build aislado de Next y TypeScript exit_code 0 (32 páginas); `verify-onboarding-local.cjs --grooming-transport` informó `Onboarding integration: 34 passed, 0 failed` y eliminó su PostgreSQL desechable. Ficha, precios, borrador, agenda, inventario y pago con comisión conservados. `rg` no encuentra el panel, su pestaña ni estados exclusivos en el componente. `git diff --check`: exit_code 0. Sin nueva migración ni datos reales modificados. Permanece el aviso previo del reactor EventDelivery documentado en las verificaciones del lote.
