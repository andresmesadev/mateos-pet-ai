# Revisión de alcance: operación en la veterinaria propia

**Borrador documental preparado el 16/10; alcance actualizado el 22/10/2026.**
El responsable confirmó operación real desde el lunes 19/10: clientes, citas de
peluquería y veterinaria, venta de medicamentos y pagos. Este documento recoge
decisiones documentales aún por completar; no significa que la base activa sea
ficticia ni que la operación no haya empezado. No reemplaza el paquete histórico
1.1 ni afirma firmas, autorizaciones o cumplimiento no comprobados.

**Áreas actualmente utilizadas, confirmadas por el responsable:** clientes,
agenda de peluquería/veterinaria, medicamentos/inventario y pagos. El aplazamiento
de caja/inventario fue una decisión inicial histórica y ya no describe el alcance.
La historia clínica de la consulta revisada se conserva en el registro habitual;
agendar/cobrar esa consulta no acredita por sí solo el uso de historia digital.

**Canal de arranque confirmado:** solo dashboard; WhatsApp bloqueado y sin credenciales operativas. El historial anterior se conserva en archivo separado en solo lectura y respaldos, sin copiar clientes o conversaciones a la base activa nueva. Revisar conservación y acceso a ese archivo según el procedimiento existente; este cambio no afirma haber suprimido sus datos ni haber informado a titulares.

## Identificación y entrega

Reutilizar la identidad y contactos que el responsable ya proporcionó en la copia privada de `.cache/private/legal/`; no volver a publicarlos ni pedirlos por chat. Confirmar si esa persona actúa en nombre propio o si la operación real requiere identificar otro responsable. Conservar por separado el historial 1.1 y este borrador.

El responsable revisa y completa los puntos siguientes para documentar el alcance
real ya utilizado. Si la veterinaria ya informa a sus clientes mediante documentos
vigentes, contrastarlos y preparar los ajustes aplicables; no solicitar una nueva
autorización genérica por defecto ni presentar este anexo como formulario aceptado
por ellos.

| Punto que debe decidirse | Registro en la copia privada |
| --- | --- |
| Alcance de la primera jornada | Áreas, personas, inicio y categorías reales permitidas, coherentes con el acta operativa |
| Finalidades | Atención/reserva, comunicación, registro financiero e inventario según áreas; separar comunicaciones comerciales |
| Categorías y personas | Datos de propietarios/contactos, personal/credenciales, citas/mensajes y datos vinculados a mascotas; limitar a lo necesario |
| Acceso del equipo | Perfil, propósito, quién concede/revoca y cuentas individuales; no compartir login administrativo |
| Proveedores y circulación | Oracle Cloud, Meta, OpenAI y cualquier otro efectivamente habilitado; revisar contratos, información enviada, ubicaciones y opciones del proveedor antes de afirmar condiciones |
| Conservación por finalidad | Plazo y fundamento por categoría, base activa, mensajes/payloads, auditoría, copias y proveedores; no extender automáticamente los treinta días del ensayo ficticio |
| Información y decisiones del titular | Medio privado accesible, versión y evidencia de entrega/decisiones que correspondan; distinguir uso del servicio de autorización para campañas |
| Atención de derechos | Canal y suplente ya identificados, verificación proporcional, alcance de búsqueda, respuesta y gestión de excepciones |
| Incidentes / salida del piloto | Responsable, escalamiento, restricción de accesos, revisión de comunicaciones y destino de datos/copias |

## Actualización del procedimiento manual

Aplicar el [procedimiento de privacidad existente](procedimiento-privacidad-piloto.md) al alcance que se apruebe, incluyendo las tablas nuevas de solicitudes/revisiones/recibos y sesiones/vínculos de operadores cuando existan. No eliminar un establecimiento entero para atender a una persona ni desactivar restricciones de auditoría.

Para cada solicitud, localizar datos del titular y establecimiento en entidades y payloads, registrar qué se corrige, suprime, restringe o conserva y su fundamento. Ante una limitación técnica, abrir una acción acotada y responder según el procedimiento; la inmutabilidad no acredita por sí sola que deban conservarse datos personales.

Antes de volver a operar desde un respaldo, contrastar el registro privado de solicitudes resueltas y reaplicarlas cuando corresponda. El ensayo técnico usa una base aislada; nunca envía mensajes, inicia workers o habilita vínculos reales desde la copia restaurada.

## Lista de aprobación previa

- [ ] Responsable revisó los puntos y el alcance concreto; obtuvo revisión especializada si resulta necesaria.
- [ ] Copias completas accesibles y evidencias guardadas privadamente, sin secretos ni datos personales en Git.
- [ ] Equipo conoce permisos, atención humana y canal de privacidad.
- [ ] Conservación, proveedores y gestión de copias están definidos para la operación real.
- [ ] Consta fecha, versión y decisión del responsable; si falta un punto, mantener fuera los datos/áreas afectados.

No habilita campañas, clientes de otras veterinarias, integradores externos, atención clínica autónoma ni activación del canal privado de WhatsApp. Las condiciones de cada ampliación se revisan por separado.
