-- Existing event vocabulary; do not reactivate an administrator-disabled type.
INSERT INTO "EventType" (id,name,"originContext","payloadContractDescription",active,"createdAt") VALUES
 ('operational-type-task-start','TareaIniciada','Empleados Digitales','Tarea iniciada con contexto de establecimiento.',true,CURRENT_TIMESTAMP),
 ('operational-type-decision','DecisiónRegistrada','Empleados Digitales','Decisión auditada del empleado.',true,CURRENT_TIMESTAMP),
 ('operational-type-task-complete','TareaCompletada','Empleados Digitales','Resultado de atención de la tarea.',true,CURRENT_TIMESTAMP),
 ('operational-type-escalation','EscalaciónGenerada','Empleados Digitales','Escalación de una atención a revisión humana.',true,CURRENT_TIMESTAMP),
 ('operational-type-expense','GastoRegistrado','Finanzas','Gasto registrado por el caso de uso de Finanzas.',true,CURRENT_TIMESTAMP),
 ('operational-type-entry','EntradaDeInventarioRegistrada','Inventario','Entrada registrada con identidad de operación.',true,CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;
