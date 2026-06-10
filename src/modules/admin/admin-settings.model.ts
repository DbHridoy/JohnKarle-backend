import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

export const adminSettingsKey = "dashboard_settings";

export type AdminSettings = {
  _id: Types.ObjectId;
  key: string;
  termsAndConditions?: string;
  privacyPolicy?: string;
  aboutUs?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminSettingsDocument = HydratedDocument<AdminSettings>;

type AdminSettingsModel = Model<AdminSettings>;

const adminSettingsSchema = new Schema<AdminSettings, AdminSettingsModel>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      default: adminSettingsKey,
    },
    termsAndConditions: {
      type: String,
      trim: true,
      maxlength: 100_000,
    },
    privacyPolicy: {
      type: String,
      trim: true,
      maxlength: 100_000,
    },
    aboutUs: {
      type: String,
      trim: true,
      maxlength: 100_000,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const AdminSettingsModel =
  mongoose.models.AdminSettings ??
  mongoose.model<AdminSettings, AdminSettingsModel>("AdminSettings", adminSettingsSchema);
