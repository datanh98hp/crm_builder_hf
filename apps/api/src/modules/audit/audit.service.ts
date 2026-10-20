import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  correlationId?: string;
  /** Must never contain secrets, tokens, or sensitive financial payloads. */
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  record(entry: AuditEntry) {
    return this.prisma.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null } });
  }
}
