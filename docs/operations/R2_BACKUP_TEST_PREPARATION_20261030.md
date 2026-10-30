# Preparación de la prueba de respaldo independiente R2

**Fecha:** 30/10/2026. **Estado:** medición completada; prueba externa pendiente
por denegación de acceso del navegador a Cloudflare. No hay transferencia,
bucket, credencial nueva, tarea periódica ni eliminación de respaldos.

## Medición real, sin leer los datos del dump

Lectura por SSH de nombres y tamaños en `/var/backups/mateos-pet-ai`:

| Medida | Resultado |
| --- | --- |
| Conjuntos cifrados encontrados | 228 |
| Suma de `database.dump.age` | 122.142.847 bytes |
| Conjunto más reciente | `mateos-pet-ai-20261030T183008Z` |
| Tamaño más reciente y máximo observado | 553.427 bytes |

La propuesta conserva hasta 96 copias semihorarias recientes, 30 diarias y
tres mensuales: cota conservadora de 129 conjuntos, antes de descontar los que
coinciden en varias categorías. Con el máximo actual observado son 71.392.083
bytes, aproximadamente 72 MB decimales. No incluye manifests/checksums ni
crecimiento futuro, archivos de aplicación o un segundo conjunto de prueba.
No es una garantía de costo cero ni una política de borrado ya aplicada.

## Prueba concreta pendiente

1. Comprobar acceso y condiciones de R2 en la cuenta elegida de Huella Nex;
   detenerse si se requiere contratar cargos o aceptar condiciones nuevas.
2. Preparar un destino privado de prueba y acceso mínimo para ese destino;
   guardar secretos fuera de Git y del navegador del aplicativo.
3. Verificar checksum local del conjunto cifrado elegido, subir dump cifrado,
   manifest y checksum; nunca subir clave privada de descifrado.
4. Descargar desde R2 y comparar checksum, no limitarse a comprobar que exista
   un objeto con el mismo nombre o tamaño.
5. Ensayar restauración aislada y comparar integridad. No restaurar sobre la
   base activa. Custodia de claves y reconstrucción de la aplicación se evalúan
   aparte del almacenamiento de dumps.
6. Simular el plan de retención sin borrar. La programación y limpieza real se
   habilitan solo tras verificar la recuperación y delimitar el prefijo propio.

## Bloqueo observado

Al intentar abrir `https://dash.cloudflare.com/`, el control de seguridad del
navegador rechazó la acción indicando permiso denegado por el usuario. No se
intentaron otros navegadores, llamadas directas ni rutas alternativas para
eludirlo. Falta habilitar acceso a ese destino para continuar con la cuenta.
No se solicitaron contraseñas ni códigos por el chat.
