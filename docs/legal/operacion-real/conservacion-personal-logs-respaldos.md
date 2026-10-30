# Conservación de personal, registros técnicos y copias

**Propuesta del 27/10/2026 para el ítem 7.** Completa criterios de la matriz.
**Decisión posterior:** Andrés aceptó los criterios presentados y confirmó
revisión de política/condiciones por Lina. La aceptación documental no acredita
aplicación técnica de purgas. La propuesta original que sigue
no acredita aprobación de Lina ni implanta tareas de eliminación. Las cifras
de treinta y noventa días siguientes son propuestas operativas, no plazos
ordenados por una ley. No cambia el criterio ya indicado por Andrés: no borrar
clientes o fichas por pasar uno, dos o más años sin visitas.

## Fundamento y límites

El artículo 2.2.2.25.2.8 del Decreto 1074 exige un tiempo razonable y necesario
según finalidad y aspectos administrativos, contables, fiscales, jurídicos e
históricos. Al agotarse la finalidad sin obligación de conservar, procede la
supresión; hay que documentar procedimientos y excepciones. No establece un
número único de días para todos los logs o respaldos. [Compilación oficial](https://normativa.colpensiones.gov.co/colpens/docs/decreto_1074_2015_pr025.htm).

El artículo 2.2.4.6.13 del Decreto 1072 fija al menos veinte años desde el cese
de la relación laboral para los documentos enumerados de SG-SST: determinados
registros de salud ocupacional y vigilancia, mediciones ambientales, formación
y suministro de elementos de protección. La historia ocupacional tiene custodia
especial. Esa regla no equivale a guardar todo perfil, contraseña o log durante
veinte años. Los demás documentos requieren un sistema de archivo aplicable.
[Compilación oficial, artículo 2.2.4.6.13](https://normativa.colpensiones.gov.co/colpensiones/docs/decreto_1072_2015_pr009.htm).

La reserva subsiste incluso al terminar la relación de quien trata los datos.
No vence al cabo del plazo de un acuerdo de confidencialidad. [Ley 1581,
artículo 4](https://normograma.dian.gov.co/dian/compilacion/docs/ley_1581_2012.htm).
Para soportes financieros rige la [revisión comercial y tributaria separada](conservacion-financiera-colombia.md).

## Qué existe y qué se propone

| Categoría | Criterio propuesto | Límite y acción |
| --- | --- | --- |
| Perfil profesional y contrato | Mantener durante la vinculación; al salir, conservar solo lo necesario para servicios realizados, certificaciones, pagos, obligaciones y reclamaciones. Identificar el expediente y norma aplicable antes de fijar su vencimiento. | Desactivar el acceso al terminar la autorización; no borrar autoría o comisiones. El campo «tipo de contrato» del software no acredita por sí solo la naturaleza jurídica real de la relación. |
| Pagos/comisiones del profesional | Conservar soportes según criterio financiero, incluida su identificación necesaria. | No extender ese plazo a todos sus datos de contacto o credenciales. Correcciones de comisión por anulación y nuevo registro. |
| Credenciales y sesiones | Acceso únicamente mientras esté autorizado; revocar sesiones al retiro o cambio que corresponda. | Expirar una sesión no borra su fila. No conservar contraseñas anteriores ni copiar hashes/tokens a documentos. Separar evidencia mínima de acceso de secretos reutilizables. |
| SG-SST y documentos laborales externos | Identificar con quien lleva los contratos y SG-SST cuáles documentos tienen reglas especiales; mantenerlos en su custodia correspondiente. | El dashboard examinado no es un archivo completo de nómina, pensiones ni salud ocupacional. No importar esos expedientes para completar este ítem. No aplicar un plazo corto universal a pruebas laborales o pensionales. |
| Logs técnicos ordinarios | Treinta días desde el evento, para diagnóstico y comparación de fallos recientes. | Propuesta pendiente de adopción e implementación. No incluye auditoría financiera, historias ni evidencias de incidentes abiertos. |
| Auditoría técnica de acceso sin obligación especial | Noventa días desde el evento, para investigar accesos y patrones con más margen que los logs ordinarios. | Evaluar dependencias y necesidad antes de retirar datos. Una auditoría que sustente un cobro/corrección sigue el criterio de ese soporte financiero. |
| Capturas/exportaciones temporales de soporte | Hasta treinta días desde resolución verificada del caso. | Antes de suprimir la copia de trabajo, conservar solo la evidencia mínima necesaria en el expediente del caso. Si sigue abierto o hay reclamación, registrar motivo y nueva revisión. |
| Respaldo cifrado VPS | Mantener rotación técnica existente de catorce días. | Es una ventana de recuperación, no el plazo del archivo financiero ni de las fichas de mascotas. |
| Respaldo cifrado local independiente | Treinta días desde la fecha de creación del respaldo, conservando al menos dos conjuntos íntegros de fechas distintas. | Revisión manual propuesta; no eliminar si falla la copia reciente, hay incidente abierto o la única copia recuperable quedaría comprometida. Registrar excepción y próxima revisión. |

Antes de cualquier depuración se genera un inventario concreto de candidatos,
se verifica su categoría, las excepciones, las dependencias y la recuperación;
se registra qué se retira y con qué fundamento. Esta propuesta no autoriza
ejecutar ahora esa depuración ni alterar tablas inmutables.

## Evidencia técnica local

Revisión de fuentes y metadatos, sin consultar filas de clientes ni descifrar
respaldos:

- `Staff` contiene identidad/contacto, rol, permisos, disponibilidad y acuerdo
  porcentual; `StaffCredential` contiene hash, estado y versión de sesión.
  Son datos distintos de un expediente contractual o de SG-SST completo.
- `ClientSession` y `OperatorSession` tienen vencimientos; la búsqueda acotada
  en fuentes examinadas no acredita un ciclo general de purga de sesiones o
  auditorías. La expiración de acceso no prueba eliminación de datos.
- El Compose del repositorio no declara `max-size`/`max-file` para logs. No se
  comprobó la configuración efectiva del daemon Docker o journald de producción
  en esta revisión: no afirmar que ya retienen treinta días.
- `backup-database.sh` tiene rotación de catorce días. El copiador local verifica
  metadatos/checksum antes de publicar el conjunto y no tiene un ciclo general
  de eliminación de copias ya publicadas. Su limpieza de staging no equivale a
  retención del archivo local.
- Corte local: 65 conjuntos cifrados, 33.845.639 bytes en el directorio revisado
  (aproximadamente 34 MB). Los 65 superaron `verifySet` de metadatos y checksum,
  sin descifrarlos ni modificarlos. Esto no sustituye un ensayo de restauración
  ni prueba antigüedad de copia menor de una hora en todo momento.

## Fichas, archivo anterior y Excel/papel

La ficha de mascota vinculada al cliente conserva el criterio de continuidad
de atención ya acordado, sin vencimiento por inactividad. El centro mantiene
su registro clínico habitual; su custodia y obligaciones profesionales no se
confunden con la agenda o el comprobante de cobro. No se trasladan plazos de
historias clínicas humanas automáticamente a registros veterinarios.

Clasificar el archivo anterior y Excel/papel por contenido: atención,
finanzas, personal o copia de trabajo. Un soporte único sigue el criterio de
su categoría. Una copia duplicada solo puede proponerse para retirar cuando
su conciliación, exactitud, cobertura y recuperación estén comprobadas; para
copias de trabajo se propone revisión a treinta días de esa comprobación.
No destruir ahora archivos históricos ni el Excel usado para continuidad.

## Custodia y decisión pendiente

Propuesta: Lina decide finalidad y excepciones de conservación; Andrés realiza
la custodia técnica y deja evidencia privada. Quien lleve contabilidad,
contratos y SG-SST contrasta obligaciones de los expedientes correspondientes.
No se les atribuye una revisión que no han realizado.

Falta adoptar o ajustar los plazos propuestos y comprobar el ciclo técnico
real antes de declararlo aplicado. La política 1.0 aprobada permanece preservada;
esta propuesta no se considera aprobación del paquete 1.1 ni cierre del ítem 7.
