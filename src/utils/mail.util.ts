import nodemailer from "nodemailer";

import { env } from "../config/env.config.js";
import { ApiError } from "./api-error.util.js";

let transporter: nodemailer.Transporter | null = null;

export const getMailTransporter = (): nodemailer.Transporter => {
  if (transporter) {
    return transporter;
  }

  if (!env.OUTLOOK_EMAIL || !env.OUTLOOK_PASSWORD) {
    throw new ApiError(
      500,
      "Outlook mail credentials are not configured.",
      "MAIL_CONFIGURATION_ERROR",
    );
  }

  transporter = nodemailer.createTransport({
    service: "outlook",
    secure: env.SMTP_SECURE,
    auth: {
      user: env.OUTLOOK_EMAIL,
      pass: env.OUTLOOK_PASSWORD,
    },
  });

  return transporter;
};
