import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

import {
  familyMemberRoles,
  type FamilyMember,
  type UserPreferences,
  type UserProfilePicture,
  userRoles,
  type UserRole,
} from "./user.types.js";

export type User = {
  _id: Types.ObjectId;
  name: string;
  phoneNumber?: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isEmailVerified: boolean;
  address?: string;
  profilePicture?: UserProfilePicture;
  familyMembers: FamilyMember[];
  preferences: UserPreferences;
  refreshTokenVersion: number;
  passwordResetCodeHash?: string;
  passwordResetCodeExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetTokenExpiresAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDocument = HydratedDocument<User>;

type UserModel = Model<User>;

const profilePictureSchema = new Schema<UserProfilePicture>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const familyMemberSchema = new Schema<FamilyMember>(
  {
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
    },
    role: {
      type: String,
      enum: familyMemberRoles,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const userPreferencesSchema = new Schema<UserPreferences>(
  {
    notifications: {
      type: Boolean,
      default: true,
      required: true,
    },
    aiInsight: {
      type: Boolean,
      default: true,
      required: true,
    },
    darkMode: {
      type: Boolean,
      default: false,
      required: true,
    },
    anonymousAnalytics: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const userSchema = new Schema<User, UserModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: userRoles,
      default: "user",
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    profilePicture: {
      type: profilePictureSchema,
    },
    familyMembers: {
      type: [familyMemberSchema],
      default: [],
      required: true,
    },
    preferences: {
      type: userPreferencesSchema,
      default: () => ({
        notifications: true,
        aiInsight: true,
        darkMode: false,
        anonymousAnalytics: true,
      }),
      required: true,
    },
    refreshTokenVersion: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },
    passwordResetCodeHash: {
      type: String,
      select: false,
    },
    passwordResetCodeExpiresAt: {
      type: Date,
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetTokenExpiresAt: {
      type: Date,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel =
  mongoose.models.User ?? mongoose.model<User, UserModel>("User", userSchema);
