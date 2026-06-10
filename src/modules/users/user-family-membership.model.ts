import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

import { familyMemberRoles, type FamilyMemberRole } from "./user.types.js";

export const familyMembershipStatuses = ["accepted", "removed"] as const;

export type FamilyMembershipStatus = (typeof familyMembershipStatuses)[number];

export type UserFamilyMembership = {
  _id: Types.ObjectId;
  requesterId: Types.ObjectId;
  recipientId: Types.ObjectId;
  pairKey: string;
  status: FamilyMembershipStatus;
  requesterRelationship?: string;
  recipientRelationship?: string;
  requesterRole: FamilyMemberRole;
  recipientRole: FamilyMemberRole;
  sourceInvitationId?: Types.ObjectId;
  acceptedAt?: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UserFamilyMembershipDocument = HydratedDocument<UserFamilyMembership>;

type UserFamilyMembershipModel = Model<UserFamilyMembership>;

const userFamilyMembershipSchema = new Schema<UserFamilyMembership, UserFamilyMembershipModel>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pairKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: familyMembershipStatuses,
      required: true,
      default: "accepted",
      index: true,
    },
    requesterRelationship: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    recipientRelationship: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    requesterRole: {
      type: String,
      enum: familyMemberRoles,
      required: true,
    },
    recipientRole: {
      type: String,
      enum: familyMemberRoles,
      required: true,
    },
    sourceInvitationId: {
      type: Schema.Types.ObjectId,
      ref: "UserFamilyInvitation",
    },
    acceptedAt: {
      type: Date,
    },
    removedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userFamilyMembershipSchema.index(
  { pairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "accepted" },
  },
);

export const UserFamilyMembershipModel =
  mongoose.models.UserFamilyMembership ??
  mongoose.model<UserFamilyMembership, UserFamilyMembershipModel>(
    "UserFamilyMembership",
    userFamilyMembershipSchema,
  );
