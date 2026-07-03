/**
 * DomainEventDispatcher — Entregable Puente (Etapa 3).
 * Bus de eventos de dominio in-process. En esta fase la entrega es síncrona y
 * secuencial, dentro de la misma transacción lógica del comando que publica
 * (decisión de la Etapa 2): si un handler lanza, todo hace rollback.
 * Su posible evolución asíncrona queda fuera del alcance de este entregable;
 * esta clase es la costura donde ocurriría, sin cambiar contratos.
 */
class DomainEventDispatcher {
  constructor() {
    this.handlers = new Map();
  }

  subscribe(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName).push(handler);
  }

  /**
   * @param {string} eventName
   * @param {Object} payload
   * @param {Object} [ctx] — contexto de la Unidad de Trabajo (opaco para el dominio)
   */
  async publish(eventName, payload, ctx) {
    const handlers = this.handlers.get(eventName) ?? [];
    for (const handler of handlers) {
      await handler(payload, ctx);
    }
  }
}

module.exports = { DomainEventDispatcher };
