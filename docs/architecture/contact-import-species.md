# Especie de mascotas en la importación de contactos

Fecha: 2026-10-16. Corrección del importador solicitada para cargar la base revisada de la veterinaria.

Ampliación del 17 de octubre: `pet_N_with_transport_price` conserva el total individual con recogida/entrega; `pet_N_price` sigue siendo peluquería en centro. El backend valida ambos importes antes de escribir, admite cero explícito y rechaza total inferior a la base conocida. Diseño y pruebas actuales: [peluquería y transporte](grooming-transport-implementation.md), [verificación local](../history/GROOMING_TRANSPORT_VERIFICATION_20261017.md).

## 1. Definición funcional

La especie ya pertenece a Mascota en el modelo de dominio (§3) y existe como `Pet.type`. El importador completo descarta ese dato y crea todas las mascotas como `dog`. Corregir el adaptador evita convertir gatos en perros y la posterior revisión manual. Es mantenimiento del flujo existente, sin entidades ni reglas operativas nuevas.

## 2. Casos de uso y contrato

- Importar contactos con perros, gatos o ambos: cada mascota conserva su propia especie.
- Leer `pet_N_type` (alternativas `pet_N_species` y `pet_N_especie`) para las cinco posiciones existentes. Transmitirla como `pets[].type`.
- Aceptar perro/perra/canino y gato/gata/felino, sus plurales e identificadores `dog`/`cat`, sin distinguir mayúsculas ni espacios. Conservar la opción existente `other`/otro/otra. La raza o nombre no sustituyen una especie ausente en el software.
- Mostrar la especie en la vista previa y permitir elegir Perro, Gato u Otro antes de confirmar. Bloquear la confirmación mientras alguna mascota carezca de especie reconocida.
- Rechazar desde el servidor la solicitud completa con especie ausente o desconocida antes de cualquier escritura. No aplicar `dog` por defecto a archivos antiguos.
- Reimportar conserva la política existente de no modificar fichas de mascotas ya creadas. Esta corrección no reclasifica registros históricos.
- Conservar nombres agrupados tal como los revisó el equipo, tarifas, notas e historial. El adaptador no separa mascotas adicionales.

## 3. Arquitectura técnica

Extraer el lector CSV del componente a una utilidad pura verificable del frontend y añadir la columna de especie. El lector debe preservar saltos de línea y comillas escapadas conforme al archivo CSV, con coma o punto y coma como separador. La UI gestiona únicamente la revisión y la selección de especie.

El adaptador HTTP del backend normaliza el vocabulario externo y valida todas las mascotas con nombre antes del procesamiento de propietarios. Persiste el identificador canónico en la creación existente de mascotas. Se mantienen identidad autenticada y filtros por establecimiento.

Decisiones diferidas: corrección masiva de especies en fichas existentes y deduplicación adicional de propietarios/mascotas. No se implementan inferencias por raza en el software; las equivalencias de la copia de datos revisada son preparación específica autorizada por el responsable, no una regla del dominio.

## 4. Persistencia

Reutilizar `Pet.type` con valores `dog`, `cat` y `other`, ya usados por la interfaz. No alterar precios, citas, comisiones ni historiales existentes. Las visitas importadas conservan su procesamiento actual.

## 5. Esquema físico y validación

Sin cambio de schema ni migración. Pruebas del lector real y de POST `/api/dashboard/clients/import/full`: propietario con perro y gato, cinco posiciones, plural felinos, especie inválida/ausente sin escrituras, notas multilínea y comillas, no duplicación al reimportar e identidad del establecimiento. Ejecutar lint, tests y compilación del frontend. La publicación se incorpora al lote local autorizado; preparar el archivo no lo importa en producción.
