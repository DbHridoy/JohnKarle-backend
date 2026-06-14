export const notificationTypes = [
  "family_invitation_received",
  "family_invitation_accepted",
  "trusted_contact_invitation_received",
  "trusted_contact_invitation_accepted",
  "legacy_access_request_created",
  "legacy_access_request_approved",
  "legacy_access_request_rejected",
  "memory_shared",
  "admin_broadcast",
  "system",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const notificationPriorities = ["low", "normal", "high"] as const;

export type NotificationPriority = (typeof notificationPriorities)[number];

export type PublicNotification = {
  id: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  priority: NotificationPriority;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};
