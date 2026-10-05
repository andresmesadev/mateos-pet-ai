-- Reutiliza el catálogo global de eventos y el certificador existente.
INSERT INTO "EventType" (id, name, "originContext", "payloadContractDescription", active, "createdAt") VALUES
('inventory-event-product-created','ProductoRegistrado','Inventario','tenantId, operationId, kind',true,now()),
('inventory-event-product-updated','ProductoActualizado','Inventario','tenantId, operationId, kind',true,now()),
('inventory-event-entry','EntradaDeInventarioRegistrada','Inventario','tenantId, operationId, kind',true,now()),
('inventory-event-adjustment','AjusteDeInventarioRegistrado','Inventario','tenantId, operationId, kind',true,now()),
('inventory-event-consumption','ConsumoDeInventarioRegistrado','Inventario','tenantId, operationId, kind',true,now()),
('inventory-event-consumption-correction','ConsumoDeInventarioCorregido','Inventario','tenantId, operationId, kind',true,now()),
('inventory-event-sale','SalidaPorVentaRegistrada','Inventario','tenantId, operationId, kind',true,now()),
('inventory-event-return','DevolucionDeInventarioRegistrada','Inventario','tenantId, operationId, kind',true,now())
ON CONFLICT (name) DO NOTHING;
