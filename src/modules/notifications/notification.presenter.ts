import type { NotificationDocument } from "./notification.model.js";
import type { PublicNotification } from "./notification.types.js";

type NotificationLike = Pick<
  NotificationDocument,
  "_id" | "type" | "title" | "message" | "data" | "isRead" | "priority" | "createdAt" | "updatedAt"
> & {
  actor?: { toString(): string } | null;
  readAt?: Date | null;
  expiresAt?: Date | null;
};

export const toPublicNotification = (notification: NotificationLike): PublicNotification => ({
  id: notification._id.toString(),
  ...(notification.actor ? { actorId: notification.actor.toString() } : {}),
  type: notification.type,
  title: notification.title,
  message: notification.message,
  ...(notification.data ? { data: notification.data } : {}),
  isRead: notification.isRead,
  ...(notification.readAt ? { readAt: notification.readAt.toISOString() } : {}),
  priority: notification.priority,
  ...(notification.expiresAt ? { expiresAt: notification.expiresAt.toISOString() } : {}),
  createdAt: notification.createdAt.toISOString(),
  updatedAt: notification.updatedAt.toISOString(),
});
