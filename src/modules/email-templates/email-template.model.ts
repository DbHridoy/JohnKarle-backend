import mongoose, { Schema, Types, type HydratedDocument, type Model } from "mongoose";

export type EmailTemplate = {
  _id: Types.ObjectId;
  templateName: string;
  subjectLine: string;
  content: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailTemplateDocument = HydratedDocument<EmailTemplate>;

type EmailTemplateModel = Model<EmailTemplate>;

const emailTemplateSchema = new Schema<EmailTemplate, EmailTemplateModel>(
  {
    templateName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
      unique: true,
      index: true,
    },
    subjectLine: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100_000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

emailTemplateSchema.index({ updatedAt: -1, _id: -1 });

export const EmailTemplateModel =
  mongoose.models.EmailTemplate ??
  mongoose.model<EmailTemplate, EmailTemplateModel>("EmailTemplate", emailTemplateSchema);
