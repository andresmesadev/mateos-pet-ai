# Alta de propietario y mascotas: contacto visible y precios por mascota

1. **Funcional:** mover teléfono alternativo, correo, dirección y notas autorizadas a Contacto del propietario, visibles y opcionales. Cada mascota admite valores opcionales separados de peluquería y domicilio.
2. **Casos de uso:** crear una o varias mascotas con importes distintos; conservar cero como gratuito y vacío como pendiente; guardar todos los datos en una única operación. Rechazar importes inválidos antes de crear ningún registro.
3. **Arquitectura:** ampliar el borrador de `NewOwnerPetsSheet` y el POST autenticado existente `/clients/with-pets`. Validar importes con el validador monetario existente y comprobar su total mediante el único resolvedor de precios. Persistir ambos campos en la misma transacción que propietario/mascotas; sin un segundo guardado parcial. Solo administración define tarifas; los demás perfiles mantienen su alta básica.
4. **Persistencia:** reutilizar `Pet.defaultGroomingPrice` y `Pet.defaultGroomingTransportPrice`. Sin total combinado nuevo, cambios de comisiones ni precios históricos.
5. **Esquema y verificación:** sin migración. Jest del endpoint y suite completa, lint/build y navegador real con contacto opcional visible, varias mascotas, importe cero/pendiente y precios completos, validación previa y pertenencia al Tenant autenticado.
