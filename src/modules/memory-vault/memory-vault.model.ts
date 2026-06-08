import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

import {
  memoryVaultTypes,
  type MemoryVaultFile,
  type MemoryVaultType,
} from "./memory-vault.types.js";

export type MemoryVault = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: MemoryVaultType;
  whoseMemoryIsThis: string;
  files: MemoryVaultFile[];
  title: string;
  narrative: string;
  date: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type MemoryVaultDocument = HydratedDocument<MemoryVault>;

type MemoryVaultModel = Model<MemoryVault>;

const memoryVaultFileSchema = new Schema<MemoryVaultFile>(
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

const memoryVaultSchema = new Schema<MemoryVault, MemoryVaultModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: memoryVaultTypes,
      required: true,
    },
    whoseMemoryIsThis: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    files: {
      type: [memoryVaultFileSchema],
      default: [],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
    },
    narrative: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    date: {
      type: Date,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

memoryVaultSchema.index({ userId: 1, date: -1, createdAt: -1 });

export const MemoryVaultModel =
  mongoose.models.MemoryVault ??
  mongoose.model<MemoryVault, MemoryVaultModel>("MemoryVault", memoryVaultSchema);
