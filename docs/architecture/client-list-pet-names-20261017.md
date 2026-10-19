# Clientes: identificar al propietario por sus mascotas

1. **Definición funcional:** reemplazar la cantidad de mascotas por sus nombres en la lista de clientes y retirar las columnas Citas/Última actividad. Aplicar también a las tarjetas móviles; mantener teléfono y acciones existentes.
2. **Casos de uso:** identificar propietarios homónimos por sus mascotas, leer varios nombres sin abrir la ficha y reconocer clientes sin mascotas registradas. Conservar nombres completos y paginación.
3. **Arquitectura técnica:** agregar al resumen paginado existente únicamente `pets: [{ id, name, type }]`, con filtro Tenant en la relación; reutilizar `ClientsTable`, sin consultas individuales por fila. Mostrar nombres con ajuste de línea y estados vacíos explícitos.
4. **Persistencia:** usar Cliente (`User`) y su relación existente con Mascota (`Pet`); sin cambios de entidades, historial o permisos. Los contadores/fechas siguen disponibles en el contrato para otros consumidores.
5. **Esquema físico y verificación:** sin migración. Validar carga autenticada, todos los nombres de un propietario, ausencia de columnas retiradas, apertura de ficha, aislamiento y adaptación a escritorio/móvil con datos ficticios.
