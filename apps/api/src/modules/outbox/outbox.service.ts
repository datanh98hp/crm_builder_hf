import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface OutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId?: string;
  payload: Prisma.InputJsonValue;
  schemaVersion?: number;
}

@Injectable()
export class OutboxService {
  /**
   * Must be called with the transaction client so the event commits atomically
   * with the business record. Dispatching (webhook worker) is a later increment.
   */
  enqueue(tx: Prisma.TransactionClient, e: OutboxEventInput) {
    return tx.outboxEvent.create({
      data: {
        eventType: e.eventType,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        correlationId: e.correlationId,
        payload: e.payload,
        schemaVersion: e.schemaVersion ?? 1,
      },
    });
  }
}
