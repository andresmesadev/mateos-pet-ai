# Peluquería y domicilio antes de datos clínicos

1. **Funcional:** mostrar los valores existentes de peluquería y domicilio en Datos y cuidados, encima de Datos clínicos, tanto al consultar como al editar la ficha.
2. **Casos de uso:** consultar ambos importes al abrir la mascota y modificarlos con el guardado existente. Mantener cero gratuito, vacío por confirmar y advertencia del total anterior importado.
3. **Arquitectura:** trasladar la única instancia de `PetGroomingPrices` desde Tarifas acordadas al bloque principal; separar identificación y datos clínicos del editor para conservar el componente montado al alternar edición. Tarifas acordadas mantiene los acuerdos por servicio. Conservar permisos administrativos, proxy autenticado y protección de borrador sin crear formularios anidados.
4. **Persistencia:** mismos campos de Mascota y endpoint de precios; sin cambiar precios históricos, comisiones ni datos importados.
5. **Esquema y verificación:** sin migración. Lint/build y ensayo real de posición, persistencia de importes y conservación de borrador al editar, con pantallas móvil y escritorio.
