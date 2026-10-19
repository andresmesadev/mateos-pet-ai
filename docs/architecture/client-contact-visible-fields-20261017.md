# Ficha del propietario: mascotas y contacto visible

1. **Funcional:** nombrar la sección y el acceso a agenda como citas de sus mascotas. Mostrar todos los campos actuales al editar Contacto principal, aunque sean opcionales, sin desplegable adicional.
2. **Casos de uso:** consultar citas de las mascotas del cliente; editar nombre, teléfono principal, teléfono alternativo, correo, dirección y notas autorizadas; guardar sin completar los campos opcionales.
3. **Arquitectura:** ajustar únicamente presentación y textos de `ClientSheet`. Reutilizar `FormSection`/`FormField` y el PATCH autenticado existente. Mantener nombres de cada mascota en las citas, filtro de agenda por propietario, permisos de notas y validación.
4. **Persistencia:** campos existentes de Cliente (`User`) y Cita (`Appointment`) vinculada con Mascota; sin nueva regla de negocio ni alteración de datos existentes.
5. **Esquema y verificación:** sin migración. Lint/compilación, ensayo de edición con opcionales vacíos y completos mediante proxy, y comprobación de los textos/enlace en navegador.
