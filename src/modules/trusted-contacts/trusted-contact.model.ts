import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

import {
  trustedContactStatuses,
  type TrustedContactAccessScope,
  type TrustedContactStatus,
} from "./trusted-contact.types.js";

export type TrustedContact = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  status: TrustedContactStatus;
  inactivityDays: number;
  accessScope: TrustedContactAccessScope;
  inviteTokenHash?: string;
  inviteTokenExpiresAt?: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type TrustedContactDocument = HydratedDocument<TrustedContact>;

type TrustedContactModel = Model<TrustedContact>;

const accessScopeSchema = new Schema<TrustedContactAccessScope>(
  {
    profile: { type: Boolean, required: true, default: true },
    documents: { type: Boolean, required: true, default: false },
    notes: { type: Boolean, required: true, default: false },
    messages: { type: Boolean, required: true, default: false },
    paymentInfo: { type: Boolean, required: true, default: false },
    accountTransfer: { type: Boolean, required: true, default: false },
  },
  {
    _id: false,
  },
);

const trustedContactSchema = new Schema<TrustedContact, TrustedContactModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    status: {
      type: String,
      enum: trustedContactStatuses,
      required: true,
      default: "pending",
      index: true,
    },
    inactivityDays: {
      type: Number,
      required: true,
      min: 30,
      max: 365,
    },
    accessScope: {
      type: accessScopeSchema,
      required: true,
      default: () => ({
        profile: true,
        documents: false,
        notes: false,
        messages: false,
        paymentInfo: false,
        accountTransfer: false,
      }),
    },
    inviteTokenHash: {
      type: String,
      select: false,
    },
    inviteTokenExpiresAt: {
      type: Date,
      select: false,
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

trustedContactSchema.index({ userId: 1, email: 1 });

export const TrustedContactModel =
  mongoose.models.TrustedContact ??
  mongoose.model<TrustedContact, TrustedContactModel>("TrustedContact", trustedContactSchema);
