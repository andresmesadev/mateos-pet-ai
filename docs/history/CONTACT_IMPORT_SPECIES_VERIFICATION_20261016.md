# Importación de contactos con especie: verificación local

Fecha: 2026-10-16. [Contrato y alcance](../architecture/contact-import-species.md).

## Resultado

El importador acepta la especie de cada mascota y la transmite a `Pet.type`; deja de crear todas las mascotas como perro. La vista previa permite revisar o elegir Perro, Gato u Otro en todas las filas, incluidas las posteriores a la posición 50. El servidor rechaza el lote completo si falta una especie reconocida antes de consultar o escribir propietarios, mascotas o visitas.

Se comprobó un mismo propietario con perro y gata, alias españoles e ingleses, rechazo de valores no reconocidos, conservación de notas/precios/visitas, reimportación sin repetir la mascota ni sus visitas e identidad de establecimiento. El lector conserva notas multilínea, comillas escapadas y separadores de coma o punto y coma.

## Evidencia ejecutada

Con Node 24.19.0 del runtime incluido:

```text
node --disable-warning=ExperimentalWarning --test scripts/contact-import-species.test.cjs
tests 7
pass 7
fail 0
```

Backend, desde `backend/`:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/__tests__/integration/contact-import-species.test.js
Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total

node node_modules/jest/bin/jest.js --runInBand --silent
Test Suites: 197 passed, 197 total
Tests:       1599 passed, 1599 total
Snapshots:   0 total
Time:        58.206 s
```

Frontend, desde `frontend/`:

```text
node node_modules/eslint/bin/eslint.js .
Exit code: 0. Sin avisos ni errores.

node node_modules/next/dist/bin/next build
Compiled successfully in 2.2s
Finished TypeScript in 16.2s
Generating static pages using 11 workers (32/32)
Exit code: 0
```

La primera compilación sin acceso de red falló al descargar Geist de Google Fonts. Se repitió con permiso de red, sin modificar fuentes ni código de la aplicación; el segundo build terminó correctamente.

## Archivo de importación

Preparación privada local, fuera de Git, de una nueva copia del archivo revisado: 291 registros, 17 columnas, 304 campos de mascota con nombre: 277 `dog` y 27 `cat`. Las cifras describen fichas y no animales individuales, porque se conservaron los nombres agrupados solicitados por el responsable.

La primera comprobación anterior identificaba solo 15 contactos con texto explícito de especie. La clasificación final también usa razas felinas y las segundas mascotas ya separadas, por lo que esos 15 contactos no representan el total final de fichas felinas. Se aplica la confirmación del responsable: Criollo corresponde a perro. La segunda mascota sin raza revisada se clasifica con la raza Yorkshire del registro original conjunto, manteniendo vacía su raza en la copia revisada.

El lector de producción actualizado y el modelo de Artifact Tool compararon 4.964 celdas. Resultado real:

```json
{"result":"PASS","records":291,"columns":17,"petFields":{"dog":277,"cat":27},"comparedCells":4964,"sourceUnchanged":true,"namesAndGroupsPreserved":true,"applicationParser":"PASS","databaseWrites":0}
```

SHA-256 del archivo revisado de origen: `85f271610a7a81baa7931b0da0a68a47de3d3c50df08e9ea2e62e531d571f564`.

SHA-256 de la nueva copia con especies: `8cab77ed74f1955477123ad11d60421dd2c665ad4e13ef50180d7d39b226d3b0`.

## Continuación del 17 de octubre: dos tarifas y cierre financiero

La copia de etapa 7 sustituye a la anterior para importar después del despliegue: 291 registros y 19 columnas, incorporando el total pactado con recogida/entrega por mascota sin alterar el origen. La validación de 5.548 celdas conserva 277 campos de perro y 27 de gato, nombres y grupos. La [verificación de peluquería y transporte](GROOMING_TRANSPORT_VERIFICATION_20261017.md) documenta los importes inequívocos, los cuatro totales sin desglose, las pruebas actuales y los límites. Ninguna copia real se ha cargado en la aplicación.

## Límites y publicación

- Las pruebas HTTP usan dobles de Prisma y comprueban los valores que se envían a persistencia. No constituyen una carga real en PostgreSQL.
- La comparación del archivo es local y no escribe clientes ni mascotas. No se han importado datos personales en local ni en la VPS.
- No se han reclasificado mascotas existentes ni aplicado migraciones. El importador conserva su política previa de no sobrescribir fichas existentes.
- Corrección implementada y verificada en local, pendiente del commit y despliegue del lote de mejoras acordado. El archivo con especies requiere ese despliegue antes de cargarlo desde la web productiva.
- Versión evaluada: no se crea un tag ni se modifica la versión productiva 2.49.0 en esta verificación local. El versionado del conjunto se resuelve antes del commit final y publicación del lote, que incluye la mejora funcional de permisos del equipo.
