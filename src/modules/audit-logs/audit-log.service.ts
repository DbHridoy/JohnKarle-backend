import { AuditLogModel, type AuditActorType } from "./audit-log.model.js";

export type AuditLogInput = {
  userId: string;
  actorId?: string;
  actorType: AuditActorType;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export const createAuditLog = async (input: AuditLogInput): Promise<void> => {
  await AuditLogModel.create({
    action: input.action,
    actorId: input.actorId,
    actorType: input.actorType,
    ipAddress: input.ipAddress,
    metadata: input.metadata ?? {},
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    targetType: input.targetType,
    userAgent: input.userAgent,
    userId: input.userId,
  });
};
