# Búsqueda de propietario o mascota al agendar

## 1. Definición funcional
Nueva cita permite buscar por nombre del propietario, teléfono o nombre de mascota. Cada resultado identifica al propietario y sus mascotas; seleccionar una mascota carga también su propietario.

## 2. Casos de uso
Buscar propietario y elegir una de sus mascotas; buscar mascota y seleccionarla directamente; distinguir mascotas con el mismo nombre por propietario y teléfono. La selección se verifica contra la ficha actual del propietario antes de reservar.

## 3. Arquitectura técnica
Reutilizar el autocomplete autenticado `/api/dashboard/clients` y el detalle del cliente mediante `proxyUrl`. Ampliar el filtro existente con la relación de mascotas, siempre dentro del Tenant resuelto. Recuperar hasta cinco coincidencias de mascota por propietario además de las cinco mascotas recientes: una mascota antigua sigue siendo localizable. Mantener el límite existente de propietarios y cancelar resultados de búsquedas anteriores.

## 4. Modelo de persistencia
Usar las entidades Cliente (`User`) y Mascota (`Pet`) y la relación de pertenencia existentes en el modelo de dominio. Sin entidades nuevas ni cambios en precios, agenda o permisos.

## 5. Esquema físico
Sin cambios de esquema ni migraciones. Verificar coincidencias por propietario, teléfono y mascota antigua, aislamiento por Tenant y selección de la mascota correcta en navegador.
