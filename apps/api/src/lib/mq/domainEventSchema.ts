import { createDomainEventParser } from '@daoyou/contracts/domainEvents';
import { DomainEventDataSchemas } from '@daoyou/game-rules/events';

export const parseDomainEventEnvelope = createDomainEventParser(
  DomainEventDataSchemas,
);
