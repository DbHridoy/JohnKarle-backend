import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

export const auditActorTypes = ["user", "trusted_contact", "system", "admin"] as const;

export type AuditActorType = (typeof auditActorTypes)[number];

export type AuditLog = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorType: AuditActorType;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLogDocument = HydratedDocument<AuditLog>;

type AuditLogModel = Model<AuditLog>;

const auditLogSchema = new Schema<AuditLog, AuditLogModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    actorType: {
      type: String,
      enum: auditActorTypes,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      required: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLogModel =
  mongoose.models.AuditLog ?? mongoose.model<AuditLog, AuditLogModel>("AuditLog", auditLogSchema);
