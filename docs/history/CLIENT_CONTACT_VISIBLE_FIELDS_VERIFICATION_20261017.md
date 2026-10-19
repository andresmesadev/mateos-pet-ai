# Contacto principal visible y citas de mascotas

17 de octubre de 2026. [Diseño previo en cinco etapas](../architecture/client-contact-visible-fields-20261017.md).

La ficha del propietario dice «Citas de sus mascotas» y «Abrir agenda de sus mascotas». Conserva el enlace filtrado por identificador del propietario para consultar las citas de todas sus mascotas y los nombres de mascota en cada cita.

Al editar, Contacto principal contiene nombre, teléfono principal, teléfono alternativo, correo, dirección y las notas autorizadas; no hay desplegable que oculte los opcionales. La distribución usa dos columnas cuando hay espacio y una en móvil. Nombre, teléfono alternativo, correo, dirección y notas conservan su opcionalidad; teléfono principal sigue obligatorio. No cambia el PATCH, los permisos ni la persistencia.

```text
ESLint client-sheet.tsx: exit_code 0
NEXT_VERIFY_BUILD=1 next build: exit_code 0; TypeScript correcto; 32 páginas
verify-onboarding-local.cjs --client-pet-names:
Onboarding integration: 12 passed, 0 failed
git diff --check: exit_code 0
```

Ensayo real Chrome/NextAuth/proxy/PostgreSQL: campos opcionales visibles dentro del grupo Contacto principal y sin atributo required; guardado con opcionales vacíos; segundo guardado con teléfono alternativo, correo, dirección y notas completos, comprobados directamente en la base temporal. Comprueba los textos nuevos y que el enlace conserve el identificador correcto. Mantiene las comprobaciones previas de nombres de mascotas y adaptación móvil. La búsqueda exhaustiva del texto anterior en código solo encuentra la aserción de ausencia del ensayo.

Captura de escritorio revisada: `.cache/onboarding-verification/24-client-primary-contact-desktop.png`; captura móvil en `23-client-primary-contact-mobile.png`. El escenario de formularios con fixtures se ajustó para esperar campos siempre visibles; su recorrido amplio no se volvió a ejecutar, sustituido para este cambio por el ensayo autenticado real anterior. No fue necesario repetir Jest de backend: ningún archivo backend cambió y el resultado previo del lote conserva 203 suites/1.659 pruebas aprobadas.

Las 57 migraciones existentes se aplicaron en PostgreSQL desechable y su contenedor fue eliminado. Sin cambios de datos reales, esquema, VPS ni mensajes externos. Sin commit/push/despliegue; versión declarada/productiva 2.49.0 y lote menor local candidato 2.50.0.
