# Guardado conjunto de peluquería en cita y expediente

## 1. Definición funcional

Petición explícita del responsable del 21/10/2026: guardar precio de peluquería,
valor del domicilio o modalidad de llegada en una cita debe actualizar también
los habituales de su mascota, para todas las mascotas del establecimiento.
Sustituye la separación de esos guardados descrita en 2.54.0. No es una reparación
masiva de datos anteriores ni una autorización para modificar cobros históricos.

## 2. Casos de uso

- Cambiar precio en cita abierta de peluquería: fijar esa cita, el acuerdo del
  servicio ya existente para la mascota y el valor visible en su expediente,
  atómicamente. No crear overrides específicos al guardar habituales: ocultarían
  futuras ediciones de la ficha. El comando explícito de precio acordado sí
  conserva su contrato de crear una regla por servicio.
- Guardar domicilio: conservar el traslado de la visita y actualizar modalidad
  habitual y precio confirmado (incluido cero). Sin permiso de precios solo se
  actualiza la modalidad; traslado compartido es una excepción de la visita y
  no convierte el habitual en gratuito ni modifica otra mascota.
- Cambiar habituales en el expediente sigue afectando próximas reservas sin
  reemplazar importes ya fijados. No cambiar servicios veterinarios al editar
  peluquería. No reescribir otras citas, transacciones, comisiones ni cierres.
- Rechazar otra mascota/establecimiento, cita cerrada o guardado incompleto;
  si falla una escritura, ninguna parte se confirma.

## 3. Arquitectura técnica

Adaptadores del dashboard coordinan una transacción con bloqueo de la cita.
Servicios conserva la única vía de escritura de PriceRule: se expone su mismo
caso de uso con repositorios ligados a la transacción y eventos diferidos hasta
el commit. Un helper de adaptación sincroniza Pet sin calcular precios;
price-resolver.service.js sigue siendo la autoridad de lectura.
El formulario comunica el efecto real del guardado. Se conservan permisos y
proxy autenticado. No se modifica el motor conversacional.

## 4. Persistencia

Reutilizar Appointment.finalPrice, Pet.defaultGroomingPrice,
Pet.defaultGroomingTransportPrice, Pet.defaultGroomingTransportMode y PriceRule.
El total histórico inclusivo se conserva salvo cuando se guarda un desglose
explícito de domicilio. Bloqueos y transacción protegen cierre/eliminación
concurrente; la publicación posterior no comunica una operación revertida.

## 5. Esquema físico y validación

Sin tablas ni migraciones nuevas. Pruebas de guardado de dos mascotas distintas,
regla de servicio existente, cero, modalidad y pendiente, Tenant/permisos,
rollback y conservación de cobros/citas cerradas; recorrido real en Chrome de
edición → expediente → recarga → nueva reserva. Ejecutar lint, tests y build.

## Decisiones arquitectónicas diferidas

No se modifican retrospectivamente atenciones cobradas o jornadas cerradas ni
se infiere un precio habitual individual a partir de traslados compartidos.
Los cambios de otras categorías de servicio requieren su propio alcance.
