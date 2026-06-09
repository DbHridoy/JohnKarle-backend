import type { TrustedContactDocument } from "./trusted-contact.model.js";
import type { PublicTrustedContact } from "./trusted-contact.types.js";

export const toPublicTrustedContact = (
  trustedContact: TrustedContactDocument,
): PublicTrustedContact => ({
  id: trustedContact._id.toString(),
  name: trustedContact.name,
  email: trustedContact.email,
  ...(trustedContact.phone ? { phone: trustedContact.phone } : {}),
  status: trustedContact.status,
  inactivityDays: trustedContact.inactivityDays,
  accessScope: trustedContact.accessScope,
  ...(trustedContact.acceptedAt ? { acceptedAt: trustedContact.acceptedAt.toISOString() } : {}),
  createdAt: trustedContact.createdAt.toISOString(),
  updatedAt: trustedContact.updatedAt.toISOString(),
});
