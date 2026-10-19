# Modalidad habitual de llegada en la ficha de mascota

1. Definición funcional: el responsable solicita editar desde la ficha si la mascota llega al centro o requiere recogida/entrega. Se muestra junto a Peluquería y domicilio.
2. Caso de uso: un operador con el permiso vigente de precios de mascota consulta y guarda la modalidad habitual. Valores cerrados: none, round_trip, pickup, delivery. Mascotas anteriores comienzan sin modalidad indicada; no se deduce a partir del precio ni del historial.
3. Arquitectura: reutilizar el adaptador autenticado grooming-prices y su aislamiento por tenant. Clientes anteriores que omiten mode conservan el dato. La preferencia es informativa de la mascota: no actualiza citas, tarifas, cobros o comisiones; cada cita conserva su modalidad propia.
4. Persistencia: atributo opcional en Pet. Sin entidad nueva, sin reutilizar notas ni dirección como almacenamiento encubierto.
5. Esquema físico: Pet.defaultGroomingTransportMode TEXT nullable, CHECK con vocabulario cerrado. Migración aditiva sin backfill inferido. Regenerar Prisma y validar guardado, recuperación, aislamiento y compatibilidad del contrato anterior.
