class DomainEventPublisherPort {
  async publish(_eventName, _payload) { throw new Error("DomainEventPublisherPort.publish no implementado"); }
}
module.exports = { DomainEventPublisherPort };
