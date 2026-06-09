export const trustedContactStatuses = ["pending", "accepted", "declined", "removed"] as const;

export type TrustedContactStatus = (typeof trustedContactStatuses)[number];

export type TrustedContactAccessScope = {
  profile: boolean;
  documents: boolean;
  notes: boolean;
  messages: boolean;
  paymentInfo: boolean;
  accountTransfer: boolean;
};

export type PublicTrustedContact = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: TrustedContactStatus;
  inactivityDays: number;
  accessScope: TrustedContactAccessScope;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
};
