import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

import {
  legacyAccessRequestStatuses,
  type LegacyAccessRequestStatus,
} from "./legacy-access.types.js";

export type LegacyAccessRequest = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  trustedContactId: Types.ObjectId;
  status: LegacyAccessRequestStatus;
  triggeredAt: Date;
  unlockAt: Date;
  expiresAt: Date;
  cancelledAt?: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type LegacyAccessRequestDocument = HydratedDocument<LegacyAccessRequest>;

type LegacyAccessRequestModel = Model<LegacyAccessRequest>;

const legacyAccessRequestSchema = new Schema<LegacyAccessRequest, LegacyAccessRequestModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    trustedContactId: {
      type: Schema.Types.ObjectId,
      ref: "TrustedContact",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: legacyAccessRequestStatuses,
      required: true,
      index: true,
    },
    triggeredAt: {
      type: Date,
      required: true,
    },
    unlockAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    cancelledAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

legacyAccessRequestSchema.index({ userId: 1, trustedContactId: 1, status: 1 });
legacyAccessRequestSchema.index({ status: 1, expiresAt: 1 });

export const LegacyAccessRequestModel =
  mongoose.models.LegacyAccessRequest ??
  mongoose.model<LegacyAccessRequest, LegacyAccessRequestModel>(
    "LegacyAccessRequest",
    legacyAccessRequestSchema,
  );
