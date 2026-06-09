import type { LegacyAccessRequestDocument } from "./legacy-access.model.js";
import type { TrustedContactDocument } from "../trusted-contacts/trusted-contact.model.js";
import type { PublicLegacyAccessRequest } from "./legacy-access.types.js";

export const toPublicLegacyAccessRequest = (
  request: LegacyAccessRequestDocument,
  trustedContact: TrustedContactDocument,
): PublicLegacyAccessRequest => ({
  id: request._id.toString(),
  userId: request.userId.toString(),
  trustedContactId: request.trustedContactId.toString(),
  trustedContact: {
    id: trustedContact._id.toString(),
    name: trustedContact.name,
    email: trustedContact.email,
    status: trustedContact.status,
    accessScope: trustedContact.accessScope,
  },
  status: request.status,
  triggeredAt: request.triggeredAt.toISOString(),
  unlockAt: request.unlockAt.toISOString(),
  expiresAt: request.expiresAt.toISOString(),
  ...(request.cancelledAt ? { cancelledAt: request.cancelledAt.toISOString() } : {}),
  ...(request.approvedAt ? { approvedAt: request.approvedAt.toISOString() } : {}),
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
});
