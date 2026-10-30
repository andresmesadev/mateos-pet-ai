const { processIncomingMessage } = require("../../../../services/whatsapp.service");
const { ConversationalEngineAdapterPort } = require("../../application/ports/conversational-engine-adapter.port");
const { parseIncomingMessage } = require('../../../../services/whatsapp.service');
const { receiver } = require('../../../../services/whatsapp-route.service');
const { runProviderScope, providerScope, routeSnapshot } = require('../../../../lib/provider-execution');

/**
 * Satisface ConversationalEngineAdapterPort delegando exclusivamente en el
 * motor conversacional existente (whatsapp.service.js) — sin modificarlo
 * (Etapa 1, Decisión 3; Etapa 3, sección 1).
 */
class LegacyWhatsappEngineAdapter extends ConversationalEngineAdapterPort {
  async processIncomingMessage(body) {
    const parsed = parseIncomingMessage(body);
    const entry = body?.entry?.find(e => e.changes?.some(c => c.value?.metadata?.phone_number_id === parsed?.phoneNumberId));
    const scope = providerScope();
    const route = await receiver(parsed?.phoneNumberId, entry?.id ?? null, scope?.whatsapp ? routeSnapshot(scope.whatsapp) : null);
    if (!route || (scope && scope.tenantId !== route.tenantId)) return { processed: false, reason: 'whatsapp_route_unavailable' };
    return runProviderScope({ tenantId: route.tenantId, whatsapp: route }, () => processIncomingMessage(body));
  }
}

module.exports = { LegacyWhatsappEngineAdapter };
