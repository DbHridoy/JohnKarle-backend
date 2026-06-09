import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

import { familyMemberRoles, type FamilyMemberRole } from "./user.types.js";

export const familyInvitationStatuses = ["pending", "accepted", "expired", "cancelled"] as const;

export type FamilyInvitationStatus = (typeof familyInvitationStatuses)[number];

export type UserFamilyInvitation = {
  _id: Types.ObjectId;
  inviterId: Types.ObjectId;
  inviteeUserId?: Types.ObjectId;
  inviteeName: string;
  inviteeEmail: string;
  relation: string;
  role: FamilyMemberRole;
  tokenHash: string;
  expiresAt: Date;
  status: FamilyInvitationStatus;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UserFamilyInvitationDocument = HydratedDocument<UserFamilyInvitation>;

type UserFamilyInvitationModel = Model<UserFamilyInvitation>;

const userFamilyInvitationSchema = new Schema<UserFamilyInvitation, UserFamilyInvitationModel>(
  {
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    inviteeUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    inviteeName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    inviteeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    relation: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 50,
    },
    role: {
      type: String,
      enum: familyMemberRoles,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: familyInvitationStatuses,
      required: true,
      default: "pending",
      index: true,
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

userFamilyInvitationSchema.index({ inviterId: 1, inviteeEmail: 1, status: 1 });

export const UserFamilyInvitationModel =
  mongoose.models.UserFamilyInvitation ??
  mongoose.model<UserFamilyInvitation, UserFamilyInvitationModel>(
    "UserFamilyInvitation",
    userFamilyInvitationSchema,
  );
