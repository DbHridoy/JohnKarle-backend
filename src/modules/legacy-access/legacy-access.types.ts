import type { PublicUser } from "../users/user.types.js";
import type { PublicMemoryVaultItem } from "../memory-vault/memory-vault.types.js";
import type { PublicTrustedContact } from "../trusted-contacts/trusted-contact.types.js";

export const legacyAccessRequestStatuses = [
  "waiting_period",
  "approved",
  "cancelled",
  "expired",
] as const;

export type LegacyAccessRequestStatus = (typeof legacyAccessRequestStatuses)[number];

export type PublicLegacyAccessRequest = {
  id: string;
  userId: string;
  trustedContactId: string;
  trustedContact: Pick<PublicTrustedContact, "id" | "name" | "email" | "status" | "accessScope">;
  status: LegacyAccessRequestStatus;
  triggeredAt: string;
  unlockAt: string;
  expiresAt: string;
  cancelledAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LegacyAccessData = {
  request: Pick<
    PublicLegacyAccessRequest,
    "id" | "status" | "triggeredAt" | "unlockAt" | "approvedAt"
  >;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  accessScope: PublicTrustedContact["accessScope"];
  profile?: PublicUser;
  documents?: PublicMemoryVaultItem[];
  notes?: PublicMemoryVaultItem[];
  messages?: never[];
};
